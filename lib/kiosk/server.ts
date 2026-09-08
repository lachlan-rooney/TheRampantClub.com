import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { mintMemberJwt } from './mint'

// Kiosk identity helpers. TWO layers:
//  - DEVICE_COOKIE = the security boundary (an enrolled, revocable device token).
//  - STAFF_COOKIE  = attribution only (the acting staff's team_member id).
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

// Attribution — who's acting (a team_member id), or null. NOT a security gate.
export async function actingStaffId(): Promise<string | null> {
  return (await cookies()).get(STAFF_COOKIE)?.value || null
}

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
