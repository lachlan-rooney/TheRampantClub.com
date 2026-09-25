import type { SupabaseClient } from '@supabase/supabase-js'
import { vnDateString } from '@/lib/datetime'

// ═══════════════════════════════════════════════════════════════════════════
// WHO IS IN, IN ONE TAP (2026-09-17)
// ───────────────────────────────────────────────────────────────────────────
// The owner: "Should be very easy for someone to mark guests arrived, booking
// beginning." It was not. Marking someone in was spread over three screens —
// /admin/calendar (Start visit, or Came/No-show on a past day), /admin/tonight
// (Start visit again) and /admin/attendance (a six-field form for one guest) —
// and a visit only produced a length of stay if a staff member later walked it
// through a three-stage flow on a fourth page.
//
// The result is in the data: last week not one booking was marked arrived, 11
// of 14 visits sit half-open, and the report could only say "~5h from 1 visit".
//
// So: three verbs — ARRIVED · LEFT · +GUEST — and one place that knows how to
// do them. This module is that place. It is called by the admin route and by
// the door tablet's own device-gated route, because the same three buttons
// appear in both and a second copy of this logic would drift within a month.
//
// NOTHING NEW IS INVENTED UNDERNEATH. It drives the mechanisms that already
// exist: start_visit_for_member (which links today's booking and flips it to
// arrived), the visit phase cycle, and guest_visits. A booking marked here is
// the same row the weekly report counts.

export interface ArrivalRow {
  key: string
  booking_id: string | null
  member_no: string | null
  name: string
  nickname: string | null
  /** Booked time, HH:MM, or null for a walk-in. */
  time: string | null
  party: number | null
  space: string | null
  /** booked → not here yet · in → visit open · left → departure stamped. */
  state: 'booked' | 'in' | 'left'
  visit_id: string | null
  /** When they arrived, ISO, if a visit has started. */
  since: string | null
  /** Guests logged against this member today. */
  guests: number
}

const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : null)

