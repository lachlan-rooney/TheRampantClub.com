import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { svc, DEVICE_COOKIE, deviceCookieOpts } from '@/lib/kiosk/server'

// Pair a tablet: exchange an admin-issued pairing code for a device token, set as
// the httpOnly device cookie. This is how a tablet BECOMES an enrolled kiosk (the
// security boundary). Public entry — useless without a live admin-issued code.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}))
  if (typeof code !== 'string' || !code.trim()) return NextResponse.json({ error: 'Enter the pairing code.' }, { status: 400 })
  const { data: token } = await svc().rpc('kiosk_pair_device', { p_code: code.trim().toUpperCase() })
  if (!token) return NextResponse.json({ error: 'Invalid or expired pairing code.' }, { status: 400 })
  // A freshly paired tablet lands on THE BOARD — the member-facing home. It used
  // to land on the staff sign-in, which is the one screen a tablet standing in a
  // room should never open on.
  const hash = createHash('sha256').update(token as string).digest('hex')
  // The door iPad (purpose = 'door', db/guest_signin.sql) lands on the guest
  // sign-in instead. Before that SQL the column is absent: read the room alone.
  let room: string | null = null
  let purpose: string | null = null
  const withPurpose = await svc().from('kiosk_devices').select('room, purpose').eq('token_hash', hash).maybeSingle()
  if (!withPurpose.error) { room = withPurpose.data?.room ?? null; purpose = withPurpose.data?.purpose ?? null }
  else { const { data: dev } = await svc().from('kiosk_devices').select('room').eq('token_hash', hash).maybeSingle(); room = dev?.room ?? null }

  const res = NextResponse.json({ ok: true, room, next: purpose === 'door' ? '/kiosk/door' : '/kiosk/board' })
  res.cookies.set(DEVICE_COOKIE, token as string, deviceCookieOpts)
  return res
}
