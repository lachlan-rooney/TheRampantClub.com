import { NextResponse } from 'next/server'
import { resolveMemberBooking, loadBookingGuests } from '@/lib/guests-server'
import { cleanGuestName, guestCap, matchTokens, NOT_SET_UP, isMissingSchema } from '@/lib/guests'

// GET  /api/members/bookings/[id]/guests → the names on the caller's OWN booking
// POST /api/members/bookings/[id]/guests → { guest_name } add one
//
// Decided 2026-09-14: members give their guests' names in advance. bookings and
// booking_guests are admin-only under RLS, so this reads and writes through the
// service role — scoped in resolveMemberBooking to a booking whose member_no is
// the signed-in member's. Anyone else's booking is simply "not found".
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const r = await resolveMemberBooking(id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const { ready, byBooking } = await loadBookingGuests(r.a, [id])
  return NextResponse.json({
    ready,
    editable: r.editable && ready,
    party_size: r.booking.party_size,
    cap: guestCap(r.booking.party_size),
    // Member-safe fields only: who added a name is staff business.
    guests: (byBooking.get(id) || []).map(g => ({ id: g.id, guest_name: g.guest_name, signed_in: g.signed_in })),
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const r = await resolveMemberBooking(id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!r.editable) return NextResponse.json({ error: 'Guest names can only be changed on upcoming bookings.' }, { status: 409 })

  const body = await req.json().catch(() => null)
  const guest_name = cleanGuestName(body?.guest_name)
  if (!guest_name || matchTokens(guest_name).length === 0) return NextResponse.json({ error: 'Give the guest’s name.' }, { status: 400 })

  const { ready, byBooking } = await loadBookingGuests(r.a, [id])
  if (!ready) return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
  const current = byBooking.get(id) || []
  const cap = guestCap(r.booking.party_size)
  if (current.length >= cap) {
    return NextResponse.json({ error: cap === 0
      ? 'This booking is for you alone. Ask the Club to change the party size to bring a guest.'
      : `This booking has room for ${cap} guest${cap === 1 ? '' : 's'}. Ask the Club to change the party size to add more.` }, { status: 409 })
  }
  const key = matchTokens(guest_name).sort().join(' ')
  if (current.some(g => matchTokens(g.guest_name).sort().join(' ') === key)) {
    return NextResponse.json({ error: 'That name is already on this booking.' }, { status: 409 })
  }

  const { data, error } = await r.a.from('booking_guests')
    .insert({ booking_id: id, guest_name, added_by: r.actor.id, added_by_kind: 'member' })
    .select('id, guest_name').single()
  if (error) return NextResponse.json({ error: isMissingSchema(error) ? NOT_SET_UP : 'Could not add that name.' }, { status: 500 })
  return NextResponse.json({ ok: true, guest: { ...data, signed_in: false } })
}
