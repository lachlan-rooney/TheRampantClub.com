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
//
// AND THE ARRIVED BOOKINGS THAT NEVER BECAME A VISIT (owner, 2026-09-25: "this
// is not picking up the arrived bookings … so it says zero minutes. That's not
// true"). Marking a PAST booking "Came" on the calendar sets the booking to
// arrived and stops: no visit is opened, so there is no arrival and no
// departure, so the week reported nought minutes for a night people were in.
//
// The same hole swallows a visit somebody OPENED and never closed on a past
// night: an arrival with no departure is not a length of stay, and it used to
// stop the booking being counted as well.
//
// Those bookings are counted from THE TIMES ON THE BOOKING, and the owner
// settled which times those are (2026-09-25): "The staff edit the booking
// times which shows when people leave." db/bookings_booked_vs_actual.sql says
// the same in the schema — start_time and end_time are the CORRECTED ACTUAL,
// booked_start_time and booked_end_time are what was first asked for. So the
// actual is read first and the booked window is only the fallback; this file
// had the preference the wrong way round for a few hours on the 25th, which
// would have reported the plan and called it the sitting.
//
// It is still reported SEPARATELY as minutes_estimated, because a time typed
// in by a person who was there is a better record than a card tap and still
// not two timestamps. A window that reads as longer than
// MAX_SITTING_MIN is not counted at all and shows up in bookings_unmeasured:
// "06:10 → 01:07" is a typing slip, not a nineteen-hour sitting, and averaging
// it into the week would be worse than admitting we do not know.
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
  minutes_in_club: number        // measured + estimated, which is what is shown
  minutes_measured: number       // from visits and guest rows that carry a duration
  minutes_estimated: number      // from arrived bookings with no visit behind them
  bookings_unmeasured: number    // arrived, no visit, and no window worth trusting
  /** Arrived bookings whose times were corrected after the fact — a staff
   *  record of when the member actually left. */
  bookings_corrected: number
  visits_total: number           // visits on file this week
  visits_with_length: number     // of those, how many carry a length at all
  departures_stamped: number     // of those, how many were stamped by tapping LEFT
  open_visits: number      // visits from today still counting up
  by_day: DayAttendance[]
  generated_at: string
}

const VN_OFFSET_MS = 7 * 3600 * 1000
const OPEN_VISIT_CAP_MIN = 12 * 60
/** Longer than this and the booked window is a data-entry slip, not a sitting. */
const MAX_SITTING_MIN = 8 * 60

/** "19:45:00" → 1185. Null for anything that is not a clock time. */
function minutesOfClock(t: string | null | undefined): number | null {
  const m = typeof t === 'string' ? t.match(/^(\d{1,2}):(\d{2})/) : null
  if (!m) return null
  const mins = Number(m[1]) * 60 + Number(m[2])
  return mins >= 0 && mins < 24 * 60 ? mins : null
}

/** The length of a booked sitting, allowing for one that runs past midnight. */
export function bookedMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = minutesOfClock(start), b = minutesOfClock(end)
  if (a === null || b === null) return null
  const span = b > a ? b - a : b === a ? 0 : (24 * 60 - a) + b   // the club closes at 00:30
  return span > 0 && span <= MAX_SITTING_MIN ? span : null
}

/** A timestamptz as a Vietnam calendar date. */
export const vnDateOf = (iso: string): string => new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(from + 'T00:00:00Z')
  while (d.toISOString().slice(0, 10) <= to) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}

interface VisitRow { member_no: string; visit_date: string; arrival_time: string | null; departure_time?: string | null; duration_min: number | null; phase: string | null }
interface TapRow { member_number: string; seen_at: string }
interface BookingRow {
  booking_id: string; member_no: string; booking_date: string
  party_size: number | null; status: string; arrived_at: string | null
  linked_visit_id?: string | null
  booked_start_time?: string | null; booked_end_time?: string | null
  start_time?: string | null; end_time?: string | null
}
interface GuestRow { visit_date: string; party_size: number | null; duration_min: number | null; referred_reason?: string | null; decision?: string | null; booking_id?: string | null }

