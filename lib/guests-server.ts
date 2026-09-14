import type { SupabaseClient } from '@supabase/supabase-js'
import { getActor, svc, type Actor } from '@/lib/social/server'
import { isAdmin } from '@/lib/admin'
import { actingStaffId } from '@/lib/admin-acting'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { vnDateString } from '@/lib/datetime'
import { GUEST_EDITABLE_STATUSES, isMissingSchema } from '@/lib/guests'

// Server-side guest-name plumbing shared by the member routes
// (/api/members/bookings/[id]/guests) and the admin routes
// (/api/admin/bookings/[id]/guests). booking_guests is admin-only under RLS, so
// both read and write through the service role — and the MEMBER path is scoped
// here, once, to bookings whose member_no is the caller's own.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface BookingLite { booking_id: string; member_no: string; booking_date: string; party_size: number | null; status: string }
export interface GuestOut { id: string; guest_name: string; added_by_kind: 'member' | 'staff'; signed_in: boolean }

type Fail = { ok: false; error: string; status: number }

/** The caller's OWN booking, or a refusal. A booking that is not theirs is "not found", never "forbidden". */
export async function resolveMemberBooking(bookingId: string):
  Promise<Fail | { ok: true; actor: Actor; a: SupabaseClient; booking: BookingLite; editable: boolean }> {
  const actor = await getActor()
  if (!actor) return { ok: false, error: 'Not signed in.', status: 401 }
  if (!UUID.test(bookingId) || !actor.memberNo) return { ok: false, error: 'Booking not found.', status: 404 }
  const a = svc()
  const { data: b } = await a.from('bookings')
    .select('booking_id, member_no, booking_date, party_size, status')
    .eq('booking_id', bookingId).eq('member_no', actor.memberNo).maybeSingle()
  if (!b) return { ok: false, error: 'Booking not found.', status: 404 }
  // Today or later, and still a booking. A past evening's guest list is a record.
  const editable = b.booking_date >= vnDateString() && GUEST_EDITABLE_STATUSES.includes(b.status)
  return { ok: true, actor, a, booking: b as BookingLite, editable }
}

/** Any booking, for staff. */
export async function resolveAdminBooking(bookingId: string):
  Promise<Fail | { ok: true; a: SupabaseClient; booking: BookingLite }> {
  if (!(await isAdmin())) return { ok: false, error: 'Unauthorized', status: 401 }
  if (!UUID.test(bookingId)) return { ok: false, error: 'Booking not found.', status: 404 }
  const a = svc()
  const { data: b } = await a.from('bookings')
    .select('booking_id, member_no, booking_date, party_size, status').eq('booking_id', bookingId).maybeSingle()
  if (!b) return { ok: false, error: 'Booking not found.', status: 404 }
  return { ok: true, a, booking: b as BookingLite }
}

/** Who on the staff added this: the picked team member when there is one, else the login. */
export async function staffAttribution(): Promise<string | null> {
  try { const id = await actingStaffId(); if (id) return id } catch { /* no signing secret → fall back to the login */ }
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  return user?.email || user?.id || null
}

/**
 * Guest names per booking, each flagged if that guest has already signed in at
 * the door (self-completed or admitted — a refusal does not count). `ready` is
 * false when the schema is not there yet, so callers can say so rather than
 * render an empty list that looks like the truth.
 */
export async function loadBookingGuests(a: SupabaseClient, bookingIds: string[]):
  Promise<{ ready: boolean; byBooking: Map<string, GuestOut[]> }> {
  const byBooking = new Map<string, GuestOut[]>()
  if (!bookingIds.length) return { ready: true, byBooking }
  const { data, error } = await a.from('booking_guests')
    .select('id, booking_id, guest_name, added_by_kind, created_at')
    .in('booking_id', bookingIds).order('created_at', { ascending: true })
  if (error) return { ready: !isMissingSchema(error), byBooking }
  const rows = (data || []) as { id: string; booking_id: string; guest_name: string; added_by_kind: 'member' | 'staff' }[]
  const signed = await signedInGuestIds(a, rows.map(r => r.id))
  for (const r of rows) {
    const list = byBooking.get(r.booking_id) || []
    list.push({ id: r.id, guest_name: r.guest_name, added_by_kind: r.added_by_kind, signed_in: signed.has(r.id) })
    byBooking.set(r.booking_id, list)
  }
  return { ready: true, byBooking }
}

export async function signedInGuestIds(a: SupabaseClient, guestIds: string[]): Promise<Set<string>> {
  if (!guestIds.length) return new Set()
  const { data, error } = await a.from('guest_visits')
    .select('booking_guest_id, referred_reason, decision').in('booking_guest_id', guestIds)
  if (error || !data) return new Set()
  return new Set((data as { booking_guest_id: string; referred_reason: string | null; decision: string | null }[])
    .filter(v => v.decision === 'admitted' || (!v.referred_reason && v.decision == null))
    .map(v => v.booking_guest_id))
}
