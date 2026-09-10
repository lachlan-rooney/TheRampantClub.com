#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════════
// THE CONSENT GATE — does it BLOCK a new member, and does agreeing RELEASE them?
// ───────────────────────────────────────────────────────────────────────────
// The gate is up. The next member to open any /members page meets scroll-and-
// agree before anything else, and six of nine members do not have accounts yet.
// So the first real invitation would otherwise be the first time this path is
// exercised by anyone who is not a test — and if agreeing fails to release
// them, the failure is a founding member locked out of the club's own portal on
// their first login.
//
// This makes the first invitation NOT the first exercise. It proves both halves:
//   · a member who has not agreed is blocked
//   · a member who agrees is let through, and stays through
//
// TOUCHES NO REAL MEMBER. Creates a throwaway member_no of its own and removes
// it — never seeds onto a real key, which clobbers derived data.
// NO EMAIL IS SENT: this drives record_my_consent directly, which is the call
// the route makes AFTER its Resend courtesy. The courtesy is not what gates.
//
//   npx tsx scripts/verify-consent-gate-releases.mts
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL!, SVC = env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, SECRET = env.SUPABASE_JWT_SECRET
if (!SECRET) { console.log('\n⚠  BLOCKED — SUPABASE_JWT_SECRET absent; nothing proven.\n'); process.exit(2) }

const sb = createClient(URL_, SVC, { auth: { persistSession: false } })
let pass = 0, fail = 0
const check = (c: boolean, l: string, d = '') => {
  if (c) { pass++; console.log(`✓ ${l}${d ? ' — ' + d : ''}`) }
  else   { fail++; console.log(`✗ ${l}${d ? ' — ' + d : ''}`) }
}
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const mint = (sub: string) => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 300 }))
  return `${h}.${p}.${b64u(createHmac('sha256', SECRET!).update(`${h}.${p}`).digest())}`
}
const asMember = (sub: string) => createClient(URL_, ANON, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${mint(sub)}` } },
})

// member_no is varchar(12) — the key has to fit, not just look distinctive.
const MEMBER_NO = `ZZG${Date.now().toString().slice(-6)}`
let uid: string | null = null

try {
  console.log('\n── setup: a throwaway member who has never agreed to anything ──')
  const { data: m, error: me } = await sb.from('members')
    .insert({ member_no: MEMBER_NO, full_name: 'ZZ Gate Probe', status: 'Active', tier: 'Legacy' })
    .select('member_no').single()
  if (me) throw new Error(`could not create the throwaway member: ${me.message}`)

  const { data: u, error: ue } = await sb.auth.admin.createUser({
    email: `zz-gate-${Date.now()}@example.invalid`, email_confirm: true,
  })
  if (ue) throw new Error(`could not create the auth user: ${ue.message}`)
  uid = u.user.id
  const { error: pe } = await sb.from('profiles').update({ member_no: m.member_no }).eq('id', uid)
  if (pe) throw new Error(`could not link the profile: ${pe.message}`)
  console.log(`  member ${MEMBER_NO}, linked to a fresh account`)

  const asThem = asMember(uid)
  const stateOf = async () => {
    const { data } = await asThem.rpc('my_consent_state')
    return ((data || []) as Array<Record<string, unknown>>).find(r => r.doc_key === 'privacy')
  }

  // ── BLOCKED ─────────────────────────────────────────────────────────────
  console.log('\n── before agreeing ──')
  const before = await stateOf()
  check(!!before, 'the privacy notice is in their consent state', before ? 'present' : 'MISSING')
  check(before?.needs_action === true, 'a member who has not agreed IS BLOCKED',
        `needs_action=${before?.needs_action}`)
  check(!!before?.current_version_id, 'and there is a published version for them to agree to')

  // ── RELEASED ────────────────────────────────────────────────────────────
  // The exact call the route makes after its email courtesy. If this fails, a
  // founding member is locked out of the portal on their first login.
  console.log('\n── agreeing ──')
  const { error: agreeErr } = await asThem.rpc('record_my_consent', {
    p_doc_key: 'privacy', p_granted: true, p_user_agent: 'verify-consent-gate-releases',
    p_evidence: { scrolled_to_end: true, language: 'vn', version_agreed: null, copy_emailed: false },
  })
  check(!agreeErr, 'a member can record their own consent', agreeErr?.message || 'accepted')

  const after = await stateOf()
  check(after?.needs_action === false, 'AGREEING RELEASES THEM', `needs_action=${after?.needs_action}`)
  check(after?.granted === true, '…and the consent is recorded as granted')

  // It must STAY released — a gate that re-closes on the next page load is
  // worse than one that never opened.
  const again = await stateOf()
  check(again?.needs_action === false, 'and they stay released on the next check')

  // ── THE EVIDENCE ────────────────────────────────────────────────────────
  console.log('\n── the record ──')
  const { data: rows } = await sb.from('member_terms_consents')
    .select('doc_key, granted, method, evidence').eq('member_no', MEMBER_NO)
  check((rows || []).length === 1, 'exactly one consent row — not one per page view', `${rows?.length}`)
  const ev = (rows?.[0]?.evidence || {}) as Record<string, unknown>
  check(ev.scrolled_to_end === true, 'it records that they reached the end', 'scroll evidence kept')
  check(ev.language === 'vn', 'and which language they read it in', `language=${ev.language}`)
} catch (e) {
  fail++; console.log('✗ threw —', (e as Error).message)
} finally {
  console.log('\n── teardown ──')
  await sb.from('member_terms_consents').delete().eq('member_no', MEMBER_NO)
  if (uid) { await sb.from('profiles').update({ member_no: null }).eq('id', uid); await sb.auth.admin.deleteUser(uid) }
  await sb.from('members').delete().eq('member_no', MEMBER_NO)
  const { data: left } = await sb.from('members').select('member_no').ilike('member_no', 'ZZG%')
  if (left?.length) { fail++; console.log('✗ throwaway member survived:', left.map(l => l.member_no).join(', ')) }
  else console.log('  throwaway member, account and consent row all removed')
  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`)
  process.exit(fail === 0 ? 0 : 1)
}
