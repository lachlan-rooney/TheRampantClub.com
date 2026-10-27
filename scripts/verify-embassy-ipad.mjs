// ═══════════════════════════════════════════════════════════════════════════
// THE EMBASSY PAGE ON THE KIOSK iPAD — WebKit, at real iPad sizes.
//   node scripts/verify-embassy-ipad.mjs            (defaults to PRODUCTION)
//   BASE=http://localhost:3001 node scripts/verify-embassy-ipad.mjs
// ───────────────────────────────────────────────────────────────────────────
// Everything else about this page was checked in CHROMIUM. The kiosk iPad runs
// WebKit, which is a different browser — not a skin. Things that work in
// Chrome and have historically bitten on iOS Safari, all of which this page
// uses:
//
//   · position: sticky inside a scrolling ancestor
//   · backdrop-filter (the tab bar)
//   · the `hidden` attribute on a flex/grid child
//   · accent-color on a checkbox
//   · gap on flexbox
//   · 100vh, which on iOS includes the browser chrome and clips the bottom
//   · a tap that needs a real touch, not a synthetic click
//
// So this runs the actual journey a guest makes, in WebKit, at the viewport
// sizes of the iPads the club owns, in both orientations.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { webkit, devices } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const BASE = process.env.BASE || 'https://therampantclub.com'
const HOST = new URL(BASE).hostname
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const tetPass = (() => {
  const exp = String(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`
})()

// The CSS viewports of the iPads a club actually has on a table.
const IPADS = [
  { name: 'iPad 10.2" landscape', width: 1080, height: 810 },
  { name: 'iPad 10.2" portrait',  width: 810,  height: 1080 },
  { name: 'iPad Air/11" landscape', width: 1180, height: 820 },
  { name: 'iPad Air/11" portrait',  width: 820,  height: 1180 },
  { name: 'iPad mini portrait',     width: 744,  height: 1133 },
]

console.log(`\nWebKit, against ${BASE}\n`)
const browser = await webkit.launch()
const cleanup = []
try {
  for (const d of IPADS) {
    console.log(`── ${d.name}  ${d.width}x${d.height}`)
    const ctx = await browser.newContext({
      viewport: { width: d.width, height: d.height },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: devices['iPad (gen 7)'].userAgent,
    })
    await ctx.addCookies([{ name: 'trc_tet', value: tetPass, domain: HOST, path: '/' }])
    const p = await ctx.newPage()
    const resp = await p.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    t(resp?.status() === 200, `  loads`, `${resp?.status()}`)
    await p.waitForTimeout(3000)

    // Nothing may scroll sideways on a tablet standing on a table.
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    t(over <= 1, `  no sideways scroll`, `${over}px`)

    // The tab bar must be ON SCREEN and TAPPABLE, not merely in the DOM.
    const bar = await p.locator('.et-bar').boundingBox()
    t(!!bar && bar.y >= 0 && bar.x >= 0 && bar.y < d.height, `  the tab bar is on screen`,
      bar ? `at ${Math.round(bar.x)},${Math.round(bar.y)}` : 'NOT FOUND')
    // elementFromPoint is the only honest answer to "can a finger hit it".
    const hitsTab = bar ? await p.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!(el && el.closest('.et-bar'))
    }, { x: bar.x + bar.width - 20, y: bar.y + bar.height / 2 }) : false
    t(hitsTab, `  and a tap lands on it, not on something over it`)

    // The language switch must not sit under the tab bar.
    const lang = await p.locator('.lt, [class*="lang"]').first().boundingBox().catch(() => null)
    if (lang && bar) {
      const overlap = !(lang.x > bar.x + bar.width || lang.x + lang.width < bar.x ||
                        lang.y > bar.y + bar.height || lang.y + lang.height < bar.y)
      t(!overlap, `  the tab bar and language switch do not overlap`)
    }

    // THE JOURNEY: tap through to the form with a real touch.
    await p.locator('.et-tab').nth(1).tap()
    await p.waitForTimeout(700)
    t((await p.innerText('body')).toLowerCase().includes('keep in touch'), `  tapping tab 2 opens the list`)

    // Every control must be reachable AND big enough for a finger.
    const small = await p.evaluate(() => {
      const out = []
      document.querySelectorAll('.es-chip, .es-go, .es-input, .es-consent input').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.height < 40) out.push(`${el.className || el.type}:${Math.round(r.height)}px`)
      })
      return out
    })
    t(small.length === 0, `  every control is at least 40px tall`, small.length ? small.join(', ') : 'all fine')

    // The submit button must be reachable without the keyboard hiding it.
    await p.locator('.es-go').scrollIntoViewIfNeeded()
    await p.waitForTimeout(300)
    const go = await p.locator('.es-go').boundingBox()
    const goHit = go ? await p.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!(el && el.closest('.es-go'))
    }, { x: go.x + go.width / 2, y: go.y + go.height / 2 }) : false
    t(goHit, `  the Join button is tappable, nothing covering it`)

    // The consent box must respond to a TAP (iOS ignores some click handlers).
    const cb = p.locator('.es-consent input[type="checkbox"]')
    t(await cb.isChecked() === false, `  consent starts unticked`)
    await p.locator('.es-consent').tap()
    await p.waitForTimeout(250)
    t(await cb.isChecked() === true, `  and a tap ticks it`)

    await ctx.close()
    console.log('')
  }

  // ── A WHOLE SIGN-UP, IN WEBKIT, ON ONE iPAD ────────────────────────────
  console.log('── a complete sign-up in WebKit')
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: devices['iPad (gen 7)'].userAgent,
  })
  await ctx.addCookies([{ name: 'trc_tet', value: tetPass, domain: HOST, path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForTimeout(3000)
  await p.locator('.et-tab').nth(1).tap()
  await p.waitForTimeout(700)
  const EMAIL = `zz-ipad-${randomUUID().slice(0, 8)}@example.invalid`
  await p.fill('#es-name', 'Zz iPad Check')
  await p.fill('#es-email', EMAIL)
  await p.locator('.es-chip').nth(2).tap()
  await p.locator('.es-consent').tap()
  await p.locator('.es-go').tap()
  await p.waitForTimeout(2500)
  t((await p.innerText('body')).toLowerCase().includes('thank you'), '  it saves from an iPad')
  const rows = await (await fetch(`${U}/rest/v1/embassy_signups?email_key=eq.${EMAIL.toLowerCase()}&select=id,interests`, { headers: svc })).json()
  t(Array.isArray(rows) && rows.length === 1, '  and the row is in the live table', `${rows.length ?? '?'}`)
  cleanup.push(EMAIL.toLowerCase())
  await ctx.close()

  // ── THE DOOR, as staff will meet it ────────────────────────────────────
  console.log('\n── the password screen on an iPad')
  const bare = await browser.newContext({
    viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: devices['iPad (gen 7)'].userAgent,
  })
  const bp = await bare.newPage()
  await bp.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await bp.waitForTimeout(1500)
  const over2 = await bp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  t(over2 <= 1, '  the door does not scroll sideways', `${over2}px`)
  const fields = await bp.locator('input').count()
  t(fields > 0, '  it has somewhere to type the password', `${fields} field(s)`)
  await bare.close()
} finally {
  await browser.close()
  for (const e of cleanup) {
    await fetch(`${U}/rest/v1/embassy_signups?email_key=eq.${e}`, { method: 'DELETE', headers: svc })
  }
  if (cleanup.length) console.log(`\n(cleaned up ${cleanup.length} test row)`)
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
