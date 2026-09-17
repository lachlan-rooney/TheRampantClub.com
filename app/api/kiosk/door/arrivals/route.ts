import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'
import { arrivalsFor, markArrived, markLeft, addGuest } from '@/lib/arrivals'

// THE SAME THREE BUTTONS, ON THE TABLET AT THE DOOR.
//
// The door tablet has a DEVICE, not a login — so it cannot call the admin route,
// and this gate is the enrolled-device check, exactly as the door's guest
// sign-in is gated. Attribution is the acting staff cookie where one is set; the
// device stands in when it is not, so an action is never recorded as nobody.
//
// The list here carries member names. That is the owner's standing decision for
// the in-club tablets (see the board, 2026-09-15) — they are internal screens —
// and this one only answers an enrolled device.

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await deviceOk())) return NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })
  return NextResponse.json(await arrivalsFor(svc()))
}

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })
  const staff = await actingStaffId()
  const actor = staff ? `staff:${staff}` : 'door-tablet'

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
