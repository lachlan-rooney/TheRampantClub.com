import { svc } from '@/lib/kiosk/server'

// Shared by /api/kiosk/door/review and /decide. Not a route (no HTTP exports).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A pending door sign-in stays decidable for two hours. Past that the guest has
// long since gone in or gone home, and a PIN tapped on a stale screen should not
// be able to write a decision onto it.
const DECIDABLE_MS = 2 * 3600 * 1000

// THE PIN IS CHECKED ON EVERY DECISION CALL, not read back from the staff cookie.
// trc_kiosk_staff holds a bare team_members id (it is attribution on the room
// tablets, and unsigned); a decision to admit someone to the club is not
// something an unsigned cookie should be able to make. kiosk_verify_pin keeps its
// own lockout (5 fails / 5 minutes).
export async function verifiedStaff(teamMemberId: unknown, pin: unknown): Promise<{ id: string; display_name: string } | null> {
  if (typeof teamMemberId !== 'string' || !UUID.test(teamMemberId) || typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) return null
  const a = svc()
  const { data: id } = await a.rpc('kiosk_verify_pin', { p_team_member: teamMemberId, p_pin: pin })
  if (!id) return null
  const { data: tm } = await a.from('team_members').select('id, display_name').eq('id', id).maybeSingle()
  return tm ? { id: tm.id, display_name: tm.display_name } : null
}

export interface PendingVisit {
  id: string; guest_name: string; host_member_no: string | null; referred_reason: string
  on_list: boolean | null; signed_in_at: string
}

/** A referral on THIS door device, undecided, and recent — or null. */
export async function pendingVisit(deviceId: string, visitId: unknown): Promise<PendingVisit | null> {
  if (typeof visitId !== 'string' || !UUID.test(visitId)) return null
  const { data } = await svc().from('guest_visits')
    .select('id, guest_name, host_member_no, referred_reason, on_list, signed_in_at')
    .eq('id', visitId).eq('device_id', deviceId)
    .is('decision', null).not('referred_reason', 'is', null)
    .gte('signed_in_at', new Date(Date.now() - DECIDABLE_MS).toISOString())
    .maybeSingle()
  return (data as PendingVisit | null) || null
}

export { DECIDABLE_MS }
