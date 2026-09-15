import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { doorClock } from '@/lib/guests'

// The idle board. BOARD mode has NO identity by design, so it cannot read through
// RLS. The event half is kiosk_board(), which returns a fixed set of non-PII columns.
//
// The device token resolves the ROOM. No device → nothing, not an error page.
//
// TONIGHT'S BOOKINGS, WITH NAMES (owner's decision, 2026-09-15). The Phase 2 design
// kept bookings off this screen as PII facing the room. The owner overruled that:
// the floor tablets are internal and staff need to see who is booked into the room
// ("a person's booking not coming up on floor 4"). So the route adds the room's
// bookings for the service date — name, time, party size, arrived — and nothing
// else: no notes, no phone, no member number. kiosk_board() itself still never
// reads bookings; this list rides beside it, and only once that function has
// proved the device is enrolled and told us which room it stands in.

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return NextResponse.json({ board: null }, { status: 403 })
  const a = svc()
  const { data } = await a.rpc('kiosk_board', { p_device_token: token })
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.room) return NextResponse.json({ board: row || null })

  // The same service date as the door: the small hours belong to the evening before.
  const { serviceDate } = doorClock()
  const { data: rows } = await a.from('bookings')
    .select('booking_id, member_no, start_time, party_size, status, arrived_at')
    .eq('space', row.room).eq('booking_date', serviceDate)
    .in('status', ['pending', 'confirmed', 'arrived'])
    .order('start_time', { ascending: true, nullsFirst: false })

  const list = rows || []
  const names = new Map<string, { full_name: string | null; nickname: string | null }>()
  const nos = [...new Set(list.map(b => b.member_no).filter(Boolean))] as string[]
  if (nos.length) {
    const { data: ms } = await a.from('members').select('member_no, full_name, nickname').in('member_no', nos)
    for (const m of ms || []) names.set(m.member_no, { full_name: m.full_name, nickname: m.nickname })
  }

  return NextResponse.json({
    board: {
      ...row,
      bookings: list.map(b => {
        const m = names.get(b.member_no)
        return {
          id: b.booking_id,
          time: b.start_time ? String(b.start_time).slice(0, 5) : null,
          name: m?.full_name || m?.nickname || 'Member',
          nickname: m?.full_name && m?.nickname ? m.nickname : null,
          party: b.party_size ?? null,
          arrived: b.status === 'arrived' || !!b.arrived_at,
        }
      }),
    },
  })
}
