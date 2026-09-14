import { NextResponse } from 'next/server'
import { resolveMemberBooking, signedInGuestIds } from '@/lib/guests-server'
import { cleanGuestName, matchTokens } from '@/lib/guests'

// PATCH  /api/members/bookings/[id]/guests/[guestId] → { guest_name } correct a name
// DELETE /api/members/bookings/[id]/guests/[guestId] → take a name off
//
// Scoped twice: the booking must be the caller's own (resolveMemberBooking), and
// the guest row must belong to THAT booking — a guest id from someone else's
// booking matches nothing. A guest who has already signed in at the door is a
// record of who came, and stays as it is.
export const dynamic = 'force-dynamic'

async function ownGuest(id: string, guestId: string) {
  const r = await resolveMemberBooking(id)
  if (!r.ok) return { fail: NextResponse.json({ error: r.error }, { status: r.status }) }
  if (!r.editable) return { fail: NextResponse.json({ error: 'Guest names can only be changed on upcoming bookings.' }, { status: 409 }) }
  const { data: g } = await r.a.from('booking_guests').select('id').eq('id', guestId).eq('booking_id', id).maybeSingle()
  if (!g) return { fail: NextResponse.json({ error: 'Guest not found.' }, { status: 404 }) }
  if ((await signedInGuestIds(r.a, [guestId])).has(guestId)) {
    return { fail: NextResponse.json({ error: 'This guest has already signed in at the door.' }, { status: 409 }) }
  }
  return { r }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; guestId: string }> }) {
  const { id, guestId } = await ctx.params
  const { fail, r } = await ownGuest(id, guestId)
  if (fail) return fail
  const body = await req.json().catch(() => null)
  const guest_name = cleanGuestName(body?.guest_name)
  if (!guest_name || matchTokens(guest_name).length === 0) return NextResponse.json({ error: 'Give the guest’s name.' }, { status: 400 })
  const { error } = await r!.a.from('booking_guests')
    .update({ guest_name, updated_at: new Date().toISOString() }).eq('id', guestId).eq('booking_id', id)
  if (error) return NextResponse.json({ error: 'Could not save that name.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; guestId: string }> }) {
  const { id, guestId } = await ctx.params
  const { fail, r } = await ownGuest(id, guestId)
  if (fail) return fail
  const { error } = await r!.a.from('booking_guests').delete().eq('id', guestId).eq('booking_id', id)
  if (error) return NextResponse.json({ error: 'Could not remove that name.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
