import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'

// WHAT THE ROOM WOULD LIKE, WRITTEN DOWN.
//
// Not a checkout. Nothing is charged anywhere in this file and no payment
// exists in the system: the point is that a member builds the order, confirms
// it is right, and the staff member reads back a list instead of remembering
// one. Getting the order wrong is the failure this prevents.
//
// ── THE PRICES ARE NOT TRUSTED FROM THE TABLET ────────────────────────────
// The client sends item ids and quantities and NOTHING else. Every price is
// looked up here and the total computed here. A tablet standing unattended in
// a public room must never be able to tell the club what something costs — and
// since a price sent by a client would be believed, the only safe design is
// one where it is never sent.
//
// Prices are then SNAPSHOTTED onto the order lines, so an order already
// confirmed keeps what was quoted even if the menu is edited mid-service.
//
// The device token decides which room this is. There is no member identity by
// the owner's decision: the order belongs to the room, and a person works out
// the rest.

export const dynamic = 'force-dynamic'

/** The room this tablet stands in, or null if it is not an enrolled device. */
async function room(): Promise<string | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return null
  const { data } = await svc().rpc('kiosk_board', { p_device_token: token })
  const row = Array.isArray(data) ? data[0] : data
  return row?.room ?? null
}

const deny = () => NextResponse.json({ error: 'No device.' }, { status: 403 })
const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 })

/** The room's open order — pending or placed, but not yet cleared. */
async function openOrder(r: string) {
  const sb = svc()
  const { data: order } = await sb.from('menu_orders')
    .select('id, room, status, total_vnd, created_at, ordered_at')
    .eq('room', r).is('cleared_at', null).maybeSingle()
  if (!order) return null
  const { data: lines } = await sb.from('menu_order_lines')
    .select('id, venue_name, name_en, name_vn, unit_price_vnd, qty, line_total_vnd')
    .eq('order_id', order.id).order('display_order')
  return { ...order, lines: lines ?? [] }
}

export async function GET() {
  const r = await room()
  if (!r) return deny()
  return NextResponse.json({ room: r, order: await openOrder(r) })
}

// ── Confirm an order ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const r = await room()
  if (!r) return deny()

  const body = await req.json().catch(() => null) as { lines?: { item_id?: string; qty?: number }[] } | null
  const wanted = (body?.lines ?? [])
    .filter(l => typeof l.item_id === 'string' && Number.isInteger(l.qty) && (l.qty as number) > 0)
    .map(l => ({ item_id: l.item_id as string, qty: Math.min(50, l.qty as number) }))
  if (!wanted.length) return bad('Nothing to order.')

  const sb = svc()

  // Price it from the MENU, not from what arrived. An item that is not live,
  // or has no price, cannot be ordered — which also stops a stale tablet
  // ordering something that was taken off an hour ago.
  const { data: items, error } = await sb.from('menu_items')
    .select('id, name_en, name_vn, price_vnd, is_active, menu_venues(name)')
    .in('id', wanted.map(w => w.item_id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byId = new Map((items ?? []).map(i => [i.id, i]))
  const lines: {
    item_id: string; venue_name: string; name_en: string; name_vn: string | null
    unit_price_vnd: number; qty: number; line_total_vnd: number; display_order: number
  }[] = []
  const refused: string[] = []

  wanted.forEach((w, n) => {
    const it = byId.get(w.item_id)
    if (!it || !it.is_active || it.price_vnd == null) { refused.push(w.item_id); return }
    lines.push({
      item_id: it.id,
      venue_name: (it.menu_venues as unknown as { name: string } | null)?.name ?? '—',
      name_en: it.name_en, name_vn: it.name_vn,
      unit_price_vnd: it.price_vnd,
      qty: w.qty,
      line_total_vnd: it.price_vnd * w.qty,
      display_order: n * 10,
    })
  })
  if (!lines.length) return bad('Nothing on that order is still available.')

  const total = lines.reduce((s, l) => s + l.line_total_vnd, 0)

  // One open order per room, enforced by a partial unique index. Editing means
  // replacing the lines on the order that is already open, not starting a
  // second one — two half-built orders on one table is how a kitchen is sent
  // the wrong thing.
  const existing = await openOrder(r)
  let orderId: string
  if (existing) {
    orderId = existing.id
    await sb.from('menu_orders')
      .update({ total_vnd: total, status: 'pending', ordered_at: null, ordered_by: null })
      .eq('id', orderId)
    await sb.from('menu_order_lines').delete().eq('order_id', orderId)
  } else {
    const { data: created, error: insErr } = await sb.from('menu_orders')
      .insert({ room: r, total_vnd: total }).select('id').single()
    if (insErr || !created) return NextResponse.json({ error: 'Could not open an order.' }, { status: 500 })
    orderId = created.id
  }

  const { error: lineErr } = await sb.from('menu_order_lines')
    .insert(lines.map(l => ({ ...l, order_id: orderId })))
  if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, order: await openOrder(r), refused })
}

// ── Staff: placed with the kitchen ─────────────────────────────────────────

export async function PATCH() {
  const r = await room()
  if (!r) return deny()
  const open = await openOrder(r)
  if (!open) return bad('Nothing is open.')
  await svc().from('menu_orders')
    .update({ status: 'ordered', ordered_at: new Date().toISOString() })
    .eq('id', open.id)
  return NextResponse.json({ ok: true, order: await openOrder(r) })
}

// ── Staff: clear it ────────────────────────────────────────────────────────
// Archives rather than deletes. It disappears from the tablet either way, and
// the club keeps a record of what each room actually asked for — the only data
// anyone has ever had about what members eat here.

export async function DELETE() {
  const r = await room()
  if (!r) return deny()
  const open = await openOrder(r)
  if (!open) return NextResponse.json({ ok: true, order: null })
  await svc().from('menu_orders')
    .update({ cleared_at: new Date().toISOString() })
    .eq('id', open.id)
  return NextResponse.json({ ok: true, order: null })
}
