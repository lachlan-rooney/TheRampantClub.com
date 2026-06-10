#!/usr/bin/env node
// verify-social-substrate.mjs — Phase S0 minted-JWT verification matrix.
// Throwaway ZZ-TEST members + auth users ONLY (never real member keys — the 0a
// lesson). Creates a concierge thread, two direct threads, an introduction, then
// runs 11 checks as minted member/admin/anon sessions. Cleans up in finally.
// Read-only intent against real data; all writes are on ZZ-TEST rows.

import { readFile } from 'node:fs/promises'
const env = Object.fromEntries(
  (await readFile('.env.local', 'utf8')).split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = env.SUPABASE_SERVICE_ROLE_KEY
const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(URL, SVC, { auth: { persistSession: false } })

const TAG = `zz-test-${Date.now()}`
const PW = 'Test-' + Date.now() + '-Aa1!'
const results = []
const rec = (n, pass, detail) => { results.push({ n, pass, detail }); console.log(`${pass ? '✓' : '✗'} ${n} — ${detail}`) }

// state to clean up
const created = { users: [], members: [], threads: [] }

async function mintClient(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('mint failed for ' + email + ': ' + JSON.stringify(j))
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${j.access_token}` } },
  })
}

async function mkUser(handle, { isAdmin = false, memberNo = null } = {}) {
  const email = `${TAG}-${handle}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (error) throw new Error(`createUser ${handle}: ${error.message}`)
  const id = data.user.id
  created.users.push(id)
  // profile may be auto-created by a trigger; upsert to set our fields either way.
  const { error: pe } = await admin.from('profiles').upsert(
    { id, display_name: `ZZ ${handle}`, is_admin: isAdmin, member_no: memberNo },
    { onConflict: 'id' }
  )
  if (pe) throw new Error(`profile upsert ${handle}: ${pe.message}`)
  return { id, email, client: await mintClient(email) }
}

async function mkMember(no, name) {
  const member_no = `${no}`.slice(0, 12)
  const { error } = await admin.from('members').upsert(
    { member_no, full_name: name, tier: 'Honorary', status: 'Active' }, { onConflict: 'member_no' }
  )
  if (error) throw new Error(`member ${member_no}: ${error.message}`)
  created.members.push(member_no)
  return member_no
}

const rows = (r) => (r.error ? `ERR(${r.error.code || ''} ${r.error.message})` : `${(r.data || []).length} row(s)`)
const n = (r) => (r.data || []).length

try {
  if (!URL || !ANON || !SVC) throw new Error('missing env (need URL, ANON, SERVICE keys)')

  // ── setup ────────────────────────────────────────────────────────────────
  const mA = await mkMember('ZZ-TEST-A', 'ZZ Test A')
  const mB = await mkMember('ZZ-TEST-B', 'ZZ Test B')
  const mC = await mkMember('ZZ-TEST-C', 'ZZ Test C')
  const A = await mkUser('a', { memberNo: mA })
  const B = await mkUser('b', { memberNo: mB })
  const C = await mkUser('c', { memberNo: mC })
  const ADM = await mkUser('adm', { isAdmin: true })

  // concierge thread: A (member) + ADM (staff)
  const CT = (await admin.from('threads').insert({ kind: 'concierge', created_by: A.id }).select().single()).data
  const DT_AB = (await admin.from('threads').insert({ kind: 'direct', created_by: A.id }).select().single()).data
  const DT_BC = (await admin.from('threads').insert({ kind: 'direct', created_by: B.id }).select().single()).data
  created.threads.push(CT.id, DT_AB.id, DT_BC.id)
  await admin.from('thread_participants').insert([
    { thread_id: CT.id, participant: A.id, role: 'member' },
    { thread_id: CT.id, participant: ADM.id, role: 'staff' },
    { thread_id: DT_AB.id, participant: A.id, role: 'member' },
    { thread_id: DT_AB.id, participant: B.id, role: 'member' },
    { thread_id: DT_BC.id, participant: B.id, role: 'member' },
    { thread_id: DT_BC.id, participant: C.id, role: 'member' },
  ])
  await admin.from('messages').insert([
    { thread_id: CT.id, sender: A.id, body: 'concierge hello' },
    { thread_id: DT_AB.id, sender: A.id, body: 'direct AB hello' },
    { thread_id: DT_BC.id, sender: B.id, body: 'direct BC hello' },
  ])
  const intro = (await admin.from('introductions').insert({ requester: A.id, recipient: B.id, context: 'hi', status: 'pending' }).select().single()).data

  // ── 1. cross-member ────────────────────────────────────────────────────────
  const c1own = await A.client.from('messages').select('id').eq('thread_id', DT_AB.id)
  const c1cross = await A.client.from('messages').select('id').eq('thread_id', DT_BC.id)
  rec('1 cross-member', n(c1own) === 1 && n(c1cross) === 0, `own DT_AB=${rows(c1own)}, B's DT_BC=${rows(c1cross)}`)

  // ── 2. enumeration ──────────────────────────────────────────────────────────
  const c2p = await A.client.from('thread_participants').select('participant').eq('thread_id', DT_BC.id)
  const c2m = await A.client.from('messages').select('id').eq('thread_id', DT_BC.id)
  rec('2 no enumeration', n(c2p) === 0 && n(c2m) === 0, `participants=${rows(c2p)}, messages=${rows(c2m)}`)

  // ── 3. concierge scope (admin reads concierge, NOT direct) ─────────────────
  const c3ct = await ADM.client.from('messages').select('id').eq('thread_id', CT.id)
  const c3dt = await ADM.client.from('messages').select('id').eq('thread_id', DT_AB.id)
  rec('3 concierge scope', n(c3ct) >= 1 && n(c3dt) === 0, `admin concierge=${rows(c3ct)}, admin direct=${rows(c3dt)}`)

  // ── 4. block severance (direct only; concierge unaffected; reversible) ─────
  const preA = n(await A.client.from('messages').select('id').eq('thread_id', DT_AB.id))
  const preB = n(await B.client.from('messages').select('id').eq('thread_id', DT_AB.id))
  await admin.from('member_blocks').insert({ blocker: A.id, blocked: B.id })
  const postA = n(await A.client.from('messages').select('id').eq('thread_id', DT_AB.id))
  const postB = n(await B.client.from('messages').select('id').eq('thread_id', DT_AB.id))
  const concierge = n(await A.client.from('messages').select('id').eq('thread_id', CT.id))
  await admin.from('member_blocks').delete().eq('blocker', A.id).eq('blocked', B.id)
  const restored = n(await A.client.from('messages').select('id').eq('thread_id', DT_AB.id))
  rec('4 block severance',
    preA === 1 && preB === 1 && postA === 0 && postB === 0 && concierge >= 1 && restored === 1,
    `pre A/B=${preA}/${preB}, blocked A/B=${postA}/${postB}, concierge(unaffected)=${concierge}, unblocked=${restored}`)

  // ── 5. decline invisibility ────────────────────────────────────────────────
  await admin.from('introductions').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', intro.id)
  const c5fn = await A.client.rpc('introductions_for_me')
  const c5fnStatus = (c5fn.data || []).find(r => r.id === intro.id)?.status
  const c5base = await A.client.from('introductions').select('status').eq('id', intro.id)
  const c5adm = await ADM.client.from('introductions').select('status').eq('id', intro.id)
  const c5b = await B.client.from('introductions').select('status').eq('id', intro.id)
  rec('5 decline invisibility',
    c5fnStatus === 'pending' && n(c5base) === 0 && (c5adm.data?.[0]?.status === 'declined') && n(c5b) === 0,
    `requester fn=${c5fnStatus}, requester base=${rows(c5base)}, admin=${c5adm.data?.[0]?.status}, recipient base=${rows(c5b)} (recipient sees pending-only → declined invisible)`)

  // ── 6. re-request blocked (unique pair) ────────────────────────────────────
  const c6 = await admin.from('introductions').insert({ requester: A.id, recipient: B.id, context: 're', status: 'pending' })
  rec('6 re-request blocked', c6.error?.code === '23505', `second A→B insert → ${c6.error ? c6.error.code : 'NO ERROR (FAIL)'}`)

  // ── 7. role escalation (column grant) ──────────────────────────────────────
  const c7ok = await A.client.from('thread_participants').update({ last_read_at: new Date().toISOString() }).eq('thread_id', DT_AB.id).eq('participant', A.id).select()
  const c7bad = await A.client.from('thread_participants').update({ role: 'staff' }).eq('thread_id', DT_AB.id).eq('participant', A.id).select()
  rec('7 role escalation', !c7ok.error && n(c7ok) === 1 && !!c7bad.error,
    `last_read_at update=${c7ok.error ? 'ERR' : 'ok'}, role→staff=${c7bad.error ? 'DENIED(' + c7bad.error.code + ')' : 'ALLOWED (FAIL)'}`)

  // ── 8. consent (own-only; has_consent reflects toggle; gate lands in S-phases) ─
  await admin.from('member_consents').insert({ member: A.id, feature: 'presence', enabled: false })
  const c8other = await C.client.from('member_consents').select('feature').eq('member', A.id)
  const c8own = await A.client.from('member_consents').select('feature').eq('member', A.id)
  const c8false = await A.client.rpc('has_consent', { p_uid: A.id, p_feature: 'presence' })
  await admin.from('member_consents').update({ enabled: true }).eq('member', A.id).eq('feature', 'presence')
  const c8true = await A.client.rpc('has_consent', { p_uid: A.id, p_feature: 'presence' })
  rec('8 consent', n(c8other) === 0 && n(c8own) === 1 && c8false.data === false && c8true.data === true,
    `other member reads=${rows(c8other)}, own=${rows(c8own)}, has_consent off→${c8false.data}, on→${c8true.data} (no table gates on it yet — by design, S-phases)`)

  // ── 9. block on introductions ──────────────────────────────────────────────
  const introBA = (await admin.from('introductions').insert({ requester: B.id, recipient: A.id, context: 'x', status: 'pending' }).select().single()).data
  await admin.from('member_blocks').insert({ blocker: A.id, blocked: B.id })
  const c9 = await A.client.from('introductions').select('id').eq('id', introBA.id)
  await admin.from('member_blocks').delete().eq('blocker', A.id).eq('blocked', B.id)
  rec('9 block on introductions', n(c9) === 0, `recipient A read of B→A intro while blocked=${rows(c9)}`)

  // ── 10. length caps ─────────────────────────────────────────────────────────
  const c10msg = await admin.from('messages').insert({ thread_id: DT_AB.id, sender: A.id, body: 'x'.repeat(4001) })
  const c10post = await admin.from('posts').insert({ author: A.id, author_kind: 'member', body: 'x'.repeat(8001) })
  const c10note = await admin.from('tasting_notes').insert({ author: A.id, note: 'x'.repeat(8001) })
  rec('10 length caps', c10msg.error?.code === '23514' && c10post.error?.code === '23514' && c10note.error?.code === '23514',
    `msg4001=${c10msg.error?.code}, post8001=${c10post.error?.code}, note8001=${c10note.error?.code}`)

  // ── 11. anon → []; service → all ────────────────────────────────────────────
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const c11t = await anon.from('threads').select('id')
  const c11m = await anon.from('messages').select('id')
  const c11p = await anon.from('posts').select('id')
  const c11svc = await admin.from('messages').select('id')
  rec('11 anon/service', n(c11t) === 0 && n(c11m) === 0 && n(c11p) === 0 && n(c11svc) >= 3,
    `anon threads=${rows(c11t)}, messages=${rows(c11m)}, posts=${rows(c11p)}; service messages=${rows(c11svc)}`)

} catch (e) {
  console.error('\n‼ SETUP/RUN ERROR:', e.message)
} finally {
  // ── cleanup (threads cascade participants+messages; auth delete cascades the rest) ──
  console.log('\n— cleanup —')
  for (const t of created.threads) await admin.from('threads').delete().eq('id', t)
  // introductions / blocks / consents reference profiles on delete cascade → drop with users
  for (const u of created.users) {
    await admin.from('introductions').delete().or(`requester.eq.${u},recipient.eq.${u}`)
    await admin.from('member_blocks').delete().or(`blocker.eq.${u},blocked.eq.${u}`)
    await admin.from('member_consents').delete().eq('member', u)
    await admin.from('tasting_notes').delete().eq('author', u)
    await admin.from('posts').delete().eq('author', u)
    const { error } = await admin.auth.admin.deleteUser(u)
    if (error) console.log('  user delete warn:', error.message)
  }
  for (const m of created.members) await admin.from('members').delete().eq('member_no', m)
  console.log('  done.')

  const passed = results.filter(r => r.pass).length
  console.log(`\n══ ${passed}/${results.length} checks passed ══`)
  if (passed !== results.length) process.exitCode = 1
}
