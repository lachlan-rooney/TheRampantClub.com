#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// KIOSK PHASE 2 — SCHEMA SMOKE TEST  ·  run IMMEDIATELY after db/kiosk_phase2.sql
// ───────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS: PostgreSQL only syntax-checks a plpgsql body at CREATE time.
// Column names, types and ambiguity are not resolved until the function actually
// RUNS. So a file full of `create function` can apply with zero errors and still
// be broken in every body. This calls every one of them.
//
// Uses ZZ-K2 throwaway fixtures ONLY — never a real member_no — and deletes
// everything it made, including on failure.
//
//   node scripts/verify-kiosk-phase2-schema.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { NEXT_PUBLIC_SUPABASE_URL: U, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
        SUPABASE_SERVICE_ROLE_KEY: SVC, SUPABASE_JWT_SECRET: SECRET } = env
if (!SECRET) { console.log('✗ SUPABASE_JWT_SECRET missing'); process.exit(2) }

const b64u = b => Buffer.from(b).toString('base64url')
const mint = (sub, ttl = 120) => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify({ sub, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + ttl }))
  return `${h}.${p}.${b64u(createHmac('sha256', SECRET).update(`${h}.${p}`).digest())}`
}
const svcH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const asH  = t => ({ apikey: ANON, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })

const rest = (path, opts = {}) => fetch(`${U}/rest/v1/${path}`, { headers: svcH, ...opts })
const rpc  = async (fn, body = {}, headers = svcH) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) })
  let j; try { j = await r.json() } catch { j = null }
  return { status: r.status, body: j }
}

