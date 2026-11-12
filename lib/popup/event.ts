import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { DEVICE_COOKIE } from '@/lib/kiosk/server'

// ═══════════════════════════════════════════════════════════════════════════
// WHICH EVENING IS THIS PHONE WORKING ON?
// ───────────────────────────────────────────────────────────────────────────
// The real one, unless the run sheet has switched THIS HANDSET to practice.
//
// ⚠ PER DEVICE, read from the device's own row. Not an environment variable —
// that would move every phone at once and need a deploy to undo. Not a cookie
// — the owner cannot set one on somebody else's handset. One phone can be
// rehearsing in the back office while another is taking real sign-ups.
//
// Falls back to the real evening on every failure, including a database that
// does not yet have the column. A phone that cannot work out where it is
// should be at the real event, not nowhere.
// ═══════════════════════════════════════════════════════════════════════════

export const REAL_SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'
export const PRACTICE_SLUG = 'palace-practice'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } })

export async function deviceSlug(): Promise<string> {
  try {
    const token = (await cookies()).get(DEVICE_COOKIE)?.value
    if (!token) return REAL_SLUG
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update(token).digest('hex')
    const { data, error } = await svc().from('kiosk_devices')
      .select('popup_slug').eq('token_hash', hash).is('revoked_at', null).maybeSingle()
    if (error || !data?.popup_slug) return REAL_SLUG
    return data.popup_slug
  } catch { return REAL_SLUG }
}

export interface PopupEvent {
  id: string; slug: string; title_en: string; title_vn: string | null
  venue_en: string; venue_vn: string | null; timezone: string
  session_minutes: number; party_max: number; default_cap: number
  published: boolean; bookings_paused: boolean; is_practice: boolean
  admit_early_minutes: number; admit_late_minutes: number
  reminder_lead_minutes: number
}

/** The evening this device is on, whole. Null only if the row is missing. */
export async function deviceEvent(): Promise<PopupEvent | null> {
  const slug = await deviceSlug()
  const a = svc()
  const { data, error } = await a.from('popup_events').select('*').eq('slug', slug).maybeSingle()
  if (error || !data) {
    // A device pointed at an evening that has been deleted falls back rather
    // than showing nothing at all.
    if (slug !== REAL_SLUG) {
      const { data: real } = await a.from('popup_events').select('*').eq('slug', REAL_SLUG).maybeSingle()
      return (real as PopupEvent | null) ?? null
    }
    return null
  }
  return { ...(data as PopupEvent), is_practice: !!(data as { is_practice?: boolean }).is_practice }
}
