import type { SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS, READ IN ONE PLACE.
// ───────────────────────────────────────────────────────────────────────────
// Four surfaces now show the same orders — the room's own tablet, the staff
// tablet behind its PIN, the door tablet and the admin page — and they must
// never disagree about what "open" means or what a line says. So the reads
// live here and every route calls them.
//
// Every caller passes a SERVICE-ROLE client: menu_orders has RLS on with no
// policies at all (see 20260918350000_menu_orders.sql). Nothing reaches these
// tables except through a route that has already checked a device token or an
// admin session.
// ═══════════════════════════════════════════════════════════════════════════

// ── SERVICE AND VAT (owner, 2026-09-23: "we add vat plus 10% service charge")
// Menu prices are NET. Service is 10% of the food; VAT is 10% of food PLUS
// service — the Vietnamese "++", confirmed by the owner rather than assumed.
// So a 1,000,000₫ order is 100,000 service, 110,000 VAT, 1,210,000 total.
//
// ONE PLACE. The tablet's tray, the order panel, the floor's board and the
// server that computes the stored figures all read these, so none of them can
// quietly disagree with the others about what a member owes.
//
// Changing a rate here changes it for NEW orders only: each order stores the
// rates it was quoted at (menu_orders.service_pct / vat_pct), so a rate change
// cannot rewrite what somebody was already shown.
export const SERVICE_PCT = 0.10
export const VAT_PCT = 0.10

export interface Charges {
  subtotal: number; service: number; vat: number; total: number
  servicePct: number; vatPct: number
}

/** The whole sum, in whole đồng — VND has no minor unit, so every component is
 *  rounded once here rather than each surface rounding its own way and the
 *  parts failing to add up to the total. */
export function charges(subtotal: number, servicePct = SERVICE_PCT, vatPct = VAT_PCT): Charges {
  const service = Math.round(subtotal * servicePct)
  const vat = Math.round((subtotal + service) * vatPct)
  return { subtotal, service, vat, total: subtotal + service + vat, servicePct, vatPct }
}

/** As long a note as the column takes. Enforced here, on the tablet, and by a
 *  check constraint — a limit only one of the three knows is not a limit. */
export const NOTE_MAX = 240

const ORDER_COLS = 'id, room, status, subtotal_vnd, service_pct, service_vnd, vat_pct, vat_vnd, total_vnd, note, created_at, ordered_at, ordered_by'
const LINE_COLS = 'id, item_id, venue_name, name_en, name_vn, unit_price_vnd, qty, line_total_vnd'

export interface OrderLineRow {
  id: string; item_id: string | null; venue_name: string
  name_en: string; name_vn: string | null
  unit_price_vnd: number; qty: number; line_total_vnd: number
}
export interface OrderRow {
  id: string; room: string; status: 'pending' | 'ordered'
  /** The lines, before service and VAT. */
  subtotal_vnd: number
  service_pct: number; service_vnd: number
  vat_pct: number; vat_vnd: number
  /** What the member is shown: subtotal + service + VAT. */
  total_vnd: number
  note: string | null
  created_at: string; ordered_at: string | null; ordered_by: string | null
  lines: OrderLineRow[]
}

/** One room's open order — pending or placed, but not yet cleared. */
export async function openOrder(sb: SupabaseClient, room: string): Promise<OrderRow | null> {
  const { data: order } = await sb.from('menu_orders')
    .select(ORDER_COLS).eq('room', room).is('cleared_at', null).maybeSingle()
  if (!order) return null
  const { data: lines } = await sb.from('menu_order_lines')
    .select(LINE_COLS).eq('order_id', order.id).order('display_order')
  return { ...(order as Omit<OrderRow, 'lines'>), lines: (lines ?? []) as OrderLineRow[] }
}

/** Every open order, oldest first — the one that has waited longest is the one
 *  somebody should be walking towards. */
export async function openOrders(sb: SupabaseClient): Promise<OrderRow[]> {
  const { data: orders } = await sb.from('menu_orders')
    .select(ORDER_COLS).is('cleared_at', null).order('created_at')
  if (!orders?.length) return []
  const { data: lines } = await sb.from('menu_order_lines')
    .select(`order_id, ${LINE_COLS}`).in('order_id', orders.map(o => o.id)).order('display_order')
  const byOrder = new Map<string, OrderLineRow[]>()
  for (const l of (lines ?? []) as (OrderLineRow & { order_id: string })[]) {
    const arr = byOrder.get(l.order_id) ?? []; arr.push(l); byOrder.set(l.order_id, arr)
  }
  return (orders as Omit<OrderRow, 'lines'>[]).map(o => ({ ...o, lines: byOrder.get(o.id) ?? [] }))
}

/** Mark placed, or clear. `who` is written down because "who said this went to
 *  the kitchen" is the first question when something does not arrive. */
export async function actOnOrder(
  sb: SupabaseClient, orderId: string, action: 'ordered' | 'clear', who: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { data: order } = await sb.from('menu_orders')
    .select('id, status, cleared_at').eq('id', orderId).maybeSingle()
  if (!order || order.cleared_at) return { ok: false, error: 'That order is no longer open.' }
  const patch = action === 'ordered'
    ? { status: 'ordered', ordered_at: new Date().toISOString(), ordered_by: who }
    : { cleared_at: new Date().toISOString() }
  const { error } = await sb.from('menu_orders').update(patch).eq('id', orderId)
  return error ? { ok: false, error: error.message } : { ok: true }
}
