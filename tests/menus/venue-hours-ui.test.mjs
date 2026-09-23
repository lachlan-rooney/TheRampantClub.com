// ═══════════════════════════════════════════════════════════════════════════
// A KITCHEN THAT HAS CLOSED — on the tablet, and at the server.
//   node tests/menus/venue-hours-ui.test.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// tests/menus/hours.test.mjs pins the arithmetic. This proves the consequence:
// a restaurant whose last orders have passed cannot be ordered from — not by
// tapping, and not by posting straight at the API with a stale page.
//
// ⚠ IT WRITES HOURS TO A REAL RESTAURANT for a few seconds, because that is
// the only way to test the real gate: a window of 02:00–02:30 every day, which
// is closed at any sane hour, then deleted again in `finally` whether the test
// passes or fails. It picks the restaurant with the FEWEST dishes so that, if
// this ever ran during service, the smallest possible menu is affected. It
// writes no orders to a real room: those go to Source & Origin Lab, which has
// no tablet in it.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const ROOM = 'Source & Origin Lab'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

const token = 'test-' + randomBytes(16).toString('hex')
let deviceId = null, venue = null, orderId = null

async function cleanup() {
  if (venue) await rest(`menu_venue_hours?venue_id=eq.${venue.id}`, { method: 'DELETE' })
  if (orderId) {
    await rest(`menu_order_lines?order_id=eq.${orderId}`, { method: 'DELETE' })
    await rest(`menu_orders?id=eq.${orderId}`, { method: 'DELETE' })
  }
  if (deviceId) await rest(`kiosk_devices?id=eq.${deviceId}`, { method: 'DELETE' })
}

const b = await chromium.launch()
try {
  // The smallest live menu, so the blast radius is as small as it can be.
  const items = await (await rest('menu_items?select=id,name_en,venue_id&is_active=eq.true&price_vnd=not.is.null&service=eq.plate')).json()
  const venues = await (await rest('menu_venues?select=id,name,slug&is_active=eq.true')).json()
  const counts = new Map()
  for (const i of items) counts.set(i.venue_id, (counts.get(i.venue_id) ?? 0) + 1)
  const pick = [...counts.entries()].sort((a, b2) => a[1] - b2[1])[0]
  venue = venues.find(v => v.id === pick[0])
  const dish = items.find(i => i.venue_id === venue.id)
  t(!!venue && !!dish, `a live restaurant to test with: ${venue?.name} (${pick?.[1]} dishes)`)

  const had = await (await rest(`menu_venue_hours?venue_id=eq.${venue.id}&select=id`)).json()
  t(had.length === 0, 'it has no hours of its own to disturb', `${had.length} rows`)

  deviceId = (await (await rest('kiosk_devices', {
    method: 'POST',
    body: JSON.stringify({ label: ROOM, room: ROOM, purpose: 'room', token_hash: createHash('sha256').update(token).digest('hex'), enrolled_at: new Date().toISOString() }),
  })).json())[0].id

  // ── OPEN: no hours at all must not shut anything ────────────────────────
  const ctx = await b.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_kiosk_device', value: token, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  const tile = () => p.locator('.mb-tile', { has: p.locator(`text=${venue.name}`) }).first()
  const openIt = async () => {
    await p.goto(`${ORIGIN}/kiosk/menu`, { waitUntil: 'networkidle', timeout: 120000 })
    await p.waitForTimeout(2200)
    await p.locator('.mb-tile:not([disabled])').filter({ hasText: new RegExp(venue.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first()
      .tap().catch(async () => { await p.locator('.mb-tile:not([disabled])').first().tap() })
    await p.waitForTimeout(800)
  }
  await openIt()
  t(await p.locator('.mb-drawer .mb-step-btn').count() > 0, 'with no hours set, its dishes can be added')

  // ── CLOSED: a window at 02:00–02:30, every day ──────────────────────────
  await rest('menu_venue_hours', {
    method: 'POST',
    body: JSON.stringify([0, 1, 2, 3, 4, 5, 6].map(weekday => ({ venue_id: venue.id, weekday, opens_at: '02:00', last_order_at: '02:30' }))),
  })

  await p.goto(`${ORIGIN}/kiosk/menu`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2200)
  const card = await tile().evaluate(el => ({ text: el.textContent, shut: el.className.includes('is-shut') })).catch(() => null)
  t(!!card?.shut && /closed/i.test(card.text || ''), 'the tile says the kitchen is closed', JSON.stringify(card?.text?.slice(0, 80)))
  t(/opens 02:00/i.test(card?.text || ''), 'and when it opens again', card?.text?.slice(0, 80))

  await tile().tap(); await p.waitForTimeout(800)
  t(await p.locator('.mb-drawer').count() === 1, 'its menu still opens — a member may be reading it')
  t(await p.locator('.mb-drawer .mb-step-btn').count() === 0, 'but nothing on it can be added to an order')

  // ── AND THE SERVER REFUSES, whatever the tablet does ────────────────────
  const r = await fetch(`${ORIGIN}/api/kiosk/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `trc_kiosk_device=${token}` },
    body: JSON.stringify({ lines: [{ item_id: dish.id, qty: 1 }], note: 'AUTOMATED TEST — ignore' }),
  })
  const j = await r.json().catch(() => ({}))
  orderId = j?.order?.id ?? null
  t(r.status === 400 && /stopped taking orders/i.test(j.error || ''),
    'posting it straight at the API is refused too', `${r.status} ${JSON.stringify(j).slice(0, 120)}`)

  // ── OPEN AGAIN once the hours are removed ───────────────────────────────
  await rest(`menu_venue_hours?venue_id=eq.${venue.id}`, { method: 'DELETE' })
  await openIt()
  t(await p.locator('.mb-drawer .mb-step-btn').count() > 0, 'removing the hours makes it orderable again')
  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
} finally {
  await cleanup()
  const left = await (await rest(`menu_venue_hours?venue_id=eq.${venue?.id ?? '00000000-0000-0000-0000-000000000000'}&select=id`)).json().catch(() => [])
  t(Array.isArray(left) && left.length === 0, 'the test hours are gone from that restaurant', JSON.stringify(left))
  await b.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
