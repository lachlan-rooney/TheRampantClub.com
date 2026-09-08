#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// KIOSK PHASE 2 — VERIFICATION  ·  checks 1–11
// ───────────────────────────────────────────────────────────────────────────
// Checks 1, 2 and 3 decide whether the single-tablet model is safe at all. A "no"
// there is a legitimate result: it costs a tablet per room and nothing else.
//
// HTTP checks need the dev server on :3001. Without it they are SKIPPED and
// reported as skipped — never quietly passed.
//
// ZZ-K2 throwaway fixtures only; removed in a finally block.
//   node scripts/verify-kiosk-phase2.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { NEXT_PUBLIC_SUPABASE_URL: U, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
        SUPABASE_SERVICE_ROLE_KEY: SVC, SUPABASE_JWT_SECRET: SECRET } = env
const APP = process.env.APP_URL || 'http://localhost:3001'

const b64u = b => Buffer.from(b).toString('base64url')
const mint = (sub, ttl = 120) => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify({ sub, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + ttl }))
  return `${h}.${p}.${b64u(createHmac('sha256', SECRET).update(`${h}.${p}`).digest())}`
}
const svcH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const rest = (path, opts = {}) => fetch(`${U}/rest/v1/${path}`, { headers: svcH, ...opts })
const asMember = (t, path) => fetch(`${U}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${t}` } })
const rpc = async (fn, body = {}, headers = svcH) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) })
  let j; try { j = await r.json() } catch { j = null }
  return { status: r.status, body: j }
}

let fails = 0, skips = 0
const head = t => console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 56 - t.length)))
const ok = (c, label, detail = '') => { console.log(`${c ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`); if (!c) fails++ }
const skip = (label, why) => { console.log(`· SKIP ${label} — ${why}`); skips++ }

const made = { members: [], users: [], device: null, entry: null }
// Dev-server probe. Generous, and retried: Next compiles a route on its FIRST
// request, so a short timeout here reports "no server" for a server that is simply
// still building — and the checks that matter most would then silently skip.
let serverUp = false
for (let i = 0; i < 3 && !serverUp; i++) {
  try {
    const r = await fetch(`${APP}/api/kiosk/board`, { signal: AbortSignal.timeout(30_000) })
    serverUp = r.status < 600
  } catch { await new Promise(res => setTimeout(res, 1500)) }
}