export async function weekAttendance(sb: SupabaseClient, from: string, to: string, now: Date = new Date()): Promise<WeekAttendance> {
  const today = vnDateOf(now.toISOString())

  const [visitsRes, tapsRes, bookingsRes] = await Promise.all([
    sb.from('visits').select('member_no, visit_date, arrival_time, departure_time, duration_min, phase')
      .is('archived_at', null).gte('visit_date', from).lte('visit_date', to),
    sb.from('card_presence').select('member_number, seen_at')
      .gte('seen_at', `${from}T00:00:00+07:00`).lte('seen_at', `${to}T23:59:59.999+07:00`),
    sb.from('bookings').select('booking_id, member_no, booking_date, party_size, status, arrived_at, linked_visit_id, booked_start_time, booked_end_time, start_time, end_time')
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
  // Whose night already has time against it, so the booking fallback below does
  // not count the same person twice.
  const counted = new Set<string>()
  for (const v of visits) {
    if (typeof v.duration_min === 'number') { minutes += v.duration_min; counted.add(`${v.member_no}|${v.visit_date}`); continue }
    if (v.arrival_time && v.visit_date === today && v.phase !== 'closed') {
      const elapsed = Math.floor((now.getTime() - new Date(v.arrival_time).getTime()) / 60000)
      if (elapsed > 0) { minutes += Math.min(elapsed, OPEN_VISIT_CAP_MIN); openVisits++; counted.add(`${v.member_no}|${v.visit_date}`) }
    }
    // Anything else is a visit somebody opened on a past night and never
    // closed: an arrival with no departure, which is no length of stay at all.
    // It must NOT block the booking fallback — that was the case that left a
    // whole week reading 0m with two bookings marked arrived on it.
  }
  for (const g of guestRows) if (typeof g.duration_min === 'number') minutes += g.duration_min
  const measured = minutes

  // ── the arrived bookings nobody opened a visit for ───────────────────────
  // Their member has no visit on that date, so nothing above has counted them.
  let estimated = 0
  let unmeasured = 0
  let corrected = 0
  for (const b of arrived) {
    // `counted` holds the nights that already carry time — a closed visit, or
    // one still running today. A linked visit that was never closed carries
    // none, so it does not exempt the booking.
    if (b.member_no && counted.has(`${b.member_no}|${b.booking_date}`)) continue
    // The corrected actual first; what was booked only if nobody corrected it.
    const span = bookedMinutes(b.start_time ?? b.booked_start_time, b.end_time ?? b.booked_end_time)
    if (span === null) { unmeasured++; continue }
    // Corrected means somebody moved the times after the booking was made:
    // the original is snapshotted on insert and never touched again, so a
    // difference is a person editing what happened. Where the snapshot is
    // null the row predates the column and cannot be told apart.
    if (b.booked_end_time && b.end_time && b.end_time !== b.booked_end_time) corrected++
    estimated += span
  }
  minutes += estimated

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
    // ── HOW MUCH OF THIS IS A MEASUREMENT ──────────────────────────────────
    // Owner, 2026-09-25, on the time figure: "an account, not a measurement."
    // Checked and true — across September not one visit carries a DEPARTURE:
    // every length on file was typed in afterwards. A length somebody
    // remembered is worth having and is not the same fact as two stamps, so
    // the surfaces are given both numbers and say which is which.
    visits_total: visits.length,
    visits_with_length: visits.filter(v => typeof v.duration_min === 'number').length,
    departures_stamped: visits.filter(v => !!v.departure_time).length,
    minutes_measured: measured,
    minutes_estimated: estimated,
    bookings_unmeasured: unmeasured,
    bookings_corrected: corrected,
    open_visits: openVisits,
    by_day: byDay,
    generated_at: now.toISOString(),
  }
}
