import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { bookableRooms, roomUnitAvailability } from '@/lib/booking-availability'

// GET /api/admin/bookings/availability
//   ?space=&date=&start=&end=&session=&booking=
// Drives the booking form's table-picker. Returns:
//   { rooms: string[] }                  — distinct bookable rooms (always)
//   { units: [{id,name,seats,parent_id,available}] }  — when ?space is given
// available = nothing in conflict(U) is held by an overlapping active booking
// (reuses the SAME logic as the POST/PATCH guard — no reimplementation).
// ?booking=<id> excludes that booking's own holds (edit form: don't grey self).

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const space = searchParams.get('space')
  const date = searchParams.get('date')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const session = searchParams.get('session')
  const booking = searchParams.get('booking')
  const entry = searchParams.get('entry')

  const sb = svc()
  const rooms = await bookableRooms(sb)
  if (!space) return NextResponse.json({ rooms })

  const units = await roomUnitAvailability(sb, {
    space,
    booking_date: date || null,
    start_time: start || null,
    end_time: end || null,
    session_label: session || null,
    excludeBookingId: booking || null,
    excludeEntryId: entry || null,
  })
  return NextResponse.json({ rooms, units })
}
