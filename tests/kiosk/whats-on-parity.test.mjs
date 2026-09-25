// ═══════════════════════════════════════════════════════════════════════════
// THE SAME LINE IN BOTH HANDS — What's On, portal vs room tablet.
//   node tests/kiosk/whats-on-parity.test.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: "It better look like the whats on in the portal when i
// look at it." The tablet's week was a 15px time, a 56px thumbnail and a line
// of text; the portal was a fixtures card — the date large down the left, the
// type in mono, a display-face title, the count and the sign-up at the foot.
//
// HOW THIS IS PROVED. Not by eye, and not by reading the CSS: both pages are
// rendered AT THE SAME WIDTH and the same computed values are read off each.
// The row's sizes are in vw, so the same window must give the same numbers on
// both surfaces — a value that drifts on one and not the other fails here.
//
// AND THE LAYOUT IS THE WIDE ONE. The tablet's week column is half a landscape
// screen, which no window-based media query can see, so the kiosk asks the
// COLUMN its own width instead. The last check squeezes the window until that
// column falls under the threshold and proves the stacked row takes over —
// the same fallback the portal uses on a phone.
//
// ⚠ IT CREATES A THROWAWAY MEMBER, DEVICE AND FIXTURE and removes all three at
// the end whether it passes or fails. The fixture is dated inside the tablet's
// seven-day window — it has to be, or the tablet would not show it — so it is
// titled as a test and given a capacity nobody could mistake for real.
//
// PROVEN AGAINST THE BROKEN VERSION: stash app/kiosk/member/page.tsx and
// app/api/kiosk/member/week/route.ts and every kiosk check here fails — the
// tablet has no .wo-row on it at all, and the count has nothing to read.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const OWNER = '3e1583db-b881-42ec-aadb-6f69a22fad80'   // the portal side, as a real session
const MEMBER_NO = 'ZZ-WO-A'
const TITLE = 'AUTOMATED TEST — ignore (whats on parity)'
const COPY = 'A throwaway fixture written by a test. Nobody is coming to it.'
const PIN = '519274'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const mint = sub => {
  const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 })}`
  return `${unsigned}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(unsigned).digest('base64url')}`
}
// The portal reads client-side under a real Supabase session cookie.
const jwt = mint(OWNER)
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const portalCookies = []
if (value.length > 3180) for (let i = 0, n = 0; i < value.length; i += 3180, n++) portalCookies.push({ name: `sb-${ref}-auth-token.${n}`, value: value.slice(i, i + 3180), domain: 'localhost', path: '/' })
else portalCookies.push({ name: `sb-${ref}-auth-token`, value, domain: 'localhost', path: '/' })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }
const head = s => console.log(`\n── ${s} ` + '─'.repeat(Math.max(0, 56 - s.length)))

const made = { fixture: null, user: null, device: null }
const b = await chromium.launch()
try {
  // ── the throwaway event, three days out so the tablet's week reaches it ──
  const when = new Date(Date.now() + 3 * 864e5)
  when.setUTCHours(5, 0, 0, 0)
  const mk = await (await rest('fixtures', {
    method: 'POST',
    body: JSON.stringify({ sport: 'other', type: 'social', title: TITLE, description: COPY,
                           date: when.toISOString(), location: 'Nowhere', max_signups: 8, is_full: false }),
  })).json()
  made.fixture = mk?.[0]?.id
  t(!!made.fixture, 'a throwaway fixture inside the seven-day window, capacity 8', made.fixture || JSON.stringify(mk).slice(0, 120))

  // ── the throwaway member, and a tablet for them to stand at ─────────────
  await rest('members', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ member_no: MEMBER_NO, full_name: 'Zeta Whatson', tier: 'Honorary', status: 'Active' }) })
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: svc,
    body: JSON.stringify({ email: 'zz-wo-a@example.invalid', password: 'zz-Test-Pass-4471', email_confirm: true }) })).json()
  made.user = u.id
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: u.id, display_name: 'Zeta Whatson', is_admin: false, member_no: MEMBER_NO }) })
  await fetch(`${U}/rest/v1/rpc/set_my_kiosk_pin`, { method: 'POST',
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${mint(u.id)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pin: PIN }) })

  const code = 'ZZW' + Math.random().toString(36).slice(2, 7).toUpperCase()
  const dev = await (await rest('kiosk_devices', { method: 'POST',
    body: JSON.stringify({ label: 'ZZ-WO', room: 'The Dining Room', pair_code: code, pair_expires_at: new Date(Date.now() + 18e5).toISOString() }) })).json()
  made.device = dev?.[0]?.id
  const DEV = await (await fetch(`${U}/rest/v1/rpc/kiosk_pair_device`, { method: 'POST', headers: svc, body: JSON.stringify({ p_code: code }) })).json()
  const login = await fetch(`${ORIGIN}/api/kiosk/member/login`, { method: 'POST',
    headers: { Cookie: `trc_kiosk_device=${DEV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_no: MEMBER_NO, pin: PIN }) })
  const MC = login.headers.getSetCookie().find(c => c.startsWith('trc_kiosk_member='))?.split(';')[0]
  t(login.status === 200 && !!MC, 'the throwaway member is signed in at the tablet', `HTTP ${login.status}`)

  // ── read the same values off each surface ───────────────────────────────
  // The properties are the row's whole visual language: the display face and
  // size of the date, the gold of the month, the face of the title, the
  // hairline under the line. Everything a "looks like" claim rests on.
  const measure = async (p, scope) => {
    const row = p.locator(`${scope} .wo-row`, { hasText: 'AUTOMATED TEST' }).first()
    await row.waitFor({ state: 'visible', timeout: 20000 })
    await row.scrollIntoViewIfNeeded()
    const css = (sel, props) => row.locator(sel).first().evaluate((el, ps) => {
      const s = getComputedStyle(el); return Object.fromEntries(ps.map(k => [k, s[k]]))
    }, props)
    return {
      text: (await row.innerText()).replace(/\s+/g, ' '),
      day: await css('.wo-day', ['fontFamily', 'fontSize', 'lineHeight']),
      mon: await css('.wo-mon', ['fontFamily', 'fontSize', 'color', 'letterSpacing', 'textTransform']),
      wd: await css('.wo-wd', ['fontSize', 'textTransform']),
      type: await css('.wo-type', ['fontFamily', 'fontSize', 'letterSpacing', 'textTransform']),
      dot: await css('.wo-type i', ['width', 'height', 'borderRadius']),
      title: await css('.wo-title', ['fontFamily', 'fontSize', 'lineHeight']),
      count: await css('.wo-count-n', ['fontFamily', 'fontSize']),
      bar: await css('.wo-bar', ['width', 'height']),
      btn: await css('.wo-btn', ['fontFamily', 'fontSize', 'color', 'textTransform', 'borderBottomColor']),
      rowCss: await row.evaluate(el => { const s = getComputedStyle(el)
      return { borderBottom: s.borderBottomWidth + ' ' + s.borderBottomColor, display: s.display, cols: s.gridTemplateColumns } }),
    }
  }

  // THE PORTAL, at the tablet's own window size.
  const pc = await b.newContext({ viewport: { width: 1280, height: 1000 } })
  await pc.addCookies(portalCookies)
  const pp = await pc.newPage()
  await pp.goto(`${ORIGIN}/members/events`, { waitUntil: 'networkidle', timeout: 120000 })
  await pp.waitForTimeout(2500)
  const portal = await measure(pp, 'body')

  // THE TABLET, landscape, as one stands on the bar.
  const kc = await b.newContext({ viewport: { width: 1280, height: 800 } })
  await kc.addCookies([
    { name: 'trc_kiosk_device', value: DEV, domain: 'localhost', path: '/' },
    { name: 'trc_kiosk_member', value: MC.split('=')[1], domain: 'localhost', path: '/' },
  ])
  const kp = await kc.newPage(); const errs = []
  kp.on('pageerror', e => errs.push(e.message))
  await kp.goto(`${ORIGIN}/kiosk/member`, { waitUntil: 'networkidle', timeout: 120000 })
  await kp.waitForTimeout(2500)
  const kiosk = await measure(kp, '.wo-kiosk')

  head('the line is set the same way in both hands')
  const same = (k, prop) => t(portal[k][prop] === kiosk[k][prop], `${k}.${prop}`, `portal ${portal[k][prop]} · kiosk ${kiosk[k][prop]}`)
  same('day', 'fontFamily'); same('day', 'fontSize'); same('day', 'lineHeight')
  same('mon', 'color'); same('mon', 'fontSize'); same('mon', 'letterSpacing'); same('mon', 'textTransform')
  same('wd', 'fontSize'); same('wd', 'textTransform')
  same('type', 'fontFamily'); same('type', 'fontSize'); same('type', 'letterSpacing'); same('type', 'textTransform')
  same('dot', 'width'); same('dot', 'borderRadius')
  same('title', 'fontFamily'); same('title', 'fontSize'); same('title', 'lineHeight')
  same('count', 'fontFamily'); same('count', 'fontSize')
  same('bar', 'width'); same('bar', 'height')
  same('btn', 'color'); same('btn', 'borderBottomColor'); same('btn', 'textTransform')
  t(portal.rowCss.borderBottom === kiosk.rowCss.borderBottom, 'the hairline under the line', `portal ${portal.rowCss.borderBottom} · kiosk ${kiosk.rowCss.borderBottom}`)
  t(portal.rowCss.display === 'grid' && kiosk.rowCss.display === 'grid', 'both are the same grid, not a flex row')
  t(/^124px/.test(portal.rowCss.cols) && /^124px/.test(kiosk.rowCss.cols),
    'the date is set down the LEFT on both, not stacked above', `portal ${portal.rowCss.cols} · kiosk ${kiosk.rowCss.cols}`)

  head('and it says the same things')
  for (const [label, re] of [
    ['the capacity, 0 of 8', /0\/8/],
    ['the type, in words', /social/i],
    ['the event copy', /throwaway fixture written by a test/i],
    ['a way to put your name down', /sign me up|put my name down/i],
  ]) t(re.test(portal.text), `portal: ${label}`, portal.text.slice(0, 70))
  for (const [label, re] of [
    ['the capacity, 0 of 8', /0\/8/],
    ['the type, in words', /social/i],
    ['the event copy', /throwaway fixture written by a test/i],
    ['a way to put your name down', /put my name down/i],
    ['and in Vietnamese too', /tham gia/i],
  ]) t(re.test(kiosk.text), `kiosk: ${label}`, kiosk.text.slice(0, 70))
  t(errs.length === 0, 'no page error on the tablet', errs.join(' | '))

  // ── and the button still does what it says ──────────────────────────────
  head('the sign-up still works from the tablet')
  const joinRow = kp.locator('.wo-kiosk .wo-row', { hasText: 'AUTOMATED TEST' }).first()
  await joinRow.locator('.wo-btn').click()
  await kp.waitForTimeout(2500)
  const after = (await joinRow.innerText()).replace(/\s+/g, ' ')
  t(/you.?re in|đã đăng ký/i.test(after), "the row flips to You're in", after.slice(0, 80))
  t(/1\/8/.test(after), 'and the count moves to 1/8', after.slice(0, 80))

  // ── and it folds when the column runs out, like the portal on a phone ────
  head('the column, squeezed')
  await kp.setViewportSize({ width: 900, height: 800 })
  await kp.waitForTimeout(600)
  const folded = await joinRow.evaluate(el => getComputedStyle(el).gridTemplateColumns)
  const dayNow = await joinRow.locator('.wo-day').evaluate(el => getComputedStyle(el).fontSize)
  t(!/^124px/.test(folded), 'the date lies across the top once the column is under 620px', folded)
  t(dayNow === '54px', 'and the date takes the smaller size, as the portal does on a phone', dayNow)
} catch (e) {
  t(false, 'HARNESS ERROR', e.message.split('\n')[0])
} finally {
  head('cleanup')
  for (let i = 0; i < 5; i++) {
    try {
      if (made.fixture) { await rest(`fixture_signups?fixture_id=eq.${made.fixture}`, { method: 'DELETE' }); await rest(`fixtures?id=eq.${made.fixture}`, { method: 'DELETE' }) }
      for (const tb of ['kiosk_member_sessions', 'member_pin_attempts', 'member_kiosk_pins'])
        await rest(`${tb}?member_no=eq.${MEMBER_NO}`, { method: 'DELETE' })
      if (made.device) { await rest(`kiosk_member_sessions?device_id=eq.${made.device}`, { method: 'DELETE' }); await rest(`kiosk_devices?id=eq.${made.device}`, { method: 'DELETE' }) }
      if (made.user) await fetch(`${U}/auth/v1/admin/users/${made.user}`, { method: 'DELETE', headers: svc })
      await rest(`members?member_no=eq.${MEMBER_NO}`, { method: 'DELETE' })
      const left = await (await rest(`fixtures?id=eq.${made.fixture}&select=id`)).json()
      if (!Array.isArray(left) || left.length === 0) { console.log('  ZZ-WO fixtures removed'); break }
    } catch { await new Promise(r => setTimeout(r, 1500)) }
  }
  await b.close()
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
