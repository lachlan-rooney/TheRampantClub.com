import { redirect } from 'next/navigation'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'

// The tablet's front door is THE BOARD. The kiosk is primarily a member surface:
// tonight's event, member sign-in, the menu. Staff sign-in is a corner affordance
// on the board, not a destination anything lands on.
export const dynamic = 'force-dynamic'

export default async function KioskIndex() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) redirect('/kiosk/pair')
  const hash = createHash('sha256').update(token).digest('hex')
  // The door iPad's front door is the guest sign-in (2026-09-14). purpose only
  // exists once db/guest_signin.sql has run; until then every device is a room.
  const withPurpose = await svc().from('kiosk_devices')
    .select('revoked_at, purpose').eq('token_hash', hash).maybeSingle()
  const dev = withPurpose.error
    ? (await svc().from('kiosk_devices').select('revoked_at').eq('token_hash', hash).maybeSingle()).data
    : withPurpose.data
  if (!dev || dev.revoked_at) redirect('/kiosk/pair')
  redirect((dev as { purpose?: string }).purpose === 'door' ? '/kiosk/door' : '/kiosk/board')
}
