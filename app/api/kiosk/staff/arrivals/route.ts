import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'
import { arrivalsFor, markArrived, markLeft, addGuest } from '@/lib/arrivals'

// THE SAME THREE BUTTONS, ON A ROOM TABLET.
//
// A twin of app/api/kiosk/door/arrivals — same lib, same gate, different door.
// It exists separately rather than the staff screen borrowing the door's route
// because the two are gated on the same thing today and may not be tomorrow:
// the door tablet has `purpose = 'door'` and a room tablet does not, and a
// shared route would quietly couple two surfaces that the middleware already
// keeps apart.
//
// Until now a staff member standing on the floor with a tablet in their hand
// could not mark anybody in — arrivals existed only at /admin, which needs a
// laptop and a login, and on the door tablet, which is downstairs.
//
// The gate is the enrolled DEVICE. The acting staff cookie is attribution only
// — it is unsigned, which is why it decides whose name is on the action and
// never whether the action is allowed.

export const dynamic = 'force-dynamic'

const gate = async () =>
  (await deviceOk()) ? null : NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })

export async function GET() {
  const no = await gate(); if (no) return no
  return NextResponse.json(await arrivalsFor(svc()))
}

export async function POST(req: Request) {
  const no = await gate(); if (no) return no
  const staff = await actingStaffId()
  const actor = staff ? `staff:${staff}` : 'room-tablet'

  const body = await req.json().catch(() => null)
  const sb = svc()

  if (body?.action === 'arrived') {
    const r = await markArrived(sb, { member_no: body.member_no, booking_id: body.booking_id, actor })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await arrivalsFor(sb)) })
  }
  if (body?.action === 'left') {
    if (typeof body.visit_id !== 'string') return NextResponse.json({ error: 'No visit to close.' }, { status: 400 })
    const r = await markLeft(sb, body.visit_id)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, minutes: r.minutes, ...(await arrivalsFor(sb)) })
  }
  if (body?.action === 'guest') {
    const r = await addGuest(sb, { name: String(body.name || ''), host_member_no: body.member_no, actor })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await arrivalsFor(sb)) })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
