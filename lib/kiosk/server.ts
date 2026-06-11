import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Kiosk identity helpers. TWO layers:
//  - DEVICE_COOKIE = the security boundary (an enrolled, revocable device token).
//  - STAFF_COOKIE  = attribution only (the acting staff's team_member id).
// Cookies are path '/' so both /kiosk pages and /api/kiosk routes receive them.

export const DEVICE_COOKIE = 'trc_kiosk_device'
export const STAFF_COOKIE = 'trc_kiosk_staff'

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
