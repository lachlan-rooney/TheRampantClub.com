// ═══════════════════════════════════════════════════════════════════════════
// THE MEMBER'S OWN SCREEN ON A TABLET — six things the owner found wrong.
//   node scripts/verify-kiosk-member-view.mjs         (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-02, in the order he hit them:
//   · "it just says Good afternoon Mr to me"          → the name
//   · "a loading wheel or something ... after you enter your code"
//   · "EN/VN toggle oes nothing"
//   · "theres a this week twice, in yellow above the Nothing in thr diary"
//   · "theres also literally nothing on that oage when you log in it's shite"
//
// A THROWAWAY member with a card balance, a locker and a PIN, signed in through
// the real kiosk routes. Everything removed afterwards — a PIN or a balance
// written onto a real member_no is somebody's actual money.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, BASE = process.env.BASE || 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })
const admin = (p, i) => fetch(`${U}/auth/v1/admin/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }
// LOWER-CASED. The fact labels are text-transform: uppercase, so "Số dư thẻ"
// reaches the screen as "SỐ DƯ THẺ" — a case-sensitive check failed on the
// Vietnamese labels AND passed falsely on the English ones, because
// "On your card" is equally absent once it is uppercased.
const norm = s => s.replace(/\s+/g, ' ').trim()
const low = s => norm(s).toLowerCase()

// "Mr Rooney" is the shape that produced "Good afternoon Mr", so the throwaway
// wears the same shape: an honorific the greeting must step over.
const M = 'ZZ-KV', FULL = 'Mr Testerton', PIN = '715392', LABEL = 'ZZ-KV-DEV'
let uid, device
const wipe = async () => {
  await rest(`member_kiosk_pins?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`member_cards?member_number=eq.${M}`, { method: 'DELETE' })
  await rest(`lockers?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`member_taste_profiles?member_no=eq.${M}`, { method: 'DELETE' })
  if (uid) await rest(`tasting_notes?author=eq.${uid}`, { method: 'DELETE' })
  await rest(`kiosk_member_sessions?member_no=eq.${M}`, { method: 'DELETE' }).catch(() => {})
  if (uid) {
    await rest(`activity_events?actor=eq.${uid}`, { method: 'DELETE' })
    await rest(`profiles?id=eq.${uid}`, { method: 'DELETE' })
    await admin(`users/${uid}`, { method: 'DELETE' })
  }
  await rest(`members?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`kiosk_devices?label=eq.${LABEL}`, { method: 'DELETE' })
}
await wipe()