try {
  // ── fixtures ────────────────────────────────────────────────────────────
  for (const tag of ['ZZ-K2-A', 'ZZ-K2-B']) {
    await rest('members', { method: 'POST', headers: { ...svcH, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ member_no: tag, full_name: `ZZ Test ${tag}`, tier: 'Honorary', status: 'Active' }) })
    made.members.push(tag)
    const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: svcH,
      body: JSON.stringify({ email: `${tag.toLowerCase()}@example.invalid`, password: 'zz-Test-Pass-9182', email_confirm: true }) })).json()
    made.users.push(u.id)
    await rest('profiles', { method: 'POST', headers: { ...svcH, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: u.id, display_name: `Zeta ${tag}`, is_admin: false, member_no: tag }) })
  }
  const [A, B] = made.users
  // B gets a taste profile so "A cannot read B" is testing a row that EXISTS.
  await rest('member_taste_profiles', { method: 'POST', headers: { ...svcH, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ member_no: 'ZZ-K2-B', vector: { peated_smoky: 0.9 } }) })
  await rest('member_taste_profiles', { method: 'POST', headers: { ...svcH, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ member_no: 'ZZ-K2-A', vector: { dried_fruit_walnut: 0.8, cereal_biscuit: 0.4 } }) })

  const room = (await (await rest('space_tables?select=space&limit=1')).json())[0].space
  const dev = await (await rest('kiosk_devices', { method: 'POST', headers: { ...svcH, Prefer: 'return=representation' },
    body: JSON.stringify({ label: 'ZZ-K2 verify tablet', pair_code: 'ZZK2VERI', pair_expires_at: new Date(Date.now() + 6e5).toISOString() }) })).json()
  made.device = dev[0].id
  const DEVTOK = (await rpc('kiosk_pair_device', { p_code: 'ZZK2VERI' })).body
  await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'PATCH', body: JSON.stringify({ room }) })
  await rpc('set_my_kiosk_pin', { p_pin: '483902' }, { apikey: ANON, Authorization: `Bearer ${mint(A)}`, 'Content-Type': 'application/json' })

  const today = new Date(Date.now() + 7 * 3.6e6).toISOString().slice(0, 10)
  const ce = await (await rest('calendar_entries', { method: 'POST', headers: { ...svcH, Prefer: 'return=representation' },
    body: JSON.stringify({ title: 'ZZ-K2 Tasting', entry_date: today, space: room, kind: 'tasting',
      visibility: 'member', show_on_board: true, blocks_space: false, start_time: '21:00', end_time: '01:00',
      board_note: 'ZZ', attendee: 'ZZ SECRET ATTENDEE' }) })).json()
  made.entry = ce[0]?.id

  // ═══ CHECK 1 — MODE IS A DATA-LAYER BOUNDARY ═══════════════════════════
  head('1 · member-mode identity cannot reach staff data')
  const mtok = mint(A)
  for (const [label, path] of [
    ['visits (the Ritual)',        'visits?select=visit_id&limit=1'],
    ['harmony_observations',       'harmony_observations?select=id&limit=1'],
    ['preferences (the dossier)',  'preferences?select=preference_id&limit=1'],
    ['team_members (staff)',       'team_members?select=id&limit=1'],
    ['members (the roster)',       'members?select=member_no&limit=1'],
    ['bookings',                   'bookings?select=booking_id&limit=1'],
  ]) {
    const r = await asMember(mtok, path)
    const rows = r.ok ? await r.json() : null
    ok(!r.ok || (Array.isArray(rows) && rows.length === 0),
       `refused at the data layer: ${label}`, r.ok ? `${rows?.length ?? '?'} row(s)` : `HTTP ${r.status}`)
  }

  // ═══ CHECK 3 — MEMBER SEES ONLY THEIR OWN ══════════════════════════════
  head('3 · a member reads only their own')
  const mine = await (await asMember(mtok, 'member_taste_profiles?select=member_no')).json()
  ok(Array.isArray(mine) && mine.length === 1 && mine[0].member_no === 'ZZ-K2-A',
     'A sees exactly one taste profile — their own', JSON.stringify(mine))
  const theirs = await (await asMember(mtok, 'member_taste_profiles?select=member_no&member_no=eq.ZZ-K2-B')).json()
  ok(Array.isArray(theirs) && theirs.length === 0, 'A cannot read B even when asking for B by name')

  // ═══ CHECK 4 — PIN HARDENING ═══════════════════════════════════════════
  head('4 · PIN hardening')
  const hash = await (await rest('member_kiosk_pins?select=pin_hash&member_no=eq.ZZ-K2-A')).json()
  ok(hash[0]?.pin_hash?.startsWith('$2'), 'PINs are bcrypt-hashed, never plaintext')
  ok((await asMember(mtok, 'member_kiosk_pins?select=pin_hash')).status !== 200 ||
     (await (await asMember(mtok, 'member_kiosk_pins?select=pin_hash')).json()).length === 0,
     'the PIN table is unreadable even to an authenticated member')
  const wrong = await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-K2-A', p_pin: '999119' })
  const unknown = await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-NOBODY', p_pin: '999119' })
  ok(wrong.body === null && unknown.body === null && wrong.status === unknown.status,
     'wrong-PIN and unknown-member are indistinguishable', `both null, both HTTP ${wrong.status}`)
  // lock A out from a DIFFERENT device to prove the counter is per membership number
  const dev2 = await (await rest('kiosk_devices', { method: 'POST', headers: { ...svcH, Prefer: 'return=representation' },
    body: JSON.stringify({ label: 'ZZ-K2 second tablet', pair_code: 'ZZK2TWO1', pair_expires_at: new Date(Date.now() + 6e5).toISOString() }) })).json()
  const DEV2 = (await rpc('kiosk_pair_device', { p_code: 'ZZK2TWO1' })).body
  for (let i = 0; i < 5; i++) await rpc('kiosk_member_login', { p_device_token: DEV2, p_member_no: 'ZZ-K2-A', p_pin: '111119' })
  const afterLock = await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-K2-A', p_pin: '483902' })
  ok(afterLock.body === null, 'lockout follows the MEMBERSHIP NUMBER across tablets — the correct PIN is refused on tablet 1')
  const admin = (await (await rest('profiles?select=id&is_admin=eq.true&limit=1')).json())[0]
  const aH = { apikey: ANON, Authorization: `Bearer ${mint(admin.id)}`, 'Content-Type': 'application/json' }
  const status = await rpc('member_kiosk_pin_status', {}, aH)
  ok((status.body || []).some(m => m.member_no === 'ZZ-K2-A' && m.locked), 'the lockout is visible in the admin portal')
  ok(!JSON.stringify(status.body || []).includes('pin_hash'), 'the admin view never carries a hash')
  await rpc('clear_member_kiosk_lockout', { p_member_no: 'ZZ-K2-A' }, aH)
  await rest(`kiosk_devices?id=eq.${dev2[0].id}`, { method: 'DELETE' })

  // ═══ CHECK 5 — SESSION SCOPE ═══════════════════════════════════════════
  head('5 · session scope, binding and revocation')
  const SESS = (await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-K2-A', p_pin: '483902' })).body
  ok(typeof SESS === 'string', 'a session mints after the lockout is cleared')
  ok((await rpc('kiosk_member_session_live', { p_device_token: 'other-tablet', p_session_token: SESS })).body === false,
     'a token replayed off-device is refused')
  await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'PATCH', body: JSON.stringify({ revoked_at: new Date().toISOString() }) })
  ok((await rpc('kiosk_member_session_live', { p_device_token: DEVTOK, p_session_token: SESS })).body === false,
     'revoking the DEVICE kills the live member session')
  // …and the session ROW is closed by the next touch. session_live is deliberately
  // non-mutating (a redirect check must never alter session state), so the tidy-up
  // belongs to kiosk_member_touch — the gate every real member request goes through.
  await rpc('kiosk_member_touch', { p_device_token: DEVTOK, p_session_token: SESS })
  const ended = await (await rest(`kiosk_member_sessions?select=ended_reason&member_no=eq.ZZ-K2-A&order=created_at.desc&limit=1`)).json()
  ok(ended[0]?.ended_reason === 'device_revoked', 'and the session row records why', ended[0]?.ended_reason)
  await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'PATCH', body: JSON.stringify({ revoked_at: null }) })

  // ═══ CHECK 6 — THE BOARD ═══════════════════════════════════════════════
  head('6 · the board')
  const bd = (await rpc('kiosk_board', { p_device_token: DEVTOK })).body?.[0]
  ok(bd?.room === room, 'correct room')
  ok(new Date(bd.ends_at) > new Date(bd.starts_at), 'a 21:00–01:00 event ends after it starts')
  const raw = JSON.stringify(bd)
  ok(!raw.includes('SECRET ATTENDEE') && !raw.includes('member_no') && !raw.includes('attendee'),
     'NO PII in the underlying response, not merely absent from the screen')
  ok(Object.keys(bd).length === 10, 'the payload is exactly the ten declared columns', `${Object.keys(bd).length} keys`)
  await rest(`calendar_entries?id=eq.${made.entry}`, { method: 'PATCH', body: JSON.stringify({ show_on_board: false }) })
  ok((await rpc('kiosk_board', { p_device_token: DEVTOK })).body?.[0]?.state === 'no_event',
     'a room with nothing on falls back deliberately, not to an error')
  await rest(`calendar_entries?id=eq.${made.entry}`, { method: 'PATCH', body: JSON.stringify({ show_on_board: true }) })

  // ═══ CHECK 9 — THE PIN IS THE MEMBER'S ═════════════════════════════════
  head('9 · no admin path sets a PIN')
  const dropped = await rpc('set_member_kiosk_pin', { p_member_no: 'ZZ-K2-A', p_pin: '112233' }, aH)
  ok(dropped.status === 404 || /does not exist|not find/i.test(JSON.stringify(dropped.body || '')),
     'the old admin set-a-plaintext-PIN function is GONE', `HTTP ${dropped.status}`)
  await rpc('reset_member_kiosk_pin', { p_member_no: 'ZZ-K2-A' }, aH)
  const st2 = await rpc('my_kiosk_pin_state', {}, { apikey: ANON, Authorization: `Bearer ${mint(A)}`, 'Content-Type': 'application/json' })
  ok(st2.body?.[0]?.has_pin === false, 'admin reset leaves the member in no-PIN-set, with no value chosen for them')
  ok((await rpc('kiosk_member_login', { p_device_token: DEVTOK, p_member_no: 'ZZ-K2-A', p_pin: '483902' })).body === null,
     'a member with no PIN cannot sign in — and fails identically to everyone else')
  await rpc('set_my_kiosk_pin', { p_pin: '483902' }, { apikey: ANON, Authorization: `Bearer ${mint(A)}`, 'Content-Type': 'application/json' })

  // ═══ CHECKS 2, 8, 10 — HTTP ════════════════════════════════════════════
  head('2 · 8 · 10 — the mode boundary over HTTP')
  if (!serverUp) {
    skip('checks 2, 8, 10', `no dev server at ${APP} (start it, then re-run)`)
  } else {
    const jar = `trc_kiosk_device=${DEVTOK}`
    const staffBefore = await fetch(`${APP}/kiosk/staff`, { headers: { Cookie: jar }, redirect: 'manual' })
    ok(staffBefore.status === 200, 'baseline: with only a device cookie, /kiosk/staff is reachable', `HTTP ${staffBefore.status}`)

    const login = await fetch(`${APP}/api/kiosk/member/login`, {
      method: 'POST', headers: { Cookie: `${jar}; trc_kiosk_staff=some-staff-id`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_no: 'ZZ-K2-A', pin: '483902' }), redirect: 'manual',
    })
    const setCookies = login.headers.getSetCookie?.() || []
    const mc = setCookies.find(c => c.startsWith('trc_kiosk_member='))
    const sc = setCookies.find(c => c.startsWith('trc_kiosk_staff='))
    ok(login.status === 200 && !!mc, 'PIN mints a member session over HTTP', `HTTP ${login.status}`)
    // CHECK 2 — entering member mode provably clears staff session state
    ok(!!sc && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(sc),
       'CHECK 2: entering MEMBER mode destroys the staff cookie in the same response',
       sc ? sc.split(';')[0] + ' …expired' : 'no staff cookie directive')

    const memberCookie = mc.split(';')[0]
    // CHECK 8 — a back-gesture to /kiosk/staff is exactly this GET
    const back = await fetch(`${APP}/kiosk/staff`, { headers: { Cookie: `${jar}; ${memberCookie}` }, redirect: 'manual' })
    const loc = back.headers.get('location') || ''
    ok([302, 307, 308].includes(back.status) && loc.includes('/kiosk/board'),
       'CHECK 8: with a live member session, /kiosk/staff redirects to the board',
       `HTTP ${back.status} → ${loc || '(no redirect)'}`)

    // CHECK 10 — the greeting payload carries a first name and nothing else
    const me = await (await fetch(`${APP}/api/kiosk/member/me`, { headers: { Cookie: `${jar}; ${memberCookie}` } })).json()
    const keys = Object.keys(me.member || {}).sort()
    ok(JSON.stringify(keys) === JSON.stringify(['expires_at', 'first_name', 'palate', 'room']),
       'CHECK 10: the landing payload is exactly first_name · palate · room · expires_at', keys.join(', '))
    ok(me.member?.first_name === 'Zeta' && !JSON.stringify(me).includes('ZZ Test'),
       'first name only — the full name is never sent', me.member?.first_name)
    ok(!/credit|balance|visit|tier|member_no/i.test(JSON.stringify(me)),
       'no balance, no visit data, no tier, no membership number in the payload')

    const idf = await (await fetch(`${APP}/api/kiosk/member/identify`, {
      method: 'POST', headers: { Cookie: jar, 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: 'ZZ-NO-SUCH-CARD' }) })).json()
    ok(idf.found === false, 'identify on an unlinked card reveals nothing')
  }

  // ═══ CHECK 7 / 11 ══════════════════════════════════════════════════════
  head('7 · 11 — regressions and the idle clock')
  ok((await rpc('kiosk_device_active', { p_token: DEVTOK })).body === true, 'Phase 1 device session unbroken')
  const roster = await rpc('kiosk_staff_roster', {}, { apikey: ANON, Authorization: `Bearer ${mint(admin.id)}`, 'Content-Type': 'application/json' })
  ok(roster.status === 200 && Array.isArray(roster.body), 'Phase 1 staff roster unbroken', `${roster.body?.length ?? 0} staff`)
  if (serverUp) {
    const gated = await fetch(`${APP}/api/kiosk/staff/roster`, { redirect: 'manual' })
    ok(gated.status === 403, 'Phase 1 roster route still device-gated without a device cookie', `HTTP ${gated.status}`)
  }
  const src = readFileSync('app/kiosk/member/page.tsx', 'utf8')
  ok(/'scroll'/.test(src) && /'wheel'/.test(src) && /'touchmove'/.test(src),
     'CHECK 11: the idle clock resets on scroll and touch, not only navigation')
  console.log('  (the real check 11, and the cold overnight NFC tap, are the tablet eyeball)')

} catch (e) {
  console.log('\n✗ HARNESS ERROR —', e.message, '\n', e.stack?.split('\n')[1] || '')
  fails++
} finally {
  head('cleanup')
  for (const m of made.members) {
    for (const t of ['member_terms_consents', 'kiosk_member_sessions', 'member_pin_attempts', 'member_kiosk_pins', 'member_taste_profiles'])
      await rest(`${t}?member_no=eq.${m}`, { method: 'DELETE' })
  }
  if (made.entry) await rest(`calendar_entries?id=eq.${made.entry}`, { method: 'DELETE' })
  if (made.device) { await rest(`kiosk_member_sessions?device_id=eq.${made.device}`, { method: 'DELETE' }); await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'DELETE' }) }
  await rest(`kiosk_devices?label=like.ZZ-K2*`, { method: 'DELETE' })
  for (const m of made.members) await rest(`profiles?member_no=eq.${m}`, { method: 'PATCH', body: JSON.stringify({ member_no: null }) })
  for (const u of made.users) await fetch(`${U}/auth/v1/admin/users/${u}`, { method: 'DELETE', headers: svcH })
  for (const m of made.members) await rest(`members?member_no=eq.${m}`, { method: 'DELETE' })
  console.log('  ZZ-K2 fixtures removed')
}

console.log(fails === 0
  ? `\nPASS — ${skips ? skips + ' skipped, ' : ''}no failures.\n`
  : `\nFAIL — ${fails} check(s) failed${skips ? `, ${skips} skipped` : ''}.\n`)
process.exit(fails === 0 ? 0 : 1)
