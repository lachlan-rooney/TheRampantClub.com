import { redirect } from 'next/navigation'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { SPACE_TO_FLOOR } from '@/lib/kiosk/floors'

// The tablet's front door. It resolves to THIS tablet's own floor page — the room's
// own surface, with the menu on it. Falls back to the board when the device has no
// room set, and to pairing when it isn't enrolled. It never opens the staff
// sign-in: that is a screen staff go to, not one a room-facing tablet sits on.
export const dynamic = 'force-dynamic'

export default async function KioskIndex() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) redirect('/kiosk/pair')

  const hash = createHash('sha256').update(token).digest('hex')
  const { data: dev } = await svc().from('kiosk_devices')
    .select('room, revoked_at').eq('token_hash', hash).maybeSingle()
  if (!dev || dev.revoked_at) redirect('/kiosk/pair')

  const slug = dev.room ? SPACE_TO_FLOOR[dev.room] : null
  redirect(slug ? `/kiosk/${slug}` : '/kiosk/board')
}
