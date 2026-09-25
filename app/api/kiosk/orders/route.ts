import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { NOTE_MAX, openOrder, charges } from '@/lib/menus/orders'
import { venueState, type ServiceWindow } from '@/lib/menus/hours'

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

export async function GET() {
  const r = await room()
  if (!r) return deny()
  return NextResponse.json({ room: r, order: await openOrder(svc(), r) })
}

// ── Confirm an order ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const r = await room()
  if (!r) return deny()

  const body = await req.json().catch(() => null) as
    { lines?: { item_id?: string; qty?: number }[]; note?: string } | null
  // The note is the room's own words; it is stored, never interpreted. Trimmed
  // and cut to the column's limit rather than refused — losing an order
  // because somebody typed a paragraph would be absurd.
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, NOTE_MAX) : ''
  const wanted = (body?.lines ?? [])
    .filter(l => typeof l.item_id === 'string' && Number.isInteger(l.qty) && (l.qty as number) > 0)
    .map(l => ({ item_id: l.item_id as string, qty: Math.min(50, l.qty as number) }))
  if (!wanted.length) return bad('Nothing to order.')

  const sb = svc()

  // Price it from the MENU, not from what arrived. An item that is not live,
  // or has no price, cannot be ordered — which also stops a stale tablet
  // ordering something that was taken off an hour ago.
  const { data: items, error } = await sb.from('menu_items')
    .select('id, name_en, name_vn, price_vnd, is_active, venue_id, contains_alcohol, menu_venues(name)')
    .in('id', wanted.map(w => w.item_id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── A CLOSED KITCHEN CANNOT BE ORDERED FROM ─────────────────────────────
  // The tablet greys these out, but the tablet is not the authority: a page
  // left open since eight o'clock, a device with a wrong clock, or anything
  // posting straight at this route would otherwise send food to a kitchen that
  // stopped taking orders an hour ago. Judged HERE, on the server's time,
  // using the same function the tablet uses.
  const venueIds = [...new Set((items ?? []).map(i => i.venue_id).filter(Boolean))] as string[]
  const shut = new Set<string>()
  if (venueIds.length) {
    const { data: hours } = await sb.from('menu_venue_hours')
      .select('venue_id, weekday, opens_at, last_order_at')
      .in('venue_id', venueIds)
    const byVenue = new Map<string, ServiceWindow[]>()
    for (const h of (hours ?? []) as (ServiceWindow & { venue_id: string; opens_at: string; last_order_at: string })[]) {
      const w = byVenue.get(h.venue_id) ?? []
      // Postgres hands back 'HH:MM:SS'; the rule wants 'HH:MM'.
      w.push({ weekday: h.weekday, opens_at: String(h.opens_at).slice(0, 5), last_order_at: String(h.last_order_at).slice(0, 5) })
      byVenue.set(h.venue_id, w)
    }
    const now = new Date()
    for (const id of venueIds) {
      if (!venueState(byVenue.get(id) ?? [], now).open) shut.add(id)
    }
  }

  const byId = new Map((items ?? []).map(i => [i.id, i]))
  const lines: {
    item_id: string; venue_name: string; name_en: string; name_vn: string | null
    unit_price_vnd: number; qty: number; line_total_vnd: number; alcohol: boolean; display_order: number
  }[] = []
  const refused: string[] = []

  wanted.forEach((w, n) => {
    const it = byId.get(w.item_id)
    if (!it || !it.is_active || it.price_vnd == null) { refused.push(w.item_id); return }
    if (it.venue_id && shut.has(it.venue_id as string)) { refused.push(w.item_id); return }
    lines.push({
      item_id: it.id,
      venue_name: (it.menu_venues as unknown as { name: string } | null)?.name ?? '—',
      name_en: it.name_en, name_vn: it.name_vn,
      unit_price_vnd: it.price_vnd,
      qty: w.qty,
      line_total_vnd: it.price_vnd * w.qty,
      // Beer, wine and spirits are taxed at the standard rate; everything else
      // at the reduced one. Read from the MENU like the price is, never from
      // what the tablet sent.
      alcohol: (it as unknown as { contains_alcohol?: boolean }).contains_alcohol === true,
      display_order: n * 10,
    })
  })
  if (!lines.length) return bad('Nothing on that order is still available — those kitchens have stopped taking orders.')

  // Priced, then charged. Both from the menu and the club's own rates; a
  // tablet sends item ids and quantities and nothing else.
  const sum = charges(
    lines.reduce((s, l) => s + l.line_total_vnd, 0),
    lines.filter(l => l.alcohol).reduce((s, l) => s + l.line_total_vnd, 0),
  )

  // One open order per room, enforced by a partial unique index. Editing means
  // replacing the lines on the order that is already open, not starting a
  // second one — two half-built orders on one table is how a kitchen is sent
  // the wrong thing.
  const existing = await openOrder(svc(), r)
  let orderId: string
  if (existing) {
    orderId = existing.id
    await sb.from('menu_orders')
      .update({
        subtotal_vnd: sum.subtotal, service_pct: sum.servicePct, service_vnd: sum.service,
        vat_pct: sum.vatPct, vat_vnd: sum.vat, total_vnd: sum.total,
        status: 'pending', ordered_at: null, ordered_by: null, note: note || null,
      })
      .eq('id', orderId)
    await sb.from('menu_order_lines').delete().eq('order_id', orderId)
  } else {
    const { data: created, error: insErr } = await sb.from('menu_orders')
      .insert({
        room: r, subtotal_vnd: sum.subtotal, service_pct: sum.servicePct, service_vnd: sum.service,
        vat_pct: sum.vatPct, vat_vnd: sum.vat, total_vnd: sum.total, note: note || null,
      }).select('id').single()
    if (insErr || !created) return NextResponse.json({ error: 'Could not open an order.' }, { status: 500 })
    orderId = created.id
  }

  const { error: lineErr } = await sb.from('menu_order_lines')
    // `alcohol` is used to work out the VAT above and is NOT a column on the
    // line — the spread would have tried to insert it and failed the order.
    .insert(lines.map(({ alcohol: _alcohol, ...l }) => ({ ...l, order_id: orderId })))
  if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, order: await openOrder(svc(), r), refused })
}

