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

// ═══════════════════════════════════════════════════════════════════════════
// THE DOOR, WITHOUT A DOOR (2026-10-01)
// ───────────────────────────────────────────────────────────────────────────
// Owner: there is no spare tablet for the entrance yet, and the shop opens on
// 27 October. The flow is built and proven; what is missing is a device.
//
// So a FLOOR tablet can run it too — the same flow reached a second way, rather
// than a second flow that will drift from this one. What differs is who is
// accountable:
//
//   · A DOOR device needs nobody to sign a guest in. It IS the door; standing
//     at it is the proof.
//   · A ROOM tablet needs a NAMED, PIN-PROVEN member of staff on every call.
//     The acting-staff cookie is not enough — it holds a bare team_members id
//     and is unsigned, and a guest being vouched into the club is not something
//     an unsigned cookie should be able to do. Same reasoning as /decide, which
//     has always re-checked the PIN rather than trusting that cookie.
//
// The record says which it was: "door · FLOOR 1" or "staff · Bình". A guest let
// in at the entrance and a guest signed in by a person on the floor are
// different facts, and the attendance screen should not have to guess.
//
// TWO QUESTIONS, ASKED SEPARATELY. "Which tablet is this?" and "who is here?"
// are kept apart so a wrong PIN on a floor tablet says WRONG PIN rather than
// "this tablet cannot do that" — a staff member mistyping at a busy door should
// not be told the hardware is wrong.

export interface FlowDevice { id: string; label: string; isDoor: boolean }

/** The door, or any enrolled room tablet. Says which. No PIN involved. */
export async function doorFlowDevice(): Promise<FlowDevice | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return null
  const hash = createHash('sha256').update(token).digest('hex')
  const { data, error } = await svc().from('kiosk_devices')
    .select('id, label, purpose, revoked_at').eq('token_hash', hash).maybeSingle()
  if (error || !data || data.revoked_at) return null
  return { id: data.id, label: data.label, isDoor: data.purpose === 'door' }
}

/** How a guest_visits row should record who put it there. */
export function loggedBy(dev: FlowDevice, staffName?: string | null): string {
  return (dev.isDoor ? `door · ${dev.label}` : `staff · ${staffName || 'staff'}`).slice(0, 120)
}
