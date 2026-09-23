import { NextResponse, type NextRequest } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'
import { openOrders, actOnOrder } from '@/lib/menus/orders'

// EVERY ROOM'S ORDERS, ON A TABLET THAT IS NOT IN THAT ROOM.
//
// Until now an order could only be seen on the tablet it was made on: a member
// confirmed one, pressed the button on the table, and a server walked over to
// read it. This is what the staff tablet and the door tablet read so that the
// server arrives already knowing what the room asked for. The table button is
// still the only way to CALL anyone (owner, 2026-09-23) — this changes what
// happens after the call, not the call.
//
// GATED BY THE DEVICE, NOT BY A LOGIN, because floor staff have PINs and not
// logins: an /admin page is no use to them. Any enrolled club tablet may read
// the board. Marking an order placed records WHO, from the PIN session, when
// somebody is signed in on that tablet.
//
// There is no member identity on an order (the owner's decision when this was
// built), so what leaves here is a room, a list of dishes and a total.

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  return NextResponse.json({ orders: await openOrders(svc()) })
}

export async function PATCH(req: NextRequest) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const body = await req.json().catch(() => null) as { order_id?: string; action?: string } | null
  const action = body?.action === 'clear' ? 'clear' : body?.action === 'ordered' ? 'ordered' : null
  if (!body?.order_id || !action) return NextResponse.json({ error: 'Which order?' }, { status: 400 })

  // Whoever is signed in on this tablet, if anyone — the name goes on the
  // order because "who said this went to the kitchen" is the first question
  // asked when a dish does not arrive.
  let who: string | null = null
  const staffId = await actingStaffId()
  if (staffId) {
    const { data } = await svc().from('team_members').select('display_name').eq('id', staffId).maybeSingle()
    who = data?.display_name ?? null
  }

  const res = await actOnOrder(svc(), body.order_id, action, who)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, orders: await openOrders(svc()) })
}