let fails = 0
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`); if (!ok) fails++
}
// A plpgsql body error surfaces as 42703/42702/42804 etc. Anything in that family
// means the FUNCTION is broken, as distinct from it correctly refusing us.
const bodyBroke = r => {
  const c = r.body?.code || ''
  return /^(42703|42702|42804|42883|42P01|22|XX000)/.test(c)
}
const ran = (r, label) => check(!bodyBroke(r), label,
  bodyBroke(r) ? `${r.body?.code}: ${r.body?.message}`.slice(0, 140) : `ok (HTTP ${r.status})`)

const made = { members: [], users: [], device: null, entry: null, terms: [] }

try {
  console.log('\n── fixtures ──────────────────────────────────────────────\n')

  // two throwaway members + linked logins
  for (const tag of ['ZZ-K2-A', 'ZZ-K2-B']) {
    await rest('members', { method: 'POST', headers: { ...svcH, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ member_no: tag, full_name: `ZZ Test ${tag}`, tier: 'Honorary', status: 'Active' }) })
    made.members.push(tag)
    const ur = await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: svcH,
      body: JSON.stringify({ email: `${tag.toLowerCase()}@example.invalid`, password: 'zz-Test-Pass-9182', email_confirm: true }) })
    const u = await ur.json()
    if (!u.id) throw new Error('createUser failed: ' + JSON.stringify(u).slice(0, 200))
    made.users.push(u.id)
    await rest('profiles', { method: 'POST', headers: { ...svcH, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: u.id, display_name: `ZZ ${tag}`, is_admin: false, member_no: tag }) })
  }
  const [A, B] = made.users
  console.log(`  members ${made.members.join(', ')} + linked logins`)

  // an enrolled device, in a REAL room, paired through the Phase 1 function
  const room = (await (await rest('space_tables?select=space&limit=1')).json())[0].space
  const dev = await (await rest('kiosk_devices', { method: 'POST', headers: { ...svcH, Prefer: 'return=representation' },
    body: JSON.stringify({ label: 'ZZ-K2 test tablet', pair_code: 'ZZK2CODE',
                           pair_expires_at: new Date(Date.now() + 6e5).toISOString() }) })).json()
  made.device = dev[0].id
  const paired = await rpc('kiosk_pair_device', { p_code: 'ZZK2CODE' })
  const DEVTOK = paired.body
  check(typeof DEVTOK === 'string' && DEVTOK.length === 64, 'Phase 1 pairing still works', `token ${DEVTOK ? 'issued' : 'MISSING'}`)
  const roomSet = await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'PATCH', body: JSON.stringify({ room }) })
  check(roomSet.ok, `room guard accepts a real space (${room})`, `HTTP ${roomSet.status}`)
  const roomBad = await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'PATCH', body: JSON.stringify({ room: 'The Library Bar' }) })
  check(!roomBad.ok, 'room guard REJECTS a display name ("The Library Bar")', `HTTP ${roomBad.status}`)

  // tonight's board entry for that room, and a terms version
  const today = new Date(Date.now() + 7 * 3.6e6).toISOString().slice(0, 10)
  const ce = await (await rest('calendar_entries', { method: 'POST', headers: { ...svcH, Prefer: 'return=representation' },
    body: JSON.stringify({ title: 'ZZ-K2 Tasting', title_vn: 'ZZ-K2', entry_date: today, space: room,
      kind: 'tasting', visibility: 'member', show_on_board: true, blocks_space: false,
      start_time: '21:00', end_time: '01:00', board_note: 'ZZ note', board_note_vn: 'ZZ ghi chú' }) })).json()
  made.entry = ce[0]?.id
  for (const k of ['membership_terms', 'privacy']) {
    const tv = await (await rest('terms_versions', { method: 'POST', headers: { ...svcH, Prefer: 'return=representation' },
      body: JSON.stringify({ doc_key: k, version: 'ZZ-K2', effective_date: '2020-01-01' }) })).json()
    if (tv[0]?.id) made.terms.push(tv[0].id)
  }
  console.log(`  device in ${room}, a 21:00–01:00 entry tonight, ${made.terms.length} terms versions\n`)

  console.log('── every function body actually executed ─────────────────\n')

  ran(await rpc('kiosk_pin_is_weak', { p_pin: '123456' }), 'kiosk_pin_is_weak')
  check((await rpc('kiosk_pin_is_weak', { p_pin: '123456' })).body === true,  '  …rejects 123456')
  check((await rpc('kiosk_pin_is_weak', { p_pin: '111111' })).body === true,  '  …rejects 111111')
  check((await rpc('kiosk_pin_is_weak', { p_pin: '121212' })).body === true,  '  …rejects 121212')
  check((await rpc('kiosk_pin_is_weak', { p_pin: '483902' })).body === false, '  …allows a real PIN')

  const setPin = await rpc('set_my_kiosk_pin', { p_pin: '483902' }, asH(mint(A)))
  ran(setPin, 'set_my_kiosk_pin (as the member)')
  const st = await rpc('my_kiosk_pin_state', {}, asH(mint(A)))
  ran(st, 'my_kiosk_pin_state')
  check(st.body?.[0]?.has_pin === true, '  …reports has_pin after setting')

  const login = await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-K2-A', p_pin: '483902' })
  ran(login, 'kiosk_member_login')
  const SESS = login.body
  check(typeof SESS === 'string' && SESS.length === 64, '  …mints a session token')
  check((await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-K2-A', p_pin: '000001' })).body === null,
        '  …wrong PIN returns null')
  check((await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-NOPE', p_pin: '483902' })).body === null,
        '  …unknown member returns null (identical)')

  const touch = await rpc('kiosk_member_touch', { p_device_token: DEVTOK, p_session_token: SESS })
  ran(touch, 'kiosk_member_touch')
  check(touch.body?.[0]?.out_member_no === 'ZZ-K2-A', '  …resolves the right member')
  const live = await rpc('kiosk_member_session_live', { p_device_token: DEVTOK, p_session_token: SESS })
  ran(live, 'kiosk_member_session_live'); check(live.body === true, '  …reports live')
  check((await rpc('kiosk_member_session_live', { p_device_token: 'nope', p_session_token: SESS })).body === false,
        '  …a token replayed off-device is not live')

  const board = await rpc('kiosk_board', { p_device_token: DEVTOK })
  ran(board, 'kiosk_board')
  const b0 = board.body?.[0]
  check(b0?.room === room, '  …returns the device room')
  check(b0 && new Date(b0.ends_at) > new Date(b0.starts_at),
        '  …MIDNIGHT GUARD: 21:00–01:00 ends after it starts',
        b0 ? `${b0.starts_at} → ${b0.ends_at}` : 'no row')
  check(b0 && !('member_no' in b0) && !('attendee' in b0), '  …no PII in the board payload')

  ran(await rpc('current_terms_version', { p_doc_key: 'privacy' }), 'current_terms_version')
  ran(await rpc('record_my_consent', { p_doc_key: 'privacy', p_granted: true }, asH(mint(A))), 'record_my_consent')
  const cs = await rpc('my_consent_state', {}, asH(mint(A)))
  ran(cs, 'my_consent_state')
  const priv = (cs.body || []).find(r => r.doc_key === 'privacy')
  const mkt  = (cs.body || []).find(r => r.doc_key === 'marketing')
  check(priv?.granted === true && priv?.needs_action === false, '  …privacy consent recorded, no action needed')
  check(mkt?.needs_action === false, '  …marketing unanswered is NOT a pending action (opt-in)')
  await rpc('record_my_consent', { p_doc_key: 'marketing', p_granted: true }, asH(mint(A)))
  await rpc('record_my_consent', { p_doc_key: 'marketing', p_granted: false }, asH(mint(A)))
  const cs2 = await rpc('my_consent_state', {}, asH(mint(A)))
  const priv2 = (cs2.body || []).find(r => r.doc_key === 'privacy')
  check(priv2?.granted === true, '  …withdrawing marketing leaves privacy intact')

  // admin-only bodies, executed as a real admin (read-only)
  const admin = (await (await rest('profiles?select=id&is_admin=eq.true&limit=1')).json())[0]
  if (admin) {
    ran(await rpc('member_kiosk_pin_status', {}, asH(mint(admin.id))), 'member_kiosk_pin_status (admin)')
    ran(await rpc('member_consent_gaps',     {}, asH(mint(admin.id))), 'member_consent_gaps (admin)')
  } else console.log('  (no admin profile — admin bodies not executed)')
  check((await rpc('member_kiosk_pin_status', {}, asH(mint(A)))).status >= 400, 'non-admin refused by member_kiosk_pin_status')

  ran(await rpc('kiosk_member_logout', { p_session_token: SESS, p_reason: 'done' }), 'kiosk_member_logout')
  check((await rpc('kiosk_member_session_live', { p_device_token: DEVTOK, p_session_token: SESS })).body === false,
        '  …session is dead after logout')

  ran(await rpc('reset_member_kiosk_pin',     { p_member_no: 'ZZ-K2-A' }, asH(mint(admin?.id || A))), 'reset_member_kiosk_pin (admin)')
  ran(await rpc('clear_member_kiosk_lockout', { p_member_no: 'ZZ-K2-A' }, asH(mint(admin?.id || A))), 'clear_member_kiosk_lockout (admin)')

} catch (e) {
  console.log('\n✗ HARNESS ERROR —', e.message); fails++
} finally {
  console.log('\n── cleanup ───────────────────────────────────────────────')
  for (const m of made.members) {
    await rest(`member_terms_consents?member_no=eq.${m}`, { method: 'DELETE' })
    await rest(`kiosk_member_sessions?member_no=eq.${m}`, { method: 'DELETE' })
    await rest(`member_pin_attempts?member_no=eq.${m}`,   { method: 'DELETE' })
    await rest(`member_kiosk_pins?member_no=eq.${m}`,     { method: 'DELETE' })
  }
  if (made.entry)  await rest(`calendar_entries?id=eq.${made.entry}`, { method: 'DELETE' })
  for (const t of made.terms) await rest(`terms_versions?id=eq.${t}`, { method: 'DELETE' })
  if (made.device) {
    await rest(`kiosk_member_sessions?device_id=eq.${made.device}`, { method: 'DELETE' })
    await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'DELETE' })
  }
  for (const m of made.members) await rest(`profiles?member_no=eq.${m}`, { method: 'PATCH', body: JSON.stringify({ member_no: null }) })
  for (const u of made.users)   await fetch(`${U}/auth/v1/admin/users/${u}`, { method: 'DELETE', headers: svcH })
  for (const m of made.members) await rest(`members?member_no=eq.${m}`, { method: 'DELETE' })
  console.log('  ZZ-K2 fixtures removed')
}

console.log(fails === 0
  ? '\nPASS — every function body executed cleanly.\n'
  : `\nFAIL — ${fails} check(s) failed.\n`)
process.exit(fails === 0 ? 0 : 1)