/** Tonight's list: every booking for the day, plus anyone who walked in. */
export async function arrivalsFor(sb: SupabaseClient, date = vnDateString()): Promise<{ date: string; rows: ArrivalRow[] }> {
  // ── THE DIARY IS ON THIS LIST TOO (owner, 2026-09-25) ───────────────────
  // A private party staff booked into a room is a calendar entry: no member,
  // no booking row, and until now no way to say they had walked in. The
  // headcount arrived with db/calendar_entry_covers.sql and the stamp with
  // db/calendar_entry_arrivals.sql; where neither has run the select fails
  // and the floor sees exactly what it saw before.
  const diaryRes = await sb.from('calendar_entries')
    .select('id, title, start_time, space, covers, arrived_at, arrived_covers')
    .eq('entry_date', date).not('covers', 'is', null)
    .then(r => r, () => ({ data: null, error: true } as never))

  const [bookingsRes, visitsRes, guestsRes] = await Promise.all([
    sb.from('bookings').select('booking_id, member_no, start_time, party_size, space, status, arrived_at, linked_visit_id')
      .eq('booking_date', date).neq('status', 'cancelled'),
    sb.from('visits').select('visit_id, member_no, phase, arrival_time, departure_time')
      .eq('visit_date', date).is('archived_at', null),
    sb.from('guest_visits').select('host_member_no').eq('visit_date', date),
  ])
  const bookings = bookingsRes.data || []
  const visits = visitsRes.data || []
  const guests = guestsRes.data || []

  const nos = [...new Set([...bookings.map(b => b.member_no), ...visits.map(v => v.member_no)].filter(Boolean))] as string[]
  const { data: members } = nos.length
    ? await sb.from('members').select('member_no, full_name, nickname').in('member_no', nos)
    : { data: [] as { member_no: string; full_name: string; nickname: string | null }[] }
  const who = new Map((members || []).map(m => [m.member_no, m]))

  const guestCount = new Map<string, number>()
  for (const g of guests) if (g.host_member_no) guestCount.set(g.host_member_no, (guestCount.get(g.host_member_no) || 0) + 1)

  // The open visit for a member, if any. A visit that has departed still counts
  // as theirs for the day — "left" is a state to show, not a row to drop.
  const visitFor = new Map<string, typeof visits[number]>()
  for (const v of visits) if (v.member_no && !visitFor.has(v.member_no)) visitFor.set(v.member_no, v)

  const state = (v?: { phase: string; departure_time: string | null }): 'booked' | 'in' | 'left' => {
    if (!v) return 'booked'
    if (v.departure_time || v.phase === 'continuum' || v.phase === 'closed') return 'left'
    return 'in'
  }

  const rows: ArrivalRow[] = bookings.map(b => {
    const v = b.member_no ? visitFor.get(b.member_no) : undefined
    const m = b.member_no ? who.get(b.member_no) : undefined
    return {
      key: `b:${b.booking_id}`,
      booking_id: b.booking_id,
      member_no: b.member_no,
      name: m?.full_name || b.member_no || 'Member',
      nickname: m?.nickname || null,
      time: hhmm(b.start_time),
      party: b.party_size ?? null,
      space: b.space ?? null,
      state: state(v) === 'booked' && b.status === 'arrived' ? 'in' : state(v),
      visit_id: v?.visit_id || b.linked_visit_id || null,
      since: v?.arrival_time || b.arrived_at || null,
      guests: b.member_no ? guestCount.get(b.member_no) || 0 : 0,
    }
  })

  // WALK-INS BELONG ON THIS LIST. Someone who came in without booking is the
  // person most likely to go unrecorded, and they are exactly who the report
  // was missing.
  const booked = new Set(bookings.map(b => b.member_no).filter(Boolean))
  for (const v of visits) {
    if (!v.member_no || booked.has(v.member_no)) continue
    const m = who.get(v.member_no)
    rows.push({
      key: `v:${v.visit_id}`,
      booking_id: null,
      member_no: v.member_no,
      name: m?.full_name || v.member_no,
      nickname: m?.nickname || null,
      time: null,
      party: null,
      space: null,
      state: state(v),
      visit_id: v.visit_id,
      since: v.arrival_time,
      guests: guestCount.get(v.member_no) || 0,
    })
  }

  // A party of eight in the Rampant Room sits in the same list as a member's
  // table: same three states, same one tap.
  for (const e of ((diaryRes as { data: unknown[] | null }).data || []) as {
    id: string; title: string; start_time: string | null; space: string | null
    covers: number | null; arrived_at: string | null; arrived_covers: number | null
  }[]) {
    rows.push({
      key: `e:${e.id}`,
      booking_id: null,
      member_no: null,
      name: e.title,
      nickname: null,
      time: e.start_time ? e.start_time.slice(0, 5) : null,
      party: e.arrived_covers ?? e.covers ?? null,
      space: e.space ?? null,
      state: e.arrived_at ? 'in' : 'booked',
      visit_id: null,
      since: e.arrived_at,
      guests: 0,
    })
  }

  // Not here yet first — that is the list staff are working from — then those
  // in the club, then those who have gone.
  const order = { booked: 0, in: 1, left: 2 }
  rows.sort((a, b) => order[a.state] - order[b.state] || (a.time || '').localeCompare(b.time || '') || a.name.localeCompare(b.name))
  return { date, rows }
}

/** THEY'RE HERE. Starts (or re-uses) today's visit, which links the booking and
 *  flips it to arrived. Safe to press twice — the second press returns the same
 *  visit rather than opening a second one. */
