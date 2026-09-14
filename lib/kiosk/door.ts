import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'

// THE DOOR iPAD, AND ONLY THE DOOR iPAD. deviceOk() answers "is this an enrolled
// kiosk?" — every room tablet says yes. The door API writes guest visits and
// signatures, so it asks the narrower question: enrolled, unrevoked, AND
// purpose = 'door'. Before db/guest_signin.sql has run the column does not
// exist, the select errors, and this returns null: the door fails CLOSED.

export interface DoorDevice { id: string; label: string }

export async function doorDevice(): Promise<DoorDevice | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return null
  const hash = createHash('sha256').update(token).digest('hex')
  const { data, error } = await svc().from('kiosk_devices')
    .select('id, label, purpose, revoked_at').eq('token_hash', hash).maybeSingle()
  if (error || !data || data.revoked_at || data.purpose !== 'door') return null
  return { id: data.id, label: data.label }
}
