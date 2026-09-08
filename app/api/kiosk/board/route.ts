import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'

// The idle board. BOARD mode has NO identity by design, so it cannot read through
// RLS; safety is structural instead — kiosk_board() returns a fixed set of non-PII
// columns and nothing else, and never consults `bookings` (a member's reservation
// is PII and has no place on a screen facing the room).
//
// The device token resolves the ROOM. No device → nothing, not an error page.

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return NextResponse.json({ board: null }, { status: 403 })
  const { data } = await svc().rpc('kiosk_board', { p_device_token: token })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ board: row || null })
}
