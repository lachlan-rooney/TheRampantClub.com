// ═══════════════════════════════════════════════════════════════════════════
// THE ADMIN MENU ON A TABLET — it must take a finger.
//   node tests/admin/nav-tablet.test.mjs            (dev server on :3001)
//   node tests/admin/nav-tablet.test.mjs --live     (therampantclub.com)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-23: "When you go on to the tablet to use the admin portal you
// cannot scroll or click anything on the Admin menu. It's fucked."
//
// WHAT WAS WRONG. Below 1024px the sidebar becomes a drawer over the page,
// with a scrim behind it at z-index 9050. The drawer's rule says 9100 — but
// its z-index was ALSO set inline (zIndex: 100 in navWrap), and an inline
// value beats a stylesheet rule that is not !important. So the scrim sat on
// top of the open menu: every tap and every swipe landed on the scrim, which
// does nothing but close it. Measured on the live site before the fix:
// elementFromPoint in the middle of the open drawer returned DIV.adm-scrim,
// and a full-height swipe moved the menu 0 pixels.
//
// So these checks are about POINTER REACH, not about looks:
//   · the open drawer is above the scrim, and the thing under your finger in
//     the middle of it belongs to the menu;
//   · a swipe scrolls the menu (it is 1584px of links in a 550px window);
//   · a tap on a link actually navigates;
//   · rows are at least 44px on touch, and the desktop sidebar is unchanged.
//
// Uses a minted admin session (HS256 via SUPABASE_JWT_SECRET) — the same trick
// as the other admin UI tests.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const LIVE = process.argv.includes('--live')
const ORIGIN = LIVE ? 'https://therampantclub.com' : 'http://localhost:3001'
const DOMAIN = LIVE ? 'therampantclub.com' : 'localhost'
const ADMIN = '3e1583db-b881-42ec-aadb-6f69a22fad80'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const payload = { sub: ADMIN, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} }
const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
const token = `${unsigned}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(unsigned).digest('base64url')}`
const session = { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: ADMIN, aud: 'authenticated', role: 'authenticated', email: payload.email, app_metadata: {}, user_metadata: {} } }
const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\./)[1]
const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const cookies = []
if (value.length > 3180) for (let i = 0, n = 0; i < value.length; i += 3180, n++) cookies.push({ name: `sb-${ref}-auth-token.${n}`, value: value.slice(i, i + 3180), domain: DOMAIN, path: '/' })
else cookies.push({ name: `sb-${ref}-auth-token`, value, domain: DOMAIN, path: '/' })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

/** A real finger: CDP touch events, not mouse events with a touch flag. */
async function swipe(p, x, y0, y1) {
  const c = await p.context().newCDPSession(p)
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
  for (let i = 1; i <= 10; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / 10 }] })
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(700)
}

const b = await chromium.launch()
const scrollTop = p => p.evaluate(() => { const s = document.querySelector('.adm-nav div[style*="overflow"]'); return s ? Math.round(s.scrollTop) : null })

for (const [w, h, label] of [[1024, 768, 'tablet landscape'], [800, 1280, 'tablet portrait']]) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto(`${ORIGIN}/admin`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(1200)

  t(await p.locator('.adm-burger').isVisible(), `${label}: the menu button is there`)
  await p.touchscreen.tap(34, 34); await p.waitForTimeout(800)

  const reach = await p.evaluate(() => {
    const nav = document.querySelector('.adm-nav'), scrim = document.querySelector('.adm-scrim')
    const r = nav.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, Math.round(innerHeight / 2))
    return {
      open: nav.classList.contains('is-open'),
      navZ: +getComputedStyle(nav).zIndex, scrimZ: +getComputedStyle(scrim).zIndex,
      under: el ? el.closest('.adm-nav') !== null : false,
      what: el ? `${el.tagName}.${el.className}`.slice(0, 40) : null,
    }
  })
  t(reach.open && reach.navZ > reach.scrimZ && reach.under,
    `${label}: the open menu is above its own scrim, and takes the touch`,
    `nav ${reach.navZ} vs scrim ${reach.scrimZ}, finger lands on ${reach.what}`)

  const before = await scrollTop(p)
  await swipe(p, 120, h - 140, 160)
  const after = await scrollTop(p)
  t(after > before + 200, `${label}: a swipe scrolls the menu`, `${before} → ${after}`)
  t(await p.evaluate(() => document.querySelector('.adm-nav').classList.contains('is-open')),
    `${label}: and scrolling it does not close it`)

  const target = await p.evaluate(() => {
    const links = [...document.querySelectorAll('.adm-nav a')]
      .filter(a => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.top > 70 && r.bottom < innerHeight - 10 })
    const a = links[links.length - 2]; if (!a) return null
    const r = a.getBoundingClientRect()
    return { href: a.getAttribute('href'), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: a.textContent.trim(), h: Math.round(r.height) }
  })
  t(!!target && target.h >= 44, `${label}: rows are at least a fingertip tall`, `${target?.h}px`)
  if (target) {
    await p.touchscreen.tap(target.x, target.y)
    await p.waitForTimeout(3000)
    t(new URL(p.url()).pathname === target.href, `${label}: tapping a link goes there`, `${target.text} → ${new URL(p.url()).pathname}`)
  }
  t(errs.length === 0, `${label}: no page errors`, errs.slice(0, 2).join(' | '))
  await ctx.close()
}

// The desktop sidebar must be exactly as it was: always there, no scrim, no
// drawer — the fix moved a z-index, it did not move the furniture.
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage()
  await p.goto(`${ORIGIN}/admin`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(1000)
  const d = await p.evaluate(() => {
    const nav = document.querySelector('.adm-nav')
    return {
      x: Math.round(nav.getBoundingClientRect().x), z: +getComputedStyle(nav).zIndex,
      burger: getComputedStyle(document.querySelector('.adm-burger')).display,
      main: Math.round(parseFloat(getComputedStyle(document.querySelector('.adm-main')).marginLeft)),
    }
  })
  t(d.x === 0 && d.z === 100 && d.burger === 'none' && d.main === 240,
    'desktop: the sidebar is still pinned open at z-index 100, no menu button', JSON.stringify(d))
  await ctx.close()
}

await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
