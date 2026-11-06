// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT CASK MAP — selection that lets go, and labels that never collide.
//   node scripts/verify-tet-map.mjs
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-11-06, on /embassy/tet: tapping a distillery needed a second tap
// to clear, the region stuck, and names overlapped.
//
// Two root causes, both confirmed in the code before changing anything:
//   · the pin ran onRegion(region === pl.region ? null : pl.region) — so
//     tapping a DIFFERENT distillery in the SAME region CLEARED the selection
//     instead of moving it. Six sit within a few miles on Speyside, so that
//     was most taps.
//   · the label rendered for `on`, which is true for every distillery in the
//     chosen region — selecting Speyside printed six names on top of one
//     another.
//
// Guests read this on their own phones after scanning in, and there is no
// hover on a phone, so everything is driven by TAP here.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { chromium, devices } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const exp = String(Date.now() + 30 * 24 * 60 * 60 * 1000)
const tp = `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`
const B = process.env.BASE || 'http://localhost:3001'
// Same checks, either page — the two are forks of one component.
const PATH = process.env.MAP_PATH || '/embassy/tet'

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const br = await chromium.launch()
const open = async (ctxOpts) => {
  const c = await br.newContext(ctxOpts)
  await c.addCookies([{ name: 'trc_tet', value: tp, domain: 'localhost', path: '/' }])
  const p = await c.newPage()
  await p.goto(`${B}${PATH}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForTimeout(3500)
  await p.locator('.cm-map').scrollIntoViewIfNeeded()
  await p.waitForTimeout(600)
  return { c, p }
}
const labels = p => p.evaluate(() => [...document.querySelectorAll('.cm-label')]
  .map(e => { const r = e.getBoundingClientRect(); return { name: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height } }))
const overlaps = ls => { let n = 0
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
    const a = ls[i], b = ls[j]
    if (!(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)) n++
  } return n }

try {
  for (const [label, opts] of [['a phone (390px)', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }],
                               ['desktop (1280px)', { viewport: { width: 1280, height: 900 }, hasTouch: true }]]) {
    console.log(`\n── ${label}`)
    const { c, p } = await open(opts)
    const pins = p.locator('.cm-pin')
    const total = await pins.count()
    t(total > 1, '  the map drew its pins', `${total}`)

    // Nothing selected: no labels at all.
    t((await labels(p)).length === 0, '  nothing is labelled before a tap')

    // TAP ONE → selects, and names exactly one.
    await pins.nth(0).tap(); await p.waitForTimeout(400)
    const l1 = await labels(p)
    t(l1.length === 1, '  tapping a pin names exactly ONE distillery', `${l1.length} label(s)`)
    const first = l1[0]?.name
    t(await p.locator('.cm-card').count() === 1, '  and the card appears')

    // TAP A DIFFERENT ONE → replaces. This is the bug: it used to CLEAR.
    await pins.nth(1).tap(); await p.waitForTimeout(400)
    const l2 = await labels(p)
    t(l2.length === 1, '  tapping another REPLACES, it does not clear', `${l2.length} label(s)`)
    t(l2[0]?.name !== first, '  and it is a different distillery', `${first} → ${l2[0]?.name}`)

    // Still exactly one label even with a region active — the overlap fix.
    t(overlaps(await labels(p)) === 0, '  NO LABELS OVERLAP', `${(await labels(p)).length} on screen`)

    // THE ✕ dismisses.
    const x = p.locator('.cm-x')
    t(await x.count() === 1, '  there is an explicit ✕')
    await x.tap(); await p.waitForTimeout(400)
    t((await labels(p)).length === 0, '  ✕ clears the selection')

    // TAPPING EMPTY MAP dismisses.
    await pins.nth(2).tap(); await p.waitForTimeout(350)
    t((await labels(p)).length === 1, '  re-selected for the next test')
    // Click the backdrop ELEMENT, not a coordinate. Raw coordinates drift as
    // the page scrolls between steps, and a click that lands somewhere else
    // reports the feature broken when it is the test that missed.
    await p.locator('.cm-map rect').click({ position: { x: 5, y: 5 }, force: true })
    await p.waitForTimeout(400)
    t((await labels(p)).length === 0, '  tapping empty map space clears it')

    // ESC dismisses (desktop path, harmless on touch).
    await pins.nth(3).tap(); await p.waitForTimeout(350)
    await p.keyboard.press('Escape'); await p.waitForTimeout(400)
    t((await labels(p)).length === 0, '  Esc clears it')

    // The same pin twice still dismisses — the original path, kept.
    await pins.nth(0).tap(); await p.waitForTimeout(300)
    await pins.nth(0).tap(); await p.waitForTimeout(400)
    t((await labels(p)).length === 0, '  tapping the same pin twice still dismisses')
    await c.close()
  }
} finally { await br.close() }

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
