import { NextResponse } from 'next/server'
import { resolveAdminBooking } from '@/lib/guests-server'
import { cleanGuestName, matchTokens } from '@/lib/guests'

// PATCH  /api/admin/bookings/[id]/guests/[guestId] → { guest_name }
// DELETE /api/admin/bookings/[id]/guests/[guestId]
//
// Staff may correct or remove a name even after that guest has signed in: the
// door visit keeps its own copy of the name as typed (guest_visits.guest_name),
// and its link to this row is `on delete set null`, so the record of who came
// is never rewritten by tidying the list.
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; guestId: string }> }) {
  const { id, guestId } = await ctx.params
  const r = await resolveAdminBooking(id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const body = await req.json().catch(() => null)
  const guest_name = cleanGuestName(body?.guest_name)
  if (!guest_name || matchTokens(guest_name).length === 0) return NextResponse.json({ error: 'Guest name required.' }, { status: 400 })
  const { data, error } = await r.a.from('booking_guests')
    .update({ guest_name, updated_at: new Date().toISOString() }).eq('id', guestId).eq('booking_id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Guest not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; guestId: string }> }) {
  const { id, guestId } = await ctx.params
  const r = await resolveAdminBooking(id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const { error } = await r.a.from('booking_guests').delete().eq('id', guestId).eq('booking_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