const ownerCookie = (() => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000), O = '3e1583db-b881-42ec-aadb-6f69a22fad80'
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: O, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
  const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: O, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  if (v.length <= 3180) return `sb-${ref}-auth-token=${v}`
  const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`)
  return ps.join('; ')
})()

let browser
try {
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: M, full_name: FULL, tier: 'Pioneer', status: 'Active' }) })
  const email = `zz-kv-${randomUUID().slice(0, 8)}@example.invalid`
  uid = (await (await admin('users', { method: 'POST', body: JSON.stringify({ email, password: `zz-${randomUUID()}`, email_confirm: true }) })).json()).id
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: uid, display_name: FULL, member_no: M, is_admin: false }) })
  // Things to actually show: a balance and a locker.
  await rest('member_cards', { method: 'POST', body: JSON.stringify({ member_number: M, credit_vnd: 2450000 }) })
  await rest('lockers', { method: 'POST', body: JSON.stringify({ locker_no: 'ZZ9', member_no: M, label: 'ZZ Test Oloroso' }) })
  // THEIR PIN, SET AS THEM. There is no admin setter by design — nobody at the
  // club can set or read a member's PIN, which is the whole point of it — so the
  // harness mints the member's own session and uses their own route, exactly as
  // the member would from the portal.
  const memberCookie = (() => {
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
    const now = Math.floor(Date.now() / 1000)
    const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
    const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
    const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {} } }
    const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
    if (v.length <= 3180) return `sb-${ref}-auth-token=${v}`
    const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`)
    return ps.join('; ')
  })()
  const pinRes = await fetch(`${BASE}/api/members/kiosk-pin`, { method: 'POST',
    headers: { cookie: memberCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: PIN }) })
  if (!pinRes.ok) console.log('   (PIN route said:', JSON.stringify(await pinRes.json().catch(() => ({}))), ')')
  const hasPin = await (await rest(`member_kiosk_pins?member_no=eq.${M}&select=member_no`)).json()
  t(Array.isArray(hasPin) && hasPin.length === 1, '1 · HARNESS: a throwaway member with a PIN, a balance and a locker',
    `pin row: ${Array.isArray(hasPin) ? hasPin.length : '?'}`)
  if (!hasPin.length) throw new Error('no PIN could be set — cannot sign in')

  const made = await (await fetch(`${BASE}/api/admin/kiosk-devices`, { method: 'POST', headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ label: LABEL, room: 'The Dining Room' }) })).json()
  const paired = await fetch(`${BASE}/api/kiosk/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: made.pair_code }) })
  device = ((paired.headers.getSetCookie?.() || []).find(c => c.startsWith('trc_kiosk_device=')) || '').split(';')[0].split('=')[1]

  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_kiosk_device', value: device, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  // Surface what the note route actually says — a silent failure here looks
  // identical to a slow one.
  p.on('response', async r => {
    if (!r.url().includes('/api/kiosk/member/note')) return
    let body = ''
    try { body = JSON.stringify(await r.json()) } catch { body = '(unreadable)' }
    console.log(`   [note route] ${r.status()} ${body}`)
  })
  await p.goto(`${BASE}/kiosk/member`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)

  // ── THE LOADING WHEEL ──────────────────────────────────────────────────
  const ins = await p.$$('input')
  await ins[0].fill('Testerton')
  await ins[1].fill(PIN)
  await p.waitForTimeout(600)
  await p.locator('button', { hasText: /Continue|Tiếp tục/ }).first().click()
  // Caught DURING the two requests, not after: busy used to clear between them.
  let sawSpinner = false
  for (let i = 0; i < 40; i++) {
    if (await p.$('.km-spin')) { sawSpinner = true; break }
    await p.waitForTimeout(25)
  }
  t(sawSpinner, '2 · a wheel turns while it signs you in')

  await p.waitForSelector('text=/Good (morning|afternoon|evening)/', { timeout: 20000 })
  const body = norm(await p.innerText('body'))
  const bodyL = body.toLowerCase()

  // ── THE NAME ───────────────────────────────────────────────────────────
  t(/Good (morning|afternoon|evening), Testerton/.test(body) && !/, Mr\b/.test(body),
    '3 · it greets them by NAME, stepping over the honorific',
    (body.match(/Good \w+, \S+/) || ['?'])[0])

  // ── SOMETHING ON THE PAGE ──────────────────────────────────────────────
  t(body.includes('2,450,000') && bodyL.includes('zz9'),
    '4 · the card balance and the locker are on it', `${body.includes('2,450,000') ? 'balance ✓' : 'balance ✗'} ${body.includes('ZZ9') ? 'locker ✓' : 'locker ✗'}`)
  t(/Flavour Finder/i.test(body), '4b · and with no palate yet, it says what fills it')

  // ── THE DUPLICATE HEADING ──────────────────────────────────────────────
  const weeks = (body.match(/this week/gi) || []).length
  t(weeks <= 1, '5 · "this week" is said once, not twice', `${weeks} occurrence(s)`)

  // ── THE TOGGLE ─────────────────────────────────────────────────────────
  const vnBtn = await p.$('button:text-is("VN")')
  t(!!vnBtn, '6 · the bar carries an EN/VN switch')
  if (vnBtn) {
    await vnBtn.click(); await p.waitForTimeout(1200)
    const vn = norm(await p.innerText('body'))
    const vnL = vn.toLowerCase()
    t(/Chào buổi (sáng|chiều|tối), Testerton/.test(vn), '6b · and the greeting turns over',
      (vn.match(/Chào buổi \S+, \S+/) || ['NOT TRANSLATED'])[0])
    t(vnL.includes('số dư thẻ') && vnL.includes('tủ khóa'), '6c · so do the labels',
      `${vnL.includes('số dư thẻ') ? 'balance ✓' : 'balance ✗'} ${vnL.includes('tủ khóa') ? 'locker ✓' : 'locker ✗'}`)
    t(!/chào buổi/.test(vnL) === false && !/good (morning|afternoon|evening)/.test(vnL) && !vnL.includes('on your card'),
      '6d · with no English left behind')
  }
  // ── THE LOOP: NOTE A DRAM, AND THE PALATE MOVES ─────────────────────────
  // The club has ZERO tasting notes, which is why every palate surface is
  // empty. This is the thing that fills them, and the test is not "a row was
  // written" — it is that the member's taste profile exists afterwards and the
  // radar appears on the same screen without a reload.
  const before = await (await rest(`member_taste_profiles?member_no=eq.${M}&select=source_count`)).json()
  t(Array.isArray(before) && before.length === 0, '7 · HARNESS: no palate to start with',
    `${before.length} profile row(s)`)
  const radarBefore = await p.$$eval('svg', s2 => s2.length)

  await p.locator('button', { hasText: /What are you drinking|Bạn đang uống gì/ }).first().click()
  await p.waitForTimeout(400)
  const shelfBox = p.locator('input.mp-field')
  await shelfBox.fill('glen')
  await p.waitForTimeout(900)
  const firstHit = p.locator('button.mp-hit').first()
  t(await firstHit.count() > 0, '8 · the shelf can be searched from the tablet',
    await firstHit.count() ? norm(await firstHit.innerText()).slice(0, 40) : 'no hits')
  await firstHit.click()
  await p.waitForSelector('.mp-done-t, .mp-err', { timeout: 20000 })
  const errTxt = await p.$('.mp-err') ? norm(await p.innerText('.mp-err')) : ''
  if (errTxt) console.log('   [screen said]', errTxt)
  const doneTxt = await p.$('.mp-done-t') ? norm(await p.innerText('.mp-done-t')) : ''
  // MATCHED IN BOTH LANGUAGES. The toggle was flipped to Vietnamese in check 6
  // and never flipped back, so an English-only assertion failed on a screen that
  // was working perfectly — and testing the pour flow in VN is worth more than
  // resetting it would have been.
  t(/Noted|Đã ghi/i.test(doneTxt), '9 · one tap logs it', doneTxt.slice(0, 48))

  const after = await (await rest(`member_taste_profiles?member_no=eq.${M}&select=source_count,vector`)).json()
  t(after.length === 1 && (after[0].source_count ?? 0) > 0,
    '10 · and the palate is DERIVED on the spot, not just a row written',
    after.length ? `source_count=${after[0].source_count}, families=${Object.keys(after[0].vector || {}).length}` : 'no profile')

  await p.waitForTimeout(2500)
  const radarAfter = await p.$$eval('svg', s2 => s2.length)
  t(radarAfter > radarBefore, '11 · and the radar appears on the same screen, no reload',
    `${radarBefore} → ${radarAfter} svg`)

  // Twice in an evening is not twice as much whisky.
  await p.locator('button', { hasText: /Note another|Ghi ly khác/ }).first().click()
  await p.waitForTimeout(300)
  await p.locator('input.mp-field').fill('glen')
  await p.waitForTimeout(900)
  await p.locator('button.mp-hit').first().click()
  await p.waitForSelector('.mp-done-t', { timeout: 20000 })
  const twice = norm(await p.innerText('.mp-done-t'))
  const notes = await (await rest(`tasting_notes?author=eq.${uid}&select=id`)).json()
  t(/Already|Đã ghi nhận/i.test(twice) && notes.length === 1, '12 · the same dram twice does not double-count it',
    `"${twice.slice(0, 32)}" · ${notes.length} note row(s)`)
} catch (e) {
  console.log('✗ THREW:', e?.message || e); fail++
} finally {
  if (browser) await browser.close()
  await wipe()
  const left = await (await rest(`members?member_no=eq.${M}&select=member_no`)).json()
  t(Array.isArray(left) && left.length === 0, 'it cleaned up after itself', left.length ? 'LEFT ROWS' : 'nothing left')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
