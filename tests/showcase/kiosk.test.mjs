// ═══════════════════════════════════════════════════════════════════════════
// THE SHOWCASE KIOSK — real menus, no kitchen behind it.
//   node tests/showcase/kiosk.test.mjs             (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: "Can you give me a fake kiosk URL to share with shawn so
// that he can see how it works? It will just be a showcase version and not a
// real kiosk."
//
// The check that matters is the last one: an order built and confirmed in the
// showcase writes NO row to menu_orders. A demonstration that can ring the
// kitchen is not a demonstration, and a flag saying "demo mode" is a weaker
// promise than having no endpoint to call.
//
// It reads only, and mints its own passes — it enrols no device and touches no
// real kiosk.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
const mint = ms => {
  const e = String(Date.now() + ms)
  return `${e}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(e).digest('base64url')}`
}

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }
const orderCount = async () => (await (await fetch(`${U}/rest/v1/menu_orders?select=id`, { headers: svc })).json()).length

const before = await orderCount()
const b = await chromium.launch()
try {
  // ── THE DOOR ────────────────────────────────────────────────────────────
  {
    const p = await (await b.newContext()).newPage()
    await p.goto(`${ORIGIN}/showcase/kiosk`, { waitUntil: 'networkidle', timeout: 120000 })
    const txt = await p.locator('body').innerText()
    t(/run out|own link/i.test(txt) && !/Cure & Pickle/.test(txt), 'without a link there is no showcase', txt.replace(/\s+/g, ' ').slice(0, 70))
    t(await p.evaluate(async () => (await fetch('/api/showcase/menus')).status) === 403, 'and the data route refuses too')
    await p.goto(`${ORIGIN}/showcase/kiosk/enter?k=${mint(-1000)}`, { waitUntil: 'networkidle' })
    t(/run out/i.test(await p.locator('body').innerText()), 'an expired pass opens nothing')
    await p.goto(`${ORIGIN}/showcase/kiosk/enter?k=${mint(864e5)}x`, { waitUntil: 'networkidle' })
    t(/run out/i.test(await p.locator('body').innerText()), 'and a pass with a tampered signature opens nothing')
  }

  // ── INSIDE ──────────────────────────────────────────────────────────────
  const ctx = await b.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true })
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto(`${ORIGIN}/showcase/kiosk/enter?k=${mint(60 * 864e5)}`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(2800)
  t(p.url().endsWith('/showcase/kiosk'), 'the pass moves into a cookie and leaves the URL clean', p.url())

  const band = await p.locator('.sk-band').innerText().catch(() => '')
  t(/showcase/i.test(band) && /reaches the kitchen/i.test(band), 'a standing banner says what it is', band.replace(/\s+/g, ' ').slice(0, 80))

  const tiles = await p.$$eval('.mb-tile', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 44)))
  t(tiles.length >= 5, 'the live menus are on it', `${tiles.length} tiles`)
  t(tiles.some(x => /opens|until|last orders/i.test(x)), 'with the real opening hours beside them',
    tiles.find(x => /opens|until/i.test(x)) || '')

  // ── A TRAY THAT GOES NOWHERE ────────────────────────────────────────────
  await p.locator('.mb-tile:not([disabled])').filter({ hasText: /Cure & Pickle|Livannah|FUJIYAMA/ }).first().tap()
  await p.waitForTimeout(900)
  await p.locator('.mb-drawer .mb-step-btn').last().tap()
  await p.waitForTimeout(600)
  const cta = p.locator('button').filter({ hasText: /confirm|xác nhận|send|gửi/i }).first()
  await cta.scrollIntoViewIfNeeded(); await cta.tap(); await p.waitForTimeout(1200)
  const tray = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
  t(/service/i.test(tray) && /vat/i.test(tray), 'the tray shows the club’s own breakdown', (tray.match(/incl[^A-Z]{0,40}/i) || [''])[0])
  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))

  t(await orderCount() === before, 'AND NOT ONE ORDER ROW WAS WRITTEN', `${before} → ${await orderCount()}`)
} finally {
  await b.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
