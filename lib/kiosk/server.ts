import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { mintMemberJwt } from './mint'
import { verifyKioskActor } from '@/lib/acting-identity'

// Kiosk identity helpers. TWO layers:
//  - DEVICE_COOKIE = the security boundary (an enrolled, revocable device token).
//  - STAFF_COOKIE  = the acting staff's team_member id, SIGNED (2026-10-01).
// Cookies are path '/' so both /kiosk pages and /api/kiosk routes receive them.

export const DEVICE_COOKIE = 'trc_kiosk_device'
export const STAFF_COOKIE = 'trc_kiosk_staff'
// LAYER 3 (Phase 2) — an OPAQUE member-session handle. Not a JWT: the server
// exchanges it for a 60s minted member JWT that never reaches the browser.
export const MEMBER_COOKIE = 'trc_kiosk_member'

export const svc = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// The BOUNDARY check — is this tablet an enrolled, non-revoked kiosk device?
export async function deviceOk(): Promise<boolean> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return false
  const { data } = await svc().rpc('kiosk_device_active', { p_token: token })
  return data === true
}

// WHO IS ACTING, PROVEN (2026-10-01). This used to return the cookie's raw
// contents, which meant any HTTP client could name itself anybody — so the
// cookie was documented as "attribution only" and explicitly barred from
// carrying member PII. It is signed now, by the same machinery the admin desk
// has used since the shift-ownership work, with its own prefix so a desk
// cookie cannot be replayed on a tablet.
//
// A value that does not verify is treated as ABSENT: the person picks their
// name and enters their PIN again, which is the right outcome for an identity
// we cannot vouch for.
export async function actingStaffId(): Promise<string | null> {
  return verifyKioskActor((await cookies()).get(STAFF_COOKIE)?.value)
}

/** The acting person, PROVEN and still on the team.
 *
 * actingStaffId() verifies the signature; this also checks the row, because a
 * valid signature on somebody who has left is still the wrong answer. Every
 * staff route that writes anything wants both, and three of them had each
 * written their own copy of this — app/api/kiosk/staff/whisky/route.ts first.
 *
 * Returns the supervisor flag too: the shift rules let a supervisor touch
 * somebody else's task, and that decision is made in Postgres, not here. It is
 * carried so the tablet can STOP OFFERING what the database would refuse.
 */
export async function actingStaff(): Promise<{ id: string; name: string; supervisor: boolean } | null> {
  const id = await actingStaffId()
  if (!id) return null
  const { data } = await svc().from('team_members')
    .select('id, display_name, active, pin_hash, is_shift_supervisor').eq('id', id).maybeSingle()
  if (!data || data.active === false || !data.pin_hash) return null
  return { id: data.id, name: data.display_name, supervisor: !!data.is_shift_supervisor }
}

/** The two refusals every staff route gives, worded the same way on every screen. */
export const denyDevice = () => NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })
export const denyStaff = () => NextResponse.json({ error: 'Sign in with your PIN first.' }, { status: 401 })

export const deviceCookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 365 }
export const staffCookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 12 }
// Matches the hard TTL in kiosk_member_sessions. The cookie is a convenience; the
// session's real life is enforced in Postgres, so a tampered cookie buys nothing.
export const memberCookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 10 }

export interface KioskMember { sessionId: string; memberNo: string; profileId: string; expiresAt: string }

/**
 * Resolve the live member session on this tablet, or null.
 *
 * Every member-mode request passes through here. kiosk_member_touch enforces, in
 * ONE place in Postgres: device still enrolled · session not ended · hard TTL ·
 * 90s idle · and that the session belongs to THIS device, so a token lifted off
 * the tablet is refused. It also bumps the idle clock, so calling this IS the
 * "member is still here" signal.
 */
export async function memberSession(): Promise<KioskMember | null> {
  const jar = await cookies()
  const device = jar.get(DEVICE_COOKIE)?.value
  const session = jar.get(MEMBER_COOKIE)?.value
  if (!device || !session) return null
  const { data } = await svc().rpc('kiosk_member_touch', { p_device_token: device, p_session_token: session })
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.out_profile_id) return null
  return { sessionId: row.session_id, memberNo: row.out_member_no, profileId: row.out_profile_id, expiresAt: row.out_expires_at }
}

/**
 * A Supabase client acting AS THE MEMBER. Reads pass through member-own RLS
 * exactly as they do for that member's own browser session — staff data is not
 * hidden from it, it is unreadable by it. Never given the service-role key.
 */
export function memberClient(profileId: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${mintMemberJwt(profileId)}` } },
  })
}
