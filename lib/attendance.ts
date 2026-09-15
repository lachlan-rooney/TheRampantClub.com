import type { SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// WHO ACTUALLY CAME IN — a week, counted from arrivals, not from bookings.
// ───────────────────────────────────────────────────────────────────────────
// Lachlan, 2026-09-15: "a live total attendance at the top of the calendar each
// week", plus "total bookings" and "time spent in club".
//
// ATTENDANCE = member-days + guests.
//   · A MEMBER-DAY is one member present on one Vietnam date, however they were
//     recorded: a card tap (card_presence), a started visit (visits), or their
//     booking marked arrived. Brandon on Thursday and again on Friday is 2; a tap
//     AND a visit on the same night is still 1.
//   · GUESTS are people who are not members: door sign-ins (not refused, not
//     still waiting on the duty manager), guests staff logged by hand, and the
//     rest of an ARRIVED booking's party (party_size − the member). Where the
//     door already signed in that booking's guests, the larger of the two is
//     used, never both.
//
// Bookings that have not arrived count toward BOOKINGS, never toward attendance:
// a table for ten is not ten people in the room until they are.
//
// TIME IN CLUB = recorded visit durations + guest durations, plus — for a visit
// started today with no duration yet — the time since it started (capped at 12h,
// so a visit nobody closed cannot run up a week of hours).
// ═══════════════════════════════════════════════════════════════════════════

export interface DayAttendance { date: string; attendance: number; members: number; guests: number }

export interface WeekAttendance {
  from: string
  to: string
  today: string
  attendance: number
  members: number          // distinct members seen at least once this week
  member_days: number
  guests: number
  today_attendance: number | null   // null when today is outside the week shown
  bookings: { total: number; arrived: number; people: number }
  minutes_in_club: number
  open_visits: number      // visits from today still counting up
  by_day: DayAttendance[]
  generated_at: string
}

const VN_OFFSET_MS = 7 * 3600 * 1000
const OPEN_VISIT_CAP_MIN = 12 * 60

/** A timestamptz as a Vietnam calendar date. */
export const vnDateOf = (iso: string): string => new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(from + 'T00:00:00Z')
  while (d.toISOString().slice(0, 10) <= to) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}

interface VisitRow { member_no: string; visit_date: string; arrival_time: string | null; duration_min: number | null; phase: string | null }
interface TapRow { member_number: string; seen_at: string }
interface BookingRow { booking_id: string; member_no: string; booking_date: string; party_size: number | null; status: string; arrived_at: string | null }
interface GuestRow { visit_date: string; party_size: number | null; duration_min: number | null; referred_reason?: string | null; decision?: string | null; booking_id?: string | null }