export async function markArrived(
  sb: SupabaseClient,
  opts: { member_no?: string | null; booking_id?: string | null; entry_id?: string | null; actor: string },
): Promise<{ ok: true; visit_id: string | null } | { ok: false; error: string }> {
  const date = vnDateString()

  // A DIARY PARTY HAS NO MEMBER AND NO VISIT. There is nobody to open a visit
  // for and nothing to link; the stamp on the entry IS the record. Pressing it
  // twice keeps the first time, because the first one is when they arrived.
  if (opts.entry_id) {
    const { error } = await sb.from('calendar_entries')
      .update({ arrived_at: new Date().toISOString() })
      .eq('id', opts.entry_id).is('arrived_at', null)
    return error ? { ok: false, error: error.message } : { ok: true, visit_id: null }
  }
  const member_no = opts.member_no?.trim() || null

  if (!member_no) {
    // A booking with no member on it (rare, but it exists): mark the booking and
    // stop there — there is no member to open a visit for.
    if (!opts.booking_id) return { ok: false, error: 'Nothing to mark.' }
    const { error } = await sb.from('bookings')
      .update({ status: 'arrived', arrived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('booking_id', opts.booking_id)
    return error ? { ok: false, error: error.message } : { ok: true, visit_id: null }
  }

  const { data: open } = await sb.from('visits')
    .select('visit_id').eq('member_no', member_no).eq('visit_date', date)
    .neq('phase', 'closed').is('archived_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  let visit_id = open?.visit_id || null
  if (!visit_id) {
    const { data, error } = await sb.rpc('start_visit_for_member', { p_member_no: member_no, p_actor: opts.actor })
    if (error) return { ok: false, error: error.message }
    const row = Array.isArray(data) ? data[0] : data
    visit_id = row?.visit_id || null
  }

  // The RPC links ONE confirmed booking. If this tap came from a different
  // booking row, mark that one too rather than leaving it reading "booked".
  if (opts.booking_id) {
    await sb.from('bookings')
      .update({ status: 'arrived', arrived_at: new Date().toISOString(), updated_at: new Date().toISOString(), linked_visit_id: visit_id })
      .eq('booking_id', opts.booking_id).neq('status', 'arrived')
  }
  return { ok: true, visit_id }
}

/** THEY'VE GONE. Walks the visit to 'continuum', which stamps the departure —
 *  and the length of stay is worked out from the two stamps. The cycle only
 *  moves one step at a time, so a visit still at 'overture' takes two. */
export async function markLeft(sb: SupabaseClient, visit_id: string): Promise<{ ok: true; minutes: number | null } | { ok: false; error: string }> {
  const { data: v } = await sb.from('visits')
    .select('visit_id, phase, arrival_time, departure_time, duration_min').eq('visit_id', visit_id).maybeSingle()
  if (!v) return { ok: false, error: 'That visit is not on file.' }
  if (v.departure_time) return { ok: true, minutes: v.duration_min ?? null }

  const now = new Date().toISOString()
  const arrival = v.arrival_time || now
  const patch: Record<string, unknown> = { phase: 'continuum', departure_time: now }
  if (!v.arrival_time) patch.arrival_time = arrival
  if (v.duration_min == null) {
    const mins = Math.round((new Date(now).getTime() - new Date(arrival).getTime()) / 60000)
    // A stay of zero minutes is a mis-tap, not a visit; over a day is a stamp
    // that went wrong. Neither is recorded as a length.
    if (mins > 0 && mins <= 1440) patch.duration_min = mins
  }
  const { error } = await sb.from('visits').update(patch).eq('visit_id', visit_id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, minutes: (patch.duration_min as number) ?? null }
}

/** ONE GUEST, ONE NAME. The owner's call: a name and nothing else. The door
 *  iPad still takes a signature; this is the floor's version for a guest who
 *  simply walked in with a member. */
export async function addGuest(
  sb: SupabaseClient, opts: { name: string; host_member_no?: string | null; actor: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest_name = opts.name.trim()
  if (!guest_name) return { ok: false, error: 'A name is needed.' }
  const { error } = await sb.from('guest_visits').insert({
    guest_name: guest_name.slice(0, 120),
    visit_date: vnDateString(),
    party_size: 1,
    host_member_no: opts.host_member_no?.trim() || null,
    logged_by: opts.actor,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}