// ── The room: change the note, and nothing else ────────────────────────────
// Separate from POST because changing a sentence should not re-price and
// re-write every line of the order. It leaves the order pending: a note is the
// room's to change until a server has placed it.

export async function PUT(req: NextRequest) {
  const r = await room()
  if (!r) return deny()
  const open = await openOrder(svc(), r)
  if (!open) return bad('Nothing is open.')
  if (open.status !== 'pending') return bad('That order has already been placed.')
  const body = await req.json().catch(() => null) as { note?: string } | null
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, NOTE_MAX) : ''
  await svc().from('menu_orders').update({ note: note || null }).eq('id', open.id)
  return NextResponse.json({ ok: true, order: await openOrder(svc(), r) })
}

// ── Staff: placed with the kitchen ─────────────────────────────────────────

export async function PATCH() {
  const r = await room()
  if (!r) return deny()
  const open = await openOrder(svc(), r)
  if (!open) return bad('Nothing is open.')
  await svc().from('menu_orders')
    .update({ status: 'ordered', ordered_at: new Date().toISOString() })
    .eq('id', open.id)
  return NextResponse.json({ ok: true, order: await openOrder(svc(), r) })
}

// ── Staff: clear it ────────────────────────────────────────────────────────
// Archives rather than deletes. It disappears from the tablet either way, and
// the club keeps a record of what each room actually asked for — the only data
// anyone has ever had about what members eat here.

export async function DELETE() {
  const r = await room()
  if (!r) return deny()
  const open = await openOrder(svc(), r)
  if (!open) return NextResponse.json({ ok: true, order: null })
  await svc().from('menu_orders')
    .update({ cleared_at: new Date().toISOString() })
    .eq('id', open.id)
  return NextResponse.json({ ok: true, order: null })
}