export async function weekAttendance(sb: SupabaseClient, from: string, to: string, now: Date = new Date()): Promise<WeekAttendance> {
  const today = vnDateOf(now.toISOString())

  const [visitsRes, tapsRes, bookingsRes] = await Promise.all([
    sb.from('visits').select('member_no, visit_date, arrival_time, duration_min, phase')
      .is('archived_at', null).gte('visit_date', from).lte('visit_date', to),
    sb.from('card_presence').select('member_number, seen_at')
      .gte('seen_at', `${from}T00:00:00+07:00`).lte('seen_at', `${to}T23:59:59.999+07:00`),
    sb.from('bookings').select('booking_id, member_no, booking_date, party_size, status, arrived_at')
      .gte('booking_date', from).lte('booking_date', to).neq('status', 'cancelled'),
  ])
  for (const r of [visitsRes, tapsRes, bookingsRes]) if (r.error) throw new Error(r.error.message)

  // Door columns arrive with db/guest_signin.sql; before that, count every row.
  let guestRows: GuestRow[]
  const door = await sb.from('guest_visits')
    .select('visit_date, party_size, duration_min, referred_reason, decision, booking_id')
    .gte('visit_date', from).lte('visit_date', to)
  if (door.error) {
    const plain = await sb.from('guest_visits').select('visit_date, party_size, duration_min').gte('visit_date', from).lte('visit_date', to)
    if (plain.error) throw new Error(plain.error.message)
    guestRows = (plain.data || []) as GuestRow[]
  } else {
    // A refusal is not a guest in the club, and neither is someone still waiting.
    guestRows = ((door.data || []) as GuestRow[]).filter(g => g.decision !== 'refused' && !(g.referred_reason && !g.decision))
  }

  const visits = (visitsRes.data || []) as VisitRow[]
  const taps = (tapsRes.data || []) as TapRow[]
  const bookings = (bookingsRes.data || []) as BookingRow[]
  const arrived = bookings.filter(b => b.status === 'arrived' || !!b.arrived_at)
  const arrivedIds = new Set(arrived.map(b => b.booking_id))

  // ── members, per day ─────────────────────────────────────────────────────
  const memberDays = new Map<string, Set<string>>()
  const addMember = (date: string, member: string) => {
    if (!member || date < from || date > to) return
    if (!memberDays.has(date)) memberDays.set(date, new Set())
    memberDays.get(date)!.add(member)
  }
  for (const v of visits) addMember(v.visit_date, v.member_no)
  for (const t of taps) addMember(vnDateOf(t.seen_at), t.member_number)
  for (const b of arrived) addMember(b.booking_date, b.member_no)

  // ── guests, per day ──────────────────────────────────────────────────────
  const guestsByDate = new Map<string, number>()
  const addGuests = (date: string, n: number) => { if (n > 0) guestsByDate.set(date, (guestsByDate.get(date) || 0) + n) }
  const linkedToArrived = new Map<string, number>()
  for (const g of guestRows) {
    const n = g.party_size || 1
    if (g.booking_id && arrivedIds.has(g.booking_id)) linkedToArrived.set(g.booking_id, (linkedToArrived.get(g.booking_id) || 0) + n)
    else addGuests(g.visit_date, n)
  }
  for (const b of arrived) {
    addGuests(b.booking_date, Math.max(Math.max(0, (b.party_size || 1) - 1), linkedToArrived.get(b.booking_id) || 0))
  }

  // ── time in club ─────────────────────────────────────────────────────────
  let minutes = 0
  let openVisits = 0
  for (const v of visits) {
    if (typeof v.duration_min === 'number') { minutes += v.duration_min; continue }
    if (v.arrival_time && v.visit_date === today && v.phase !== 'closed') {
      const elapsed = Math.floor((now.getTime() - new Date(v.arrival_time).getTime()) / 60000)
      if (elapsed > 0) { minutes += Math.min(elapsed, OPEN_VISIT_CAP_MIN); openVisits++ }
    }
  }
  for (const g of guestRows) if (typeof g.duration_min === 'number') minutes += g.duration_min

  const byDay: DayAttendance[] = eachDay(from, to).map(date => {
    const m = memberDays.get(date)?.size || 0
    const gs = guestsByDate.get(date) || 0
    return { date, attendance: m + gs, members: m, guests: gs }
  })
  const allMembers = new Set<string>()
  for (const s of memberDays.values()) for (const m of s) allMembers.add(m)
  const todayRow = byDay.find(d => d.date === today)

  return {
    from, to, today,
    attendance: byDay.reduce((s, d) => s + d.attendance, 0),
    members: allMembers.size,
    member_days: byDay.reduce((s, d) => s + d.members, 0),
    guests: byDay.reduce((s, d) => s + d.guests, 0),
    today_attendance: todayRow ? todayRow.attendance : null,
    bookings: {
      total: bookings.length,
      arrived: arrived.length,
      people: bookings.filter(b => b.status !== 'no_show').reduce((s, b) => s + (b.party_size || 1), 0),
    },
    minutes_in_club: minutes,
    open_visits: openVisits,
    by_day: byDay,
    generated_at: now.toISOString(),
  }
}
