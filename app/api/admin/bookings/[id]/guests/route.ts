import { NextResponse } from 'next/server'
import { resolveAdminBooking, loadBookingGuests, staffAttribution } from '@/lib/guests-server'
import { cleanGuestName, guestCap, matchTokens, NOT_SET_UP, isMissingSchema } from '@/lib/guests'

// GET  /api/admin/bookings/[id]/guests → the expected guests on any booking
// POST /api/admin/bookings/[id]/guests → { guest_name } add one (staff)
//
// Staff are NOT held to the party-size cap the member portal applies: a member
// ringing to say "and one more" should not have to wait for somebody to edit the
// party size first. The response says when the list runs past the party, so the
// form can point it out.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const r = await resolveAdminBooking(id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const { ready, byBooking } = await loadBookingGuests(r.a, [id])
  return NextResponse.json({ ready, party_size: r.booking.party_size, cap: guestCap(r.booking.party_size), guests: byBooking.get(id) || [] })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const r = await resolveAdminBooking(id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const body = await req.json().catch(() => null)
  const guest_name = cleanGuestName(body?.guest_name)
  if (!guest_name || matchTokens(guest_name).length === 0) return NextResponse.json({ error: 'Guest name required.' }, { status: 400 })

  const { data, error } = await r.a.from('booking_guests')
    .insert({ booking_id: id, guest_name, added_by: await staffAttribution(), added_by_kind: 'staff' })
    .select('id, guest_name, added_by_kind').single()
  if (error) return NextResponse.json({ error: isMissingSchema(error) ? NOT_SET_UP : error.message }, { status: isMissingSchema(error) ? 503 : 500 })
  return NextResponse.json({ ok: true, guest: { ...data, signed_in: false } })
}
