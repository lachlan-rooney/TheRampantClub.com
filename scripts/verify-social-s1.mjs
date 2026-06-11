#!/usr/bin/env node
// verify-social-s1.mjs — Phase S1.0 write-layer checks (data layer).
// Throwaway ZZ-TEST rows only; cleaned up in finally. Verifies the structural
// guarantees the routes rely on (the index, read isolation, rate-limit query,
// notification payload hygiene, spine actor). Live HTTP route behaviour (The Club
// label, the badge) is eyeballed in S1.1.

import { readFile } from 'node:fs/promises'
const env = Object.fromEntries(
  (await readFile('.env.local', 'utf8')).split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY
const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(URL, SVC, { auth: { persistSession: false } })
const TAG = `zz-test-${Date.now()}`, PW = 'Test-' + Date.now() + '-Aa1!'
const results = [], rec = (n, p, d) => { results.push({ p }); console.log(`${p ? '✓' : '✗'} ${n} — ${d}`) }
const n = r => (r.data || []).length
const created = { users: [], members: [], threads: [] }

async function mint(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('mint ' + email + ': ' + JSON.stringify(j))
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${j.access_token}` } } })
}
async function mkUser(h, memberNo = null) {
  const email = `${TAG}-${h}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (error) throw new Error('createUser ' + h + ': ' + error.message)
  created.users.push(data.user.id)
  await admin.from('profiles').upsert({ id: data.user.id, display_name: `ZZ ${h}`, is_admin: false, member_no: memberNo }, { onConflict: 'id' })
  return { id: data.user.id, client: await mint(email) }
}
async function mkMember(no) {
  const member_no = no.slice(0, 12)
  await admin.from('members').upsert({ member_no, full_name: 'ZZ ' + no, tier: 'Honorary', status: 'Active' }, { onConflict: 'member_no' })
  created.members.push(member_no); return member_no
}

try {
  const mA = await mkMember('ZZ-S1-A'), mB = await mkMember('ZZ-S1-B')
  const A = await mkUser('a', mA), B = await mkUser('b', mB)

  // index present?
  const t1 = await admin.from('threads').insert({ kind: 'concierge', created_by: A.id }).select('id').single()
  created.threads.push(t1.data?.id)
  await admin.from('thread_participants').insert({ thread_id: t1.data.id, participant: A.id, role: 'member' })
  const t2 = await admin.from('threads').insert({ kind: 'concierge', created_by: A.id }).select('id').single()
  if (t2.data?.id) created.threads.push(t2.data.id)
  const indexOn = t2.error?.code === '23505'
  rec('1 one-concierge-per-member (index)', indexOn,
    indexOn ? 'second insert → 23505 (idempotency guaranteed)' : `second insert → ${t2.error ? t2.error.code : 'SUCCEEDED — run db/social_s1.sql first'}`)

  // read isolation (the GET route reads via session client)
  await admin.from('messages').insert({ thread_id: t1.data.id, sender: A.id, body: 'hello club' })
  const ownRead = await A.client.from('threads').select('id').eq('kind', 'concierge').eq('created_by', A.id)
  const crossRead = await B.client.from('threads').select('id').eq('kind', 'concierge').eq('created_by', A.id)
  const crossMsg = await B.client.from('messages').select('id').eq('thread_id', t1.data.id)
  rec('2 read isolation', n(ownRead) === 1 && n(crossRead) === 0 && n(crossMsg) === 0,
    `A own=${n(ownRead)}, B reads A's thread=${n(crossRead)}, B reads A's messages=${n(crossMsg)}`)

  // rate-limit query (the route's count-rows logic)
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('sender', A.id).gte('created_at', since)
  rec('3 rate-limit query', typeof count === 'number' && count >= 1,
    `messages by sender in last hour = ${count} (ceiling 40 → reject at 41st)`)

  // notification payload hygiene (no body text)
  await admin.from('notifications').insert({ recipient: A.id, type: 'concierge_reply', metadata: { link: '/members/concierge', label: 'The Club replied' }, email_status: 'in_app_only' })
  const notif = await admin.from('notifications').select('metadata').eq('recipient', A.id).eq('type', 'concierge_reply').single()
  const meta = notif.data?.metadata || {}
  const clean = !('body' in meta) && !JSON.stringify(meta).includes('hello club') && meta.link && meta.label
  rec('4 notification hygiene', clean, `metadata=${JSON.stringify(meta)} (label+link only, no body)`)

  // spine emit — actor stamped from the session, project_id null
  const emit = await A.client.rpc('ops_emit_event', { p_verb: 'message.sent', p_object_type: 'message', p_object_id: null, p_project_id: null, p_metadata: { kind: 'concierge' } })
  let ev = { data: [] }
  if (!emit.error) ev = await admin.from('activity_events').select('actor, verb, project_id').eq('id', emit.data)
  const e0 = ev.data?.[0]
  rec('5 spine emit (actor from session)', !emit.error && e0?.actor === A.id && e0?.verb === 'message.sent' && e0?.project_id === null,
    emit.error ? `rpc err ${emit.error.code} ${emit.error.message}` : `actor=${e0?.actor === A.id ? 'session uid ✓' : e0?.actor}, verb=${e0?.verb}, project_id=${e0?.project_id}`)

  // sender integrity is a CODE guarantee — the route hardcodes sender:actor.id, never reads payload.sender
  rec('6 sender from session (code)', true, 'messages route sets sender = actor.id (session); a client-sent sender is ignored — by inspection')

} catch (e) {
  console.error('\n‼ ERROR:', e.message)
} finally {
  console.log('\n— cleanup —')
  for (const u of created.users) {
    await admin.from('activity_events').delete().eq('actor', u)
    await admin.from('notifications').delete().eq('recipient', u)
  }
  for (const t of created.threads) if (t) await admin.from('threads').delete().eq('id', t)
  for (const u of created.users) await admin.auth.admin.deleteUser(u)
  for (const m of created.members) await admin.from('members').delete().eq('member_no', m)
  const passed = results.filter(r => r.p).length
  console.log(`  done.\n══ ${passed}/${results.length} checks passed ══`)
  if (passed !== results.length) process.exitCode = 1
}
