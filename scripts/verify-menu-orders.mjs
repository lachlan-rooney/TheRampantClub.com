#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MENU ORDERS — THE ROUND TRIP I COULD NOT DO WHEN I BUILT IT
// ───────────────────────────────────────────────────────────────────────────
// The ordering route shipped type-checked and built but never once exercised
// against the database, because the tables did not exist until today. This
// proves the invariants that would actually hurt in service.
//
// It works on a THROWAWAY room ("__verify__"), never a real one, and deletes
// everything it made — including on failure.
//
//   node scripts/verify-menu-orders.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const SVC = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }
const ANON = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
const ROOM = '__verify__'

const rest = (path, init = {}) => fetch(`${U}/rest/v1/${path}`, { headers: SVC, ...init })
let fails = 0
const check = (ok, label, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`); if (!ok) fails++ }

const cleanup = async () => {
  await rest(`menu_orders?room=eq.${ROOM}`, { method: 'DELETE' })
}

try {
  await cleanup()
  console.log('\n── Menu orders round trip ───────────────────────────────────\n')

  // 0 · Real, orderable dishes to work from. A probe against an empty menu
  //     would pass everything.
  const items = await (await rest('menu_items?select=id,name_en,price_vnd,is_active&is_active=eq.true&price_vnd=not.is.null&limit=2')).json()
  check(items.length === 2, 'two live priced dishes to order', items.map(i => i.name_en).join(', '))
  if (items.length < 2) throw new Error('nothing to order')

  // 1 · Open an order the way the route does.
  const total = items[0].price_vnd * 2 + items[1].price_vnd
  const made = await (await rest('menu_orders', {
    method: 'POST', headers: { ...SVC, Prefer: 'return=representation' },
    body: JSON.stringify({ room: ROOM, total_vnd: total }),
  })).json()
  const orderId = made?.[0]?.id
  check(!!orderId, 'an order opens for the room')

  await rest('menu_order_lines', {
    method: 'POST',
    body: JSON.stringify([
      { order_id: orderId, item_id: items[0].id, venue_name: 'V', name_en: items[0].name_en, unit_price_vnd: items[0].price_vnd, qty: 2, line_total_vnd: items[0].price_vnd * 2, display_order: 0 },
      { order_id: orderId, item_id: items[1].id, venue_name: 'V', name_en: items[1].name_en, unit_price_vnd: items[1].price_vnd, qty: 1, line_total_vnd: items[1].price_vnd, display_order: 10 },
    ]),
  })
  const lines = await (await rest(`menu_order_lines?select=line_total_vnd&order_id=eq.${orderId}`)).json()
  check(lines.length === 2, 'both lines stored', `${lines.length} line(s)`)
  check(lines.reduce((s, l) => s + l.line_total_vnd, 0) === total, 'line totals sum to the order total', String(total))

  // 2 · ONE OPEN ORDER PER ROOM. The index that stops a kitchen being sent two
  //     half-built orders from one table.
  const second = await rest('menu_orders', { method: 'POST', body: JSON.stringify({ room: ROOM, total_vnd: 1 }) })
  check(second.status >= 400, 'a SECOND open order for the same room is refused', `HTTP ${second.status}`)

  // 3 · Clearing archives and frees the room.
  await rest(`menu_orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ cleared_at: new Date().toISOString() }) })
  const third = await rest('menu_orders', { method: 'POST', headers: { ...SVC, Prefer: 'return=representation' }, body: JSON.stringify({ room: ROOM, total_vnd: 1 }) })
  check(third.status < 400, 'once cleared, the room can open a new order', `HTTP ${third.status}`)
  const kept = await (await rest(`menu_orders?select=id,cleared_at&room=eq.${ROOM}`)).json()
  check(kept.length === 2 && kept.some(o => o.cleared_at), 'the cleared order is ARCHIVED, not deleted', `${kept.length} rows, 1 cleared`)

  // 4 · Deleting an order takes its lines with it.
  await rest(`menu_orders?id=eq.${orderId}`, { method: 'DELETE' })
  const orphans = await (await rest(`menu_order_lines?select=id&order_id=eq.${orderId}`)).json()
  check(orphans.length === 0, 'lines cascade with the order', `${orphans.length} orphan(s)`)

  // 5 · A member or a passer-by can read NONE of it. These tables carry what a
  //     named room asked for, which is nobody else's business.
  for (const t of ['menu_orders', 'menu_order_lines']) {
    const r = await fetch(`${U}/rest/v1/${t}?select=*`, { headers: ANON })
    const body = await r.json().catch(() => null)
    const rows = Array.isArray(body) ? body.length : 0
    check(r.status !== 200 || rows === 0, `anon is refused ${t}`, `HTTP ${r.status}, ${rows} row(s)`)
  }

  // 6 · CONTROL — the service role CAN see them, so the checks above are not
  //     passing against an empty table.
  const ctl = await (await rest(`menu_orders?select=id&room=eq.${ROOM}`)).json()
  console.log('')
  check(ctl.length > 0, 'CONTROL — the service role sees the test rows', `${ctl.length} row(s)`)
} finally {
  await cleanup()
  const left = await (await rest(`menu_orders?select=id&room=eq.${ROOM}`)).json()
  check(Array.isArray(left) && left.length === 0, 'the throwaway room is cleaned up', `${left.length ?? '?'} left`)
}

console.log(`\n${fails ? '✗ ' + fails + ' FAILED' : '✓ every claim holds'}\n`)
process.exit(fails ? 1 : 0)
