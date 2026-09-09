import type { SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// THE WEEKLY TRACKER — cash in against cash out, rolling to a monthly close.
// ───────────────────────────────────────────────────────────────────────────
// "CASH IN", NEVER "REVENUE". A member's top-up is money in the door and a
// liability until they drink it; annual dues land a whole year in one week. On
// a cash basis both are correct, and both are the wrong number for revenue
// against a target. Labelling the line honestly is what makes the deficit
// coherent — cash received against cash spent — without building a second
// accounting basis nobody asked for.
//
// WEEKS ARE CLIPPED TO THE MONTH. Every day of the month belongs to exactly one
// week bucket, and costs and targets are smoothed PER DAY, so the weeks sum to
// the month exactly. That is also what stops quarterly rent spiking one week in
// twelve: the cost base is a monthly figure spread evenly, never a payment date.

export interface TrackerWeek {
  week_start: string; week_end: string      // clipped to the month
  days_in_month: number
  dues_vnd: number
  topups_vnd: number
  /** null means NOT ENTERED. Never coerce to 0 — on a chart they are the same
   *  bar and mean opposite things. */
  whisky_vnd: number | null
  whisky_week_key: string                   // the real Monday, for entry
  cash_in_vnd: number                       // dues + topups + whisky (missing counts as 0 here, flagged separately)
  cash_in_usd: number
  target_usd: number
  cost_usd: number
  joins: { tier: string; amount_vnd: number }[]
  visits: number
  distinct_members: number
  /** USAGE, not income. A member spending their monthly credit generates no
   *  cash and must never appear in cash-in. */
  credit_consumed_vnd: number
}

export interface Tracker {
  month: string; month_label: string
  rate: number; target_usd: number; cost_base_usd: number; cost_base_note: string | null
  settings_updated_at: string
  weeks: TrackerWeek[]
  mtd_cash_usd: number
  mtd_target_usd: number
  projected_close: { cash_usd: number; cost_usd: number; surplus_usd: number }
  trajectory: { this_week_usd: number; last_week_usd: number; delta_usd: number | null }
  whisky: { weeks_missing: string[]; last_entered_week: string | null; days_since_entry: number | null }
  usage: {
    visits: number; distinct_members: number
    credit_consumed_vnd: number
    /** STAFF-RECORDED, NOT MEASURED. Kept separate from anything measured so it
     *  is never quoted back as a metric. */
    staff_recorded_median_min: number | null
    staff_recorded_coverage_pct: number
  }
  /** Dormancy reads BOOKINGS, not card taps. A tap is a habit the member may not
   *  have; a booking is an intention they made. Honorary members are counted
   *  apart — they are complimentary, so mixing them into a renewal-risk figure
   *  measures the wrong population. */
  dormancy: {
    paying_members: number; paying_no_booking_30: number; paying_no_booking_60: number; paying_never_booked: number
    honorary_members: number; honorary_never_booked: number
  }
  /** What booked-versus-attended can actually be computed from, today. */
  attendance: {
    bookings_in_month: number
    arrival_recorded: number
    end_time_recorded: number
    walk_in_visits: number
    booked_times_preserved: number
    measurable: boolean
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => iso(new Date(new Date(s + 'T00:00:00Z').getTime() + n * 864e5))
const mondayOf = (s: string) => {
  const d = new Date(s + 'T00:00:00Z')
  return addDays(iso(d), -(((d.getUTCDay() + 6) % 7)))
}

export async function buildTracker(sb: SupabaseClient, asOfDate: string): Promise<Tracker> {
  const month = asOfDate.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const last = iso(new Date(Date.UTC(y, m, 0)))
  const daysInMonth = Number(last.slice(8))

  const { data: cfg } = await sb.from('finance_settings').select('*').eq('id', true).single()
  const rate = Number(cfg?.usd_vnd_rate) || 26000
  const target_usd = Number(cfg?.monthly_target_usd) || 0
  const cost_base_usd = Number(cfg?.monthly_cost_base_usd) || 0

  const [{ data: pays }, { data: cards }, { data: visits }, { data: whisky }, { data: members }] = await Promise.all([
    sb.from('membership_payments').select('payment_date, amount_vnd, tier_snap, status')
      .eq('status', 'active').gte('payment_date', first).lte('payment_date', last),
    sb.from('card_transactions').select('created_at, amount_vnd, kind')
      .gte('created_at', first).lte('created_at', last + 'T23:59:59'),
    sb.from('visits').select('visit_date, member_no, duration_min').is('archived_at', null),
    sb.from('whisky_weekly_sales').select('week_start, amount_vnd, entered_at'),
    sb.from('members').select('member_no, status, tier'),
  ])
  // Base columns only. `booked_start_time` arrives with
  // db/bookings_booked_vs_actual.sql, and selecting a column that does not exist
  // yet fails the WHOLE query — which silently returned no bookings at all and
  // reported every paying member as never having booked. A wrong dormancy figure
  // is worse than a missing one: it sends someone to call members who were in
  // last week.
  const { data: bookings } = await sb.from('bookings')
    .select('member_no, booking_date, start_time, end_time, status, arrived_at')
  // Asked for separately so its absence costs nothing.
  const { data: preserved } = await sb.from('bookings').select('booking_date, booked_start_time')

  const whiskyBy = new Map((whisky || []).map(w => [w.week_start as string, Number(w.amount_vnd) || 0]))

  // ── Build week buckets by walking the month's DAYS ────────────────────────
  const buckets = new Map<string, string[]>()          // monday → [dates in month]
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const k = mondayOf(date)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push(date)
  }

  const dailyTarget = target_usd / daysInMonth
  const dailyCost = cost_base_usd / daysInMonth

  const weeks: TrackerWeek[] = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mondayKey, days]) => {
      const inSet = new Set(days)
      const wPays = (pays || []).filter(p => inSet.has(String(p.payment_date).slice(0, 10)))
      const dues = wPays.reduce((s, p) => s + (Number(p.amount_vnd) || 0), 0)
      const wCards = (cards || []).filter(c => inSet.has(String(c.created_at).slice(0, 10)))
      const topups = wCards.filter(c => c.kind === 'topup').reduce((s, c) => s + Math.abs(Number(c.amount_vnd) || 0), 0)
      const credit = wCards.filter(c => c.kind === 'charge').reduce((s, c) => s + Math.abs(Number(c.amount_vnd) || 0), 0)
      const wVisits = (visits || []).filter(v => inSet.has(String(v.visit_date).slice(0, 10)))
      const whiskyVal = whiskyBy.has(mondayKey) ? whiskyBy.get(mondayKey)! : null
      const cash = dues + topups + (whiskyVal ?? 0)
      return {
        week_start: days[0], week_end: days[days.length - 1], days_in_month: days.length,
        dues_vnd: dues, topups_vnd: topups,
        whisky_vnd: whiskyVal, whisky_week_key: mondayKey,
        cash_in_vnd: cash, cash_in_usd: Math.round(cash / rate),
        // Pro-rata BY DAY, so a clipped first or last week is not credited a
        // full week's target and the weeks still sum to the month.
        target_usd: Math.round(dailyTarget * days.length),
        cost_usd: Math.round(dailyCost * days.length),
        joins: wPays.map(p => ({ tier: String(p.tier_snap || 'unknown'), amount_vnd: Number(p.amount_vnd) || 0 })),
        visits: wVisits.length,
        distinct_members: new Set(wVisits.map(v => v.member_no)).size,
        credit_consumed_vnd: credit,
      }
    })

  const today = asOfDate.slice(0, 10)
  const elapsed = weeks.filter(w => w.week_start <= today)
  const mtd_cash_usd = elapsed.reduce((s, w) => s + w.cash_in_usd, 0)
  const mtd_target_usd = elapsed.reduce((s, w) => s + w.target_usd, 0)

  const thisWeek = elapsed[elapsed.length - 1]
  const lastWeek = elapsed[elapsed.length - 2]

  // ── Whisky staleness: a forgotten Monday is MISSING, not zero ─────────────
  const weeksMissing = weeks.filter(w => w.whisky_vnd === null && w.week_start <= today).map(w => w.whisky_week_key)
  const entered = (whisky || []).slice().sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))[0]
  const daysSince = entered?.entered_at
    ? Math.floor((new Date(today + 'T00:00:00Z').getTime() - new Date(entered.entered_at as string).getTime()) / 864e5)
    : null

  // ── Usage. TIME IN CLUB IS STAFF-RECORDED, NOT COMPUTED ──────────────────
  // departure_time is present on a small minority of visits, and where both
  // exist it disagrees with duration_min. Deriving a dwell time from arrival
  // and a guessed end would be inventing a number, so only what staff actually
  // recorded is reported, with its coverage stated.
  const monthVisits = (visits || []).filter(v => String(v.visit_date) >= first && String(v.visit_date) <= last)
  const durs = monthVisits.map(v => v.duration_min).filter((d): d is number => typeof d === 'number').sort((a, b) => a - b)
  const usage = {
    visits: monthVisits.length,
    distinct_members: new Set(monthVisits.map(v => v.member_no)).size,
    credit_consumed_vnd: weeks.reduce((s, w) => s + w.credit_consumed_vnd, 0),
    staff_recorded_median_min: durs.length ? durs[Math.floor(durs.length / 2)] : null,
    staff_recorded_coverage_pct: monthVisits.length ? Math.round((durs.length / monthVisits.length) * 100) : 0,
  }

  // ── Dormancy, from BOOKINGS ──────────────────────────────────────────────
  // Not from card taps. A tap is a habit the member may simply not have — one
  // member here has booked within the month and last tapped in June — so a tap
  // figure sends someone to call members who have been in every week. A booking
  // is an intention the member made, and the club would rather they booked.
  const lastBooking = new Map<string, string>()
  for (const b of bookings || []) {
    if (b.status === 'cancelled') continue
    const k = String(b.member_no), d = String(b.booking_date)
    if (!lastBooking.has(k) || d > lastBooking.get(k)!) lastBooking.set(k, d)
  }
  const active = (members || []).filter(m => m.status === 'Active')
  const paying = active.filter(m => String(m.tier).toLowerCase() !== 'honorary')
  const honorary = active.filter(m => String(m.tier).toLowerCase() === 'honorary')
  const bookingAge = (mn: string) => {
    const l = lastBooking.get(mn)
    return l ? (new Date(today + 'T00:00:00Z').getTime() - new Date(l + 'T00:00:00Z').getTime()) / 864e5 : Infinity
  }
  const dormancy = {
    paying_members: paying.length,
    paying_no_booking_30: paying.filter(m => bookingAge(String(m.member_no)) > 30).length,
    paying_no_booking_60: paying.filter(m => bookingAge(String(m.member_no)) > 60).length,
    paying_never_booked: paying.filter(m => !lastBooking.has(String(m.member_no))).length,
    honorary_members: honorary.length,
    honorary_never_booked: honorary.filter(m => !lastBooking.has(String(m.member_no))).length,
  }

  // ── Booked versus attended: what is measurable TODAY ─────────────────────
  // arrived_at exists on the table and is filled on none of the bookings, and
  // every row's status is 'confirmed', so a no-show is indistinguishable from an
  // attendance. Reporting the gap would mean reporting zero and calling it good
  // news. So the tracker reports the COVERAGE instead, until the inputs exist.
  const monthBookings = (bookings || []).filter(b => String(b.booking_date) >= first && String(b.booking_date) <= last)
  const bookedDays = new Set((bookings || []).map(b => `${b.member_no}|${b.booking_date}`))
  const attendance = {
    bookings_in_month: monthBookings.length,
    arrival_recorded: monthBookings.filter(b => b.arrived_at).length,
    end_time_recorded: monthBookings.filter(b => b.end_time).length,
    walk_in_visits: monthVisits.filter(v => !bookedDays.has(`${v.member_no}|${v.visit_date}`)).length,
    booked_times_preserved: (preserved || [])
      .filter(b => b.booked_start_time && String(b.booking_date) >= first && String(b.booking_date) <= last).length,
    measurable: monthBookings.length > 0 && monthBookings.some(b => b.arrived_at),
  }

  const closeCash = weeks.reduce((s, w) => s + w.cash_in_usd, 0)
  return {
    month,
    month_label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    rate, target_usd, cost_base_usd, cost_base_note: (cfg?.cost_base_note as string) ?? null,
    settings_updated_at: String(cfg?.updated_at ?? ''),
    weeks,
    mtd_cash_usd, mtd_target_usd,
    projected_close: { cash_usd: closeCash, cost_usd: cost_base_usd, surplus_usd: closeCash - cost_base_usd },
    trajectory: {
      this_week_usd: thisWeek?.cash_in_usd ?? 0,
      last_week_usd: lastWeek?.cash_in_usd ?? 0,
      delta_usd: lastWeek ? (thisWeek?.cash_in_usd ?? 0) - lastWeek.cash_in_usd : null,
    },
    whisky: { weeks_missing: weeksMissing, last_entered_week: (entered?.week_start as string) ?? null, days_since_entry: daysSince },
    usage, dormancy, attendance,
  }
}
