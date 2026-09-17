import type { SupabaseClient } from '@supabase/supabase-js'
import { summariseFinancials, type Financials } from './financials'
import { weekAttendance } from '@/lib/attendance'

// Aggregates a VN week into a FROZEN snapshot for the weekly report. Runs the
// same fan-out for the week and the prior week to compute week-over-week deltas.
// Service-role client; every section is guarded so a missing table never breaks
// the whole gather. Mirrors the safe() idiom in app/api/cron/weekly-digest.

async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return (data ?? fallback) as T } catch { return fallback }
}

function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10)
}
function dayLabel(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}
function eachDay(start: string, end: string): string[] {
  const out: string[] = []; let c = start
  while (c <= end) { out.push(c); c = addDays(c, 1) }
  return out
}

export interface WeekMetrics {
  visits: number
  unique_members: number
  avg_minutes: number
  total_member_minutes: number   // sum of closed member-visit durations
  /** How many visits that total is actually built from. "Members spent ~5h" read
   *  as the whole week's time in the club when it came from ONE logged visit out
   *  of seven people in (2026-09-17) — the hours need their denominator. */
  timed_visits?: number
  guest_visits: number           // guest-attendance records logged
  guest_heads: number            // actual guests (sum of party sizes)
  guest_minutes: number          // sum of guest durations
  visits_by_day: { day: string; label: string; count: number }[]
  footfall_unique: number
  footfall_by_day: { day: string; count: number }[]
  bookings: number
  arrived: number
  guest_proxy: number
  new_members: number
  signed: number
  pipeline_movements: number
  // ── Arrivals, counted exactly as the live attendance strip on /admin/calendar
  //    counts them (lib/attendance.ts), 2026-09-15. Optional: a report frozen
  //    before then does not carry them, and render.ts falls back to the fields above.
  attendance?: number        // member-days + guests who actually came in
  member_days?: number
  booked_people?: number     // party sizes on bookings not cancelled or no-show
}

// ── WHAT THE SYSTEM ALREADY KNOWS AND THE REPORT NEVER SAID (2026-09-17) ─────
// The owner: "barely any pulls from across the system". It was true — the report
// read visits, bookings, prospects and fixtures, and left the rest of the club
// to be typed into eight text boxes. Money, the team's week, complaints and the
// press are all recorded already. Each block is separately guarded: a club with
// no till data still gets a report, it just says less.

/** Money that actually exists in the system: membership fees and card top-ups.
 *  There is NO expense table and no bar till — so this is revenue recorded here,
 *  never "profit", and the report must not imply otherwise. */
export interface MoneyBlock {
  week: {
    membership_total: number
    membership_count: number
    payments: { name: string; tier: string; amount: number; method: string }[]
    card_topups: number
    card_charges: number
  }
  mtd: {
    month_label: string
    membership: number
    card_topups: number
    total: number
    /** From finance_settings (USD target × rate), null if never configured. */
    target_vnd: number | null
    cost_base_vnd: number | null
    pct_of_target: number | null
  }
}

/** The team's week: the shift board, what staff actually did, complaints, cover. */
export interface OpsBlock {
  tasks: { total: number; done: number; in_progress: number; blocked: number; not_started: number; pct_done: number | null }
  staff_actions: number
  top_actions: { what: string; count: number }[]
  complaints: { opened: number; resolved: number; open_now: number }
  away: { name: string; kind: string; start: string; end: string }[]
}

export interface AutoData {
  period: { start: string; end: string; label: string }
  usage: WeekMetrics
  money?: MoneyBlock
  ops?: OpsBlock
  press?: { title: string; outlet: string | null; link: string | null; date: string }[]
  events: { fixtures: { title: string; sport: string; date: string; signups: number; max: number | null }[]; calendar_by_kind: Record<string, number> }
  pipeline: { funnel: { stage: string; count: number }[]; conversion_pct: number; movements: Record<string, number>; interviews: { name: string; date: string; interviewer: string | null }[]; signed: number; new_leads?: number; onboarded?: { name: string; tier: string }[] }
  members: { new_total: number; by_tier: Record<string, number>; complimentary: number; paid: number }
  member_of_week: { member_no: string; name: string; visits: number } | null
  deltas: Record<string, number | null>
  generated_at: string
}

const STAGES = ['Lead', 'Initial Contact', 'Interview Scheduled', 'Interview Complete', 'Application Received', 'Onboarded']

// WHO COUNTS AS A GUEST WHO CAME IN. Since the door sign-in (2026-09-14,
// db/guest_signin.sql) guest_visits also holds two kinds of row that are NOT a
// guest in the club: one the duty manager REFUSED, and one still WAITING on the
// duty manager. Counting either would inflate "Who's Been In". Before that SQL has
// run the columns do not exist, the first query errors, and the old count stands —
// it must never fall through to an empty list that reads as "no guests this week".
async function countedGuests(sb: SupabaseClient, start: string, end: string): Promise<{ duration_min: number | null; party_size: number | null }[]> {
  try {
    const door = await sb.from('guest_visits').select('duration_min, party_size, referred_reason, decision')
      .gte('visit_date', start).lte('visit_date', end)
    if (!door.error) {
      return ((door.data || []) as { duration_min: number | null; party_size: number | null; referred_reason: string | null; decision: string | null }[])
        .filter(g => g.decision !== 'refused' && !(g.referred_reason && !g.decision))
    }
  } catch { /* fall through to the pre-door count */ }
  return safe<{ duration_min: number | null; party_size: number | null }[]>(
    sb.from('guest_visits').select('duration_min, party_size').gte('visit_date', start).lte('visit_date', end), [])
}

// The headline metrics for a [start,end] window (used for both this + prior week).
async function windowMetrics(sb: SupabaseClient, start: string, end: string): Promise<WeekMetrics> {
  const visits = await safe<{ member_no: string; visit_date: string; duration_min: number | null }[]>(
    sb.from('visits').select('member_no, visit_date, duration_min').is('archived_at', null).gte('visit_date', start).lte('visit_date', end), [])
  const presence = await safe<{ member_number: string; seen_at: string }[]>(
    sb.from('card_presence').select('member_number, seen_at').gte('seen_at', start).lte('seen_at', end + 'T23:59:59'), [])
  const bookings = await safe<{ party_size: number; status: string; arrived_at: string | null }[]>(
    sb.from('bookings').select('party_size, status, arrived_at').gte('booking_date', start).lte('booking_date', end), [])
  const guests = await countedGuests(sb, start, end)
  const newMembers = await safe<{ member_no: string }[]>(
    sb.from('members').select('member_no').gte('join_date', start).lte('join_date', end), [])
  const signed = await safe<{ id: string }[]>(
    sb.from('signing_invitations').select('id').eq('status', 'signed').gte('created_at', start).lte('created_at', end + 'T23:59:59'), [])
  const moves = await safe<{ id: string }[]>(
    sb.from('prospect_activity').select('id').gte('created_at', start).lte('created_at', end + 'T23:59:59'), [])

  // WHO CAME IN, counted the way the calendar's live strip counts it: a card
  // tap, a started visit, or a booking marked arrived — once per member per day —
  // plus guests. Counting recorded visits alone reported ONE member for 7–13 Sep,
  // when six had tapped in and five bookings had been made (2026-09-15). If the
  // attendance read fails, the older visit-only figures stand rather than a blank.
  const att = await weekAttendance(sb, start, end).catch(() => null)

  const days = eachDay(start, end)
  // "By day" follows people in, not recorded visits, when the arrivals count is available.
  const visitsByDay = att
    ? att.by_day.map(x => ({ day: x.date, label: dayLabel(x.date), count: x.attendance }))
    : days.map(d => ({ day: d, label: dayLabel(d), count: visits.filter(v => v.visit_date === d).length }))
  const closed = visits.filter(v => typeof v.duration_min === 'number')
  const footfallSet = new Set(presence.map(p => `${p.member_number}|${p.seen_at.slice(0, 10)}`))
  const footfallByDay = days.map(d => ({ day: d, count: new Set(presence.filter(p => p.seen_at.slice(0, 10) === d).map(p => p.member_number)).size }))

  const memberMinutes = closed.reduce((s, v) => s + (v.duration_min || 0), 0)
  return {
    visits: visits.length,
    unique_members: att ? att.members : new Set(visits.map(v => v.member_no)).size,
    avg_minutes: closed.length ? Math.round(memberMinutes / closed.length) : 0,
    total_member_minutes: memberMinutes,
    timed_visits: closed.length,
    guest_visits: guests.length,
    guest_heads: guests.reduce((s, g) => s + (g.party_size || 1), 0),
    guest_minutes: guests.reduce((s, g) => s + (g.duration_min || 0), 0),
    visits_by_day: visitsByDay,
    footfall_unique: new Set(presence.map(p => p.member_number)).size,
    footfall_by_day: footfallByDay,
    bookings: bookings.length,
    arrived: bookings.filter(b => b.arrived_at).length,
    guest_proxy: bookings.reduce((s, b) => s + Math.max(0, (b.party_size || 1) - 1), 0),
    new_members: newMembers.length,
    signed: signed.length,
    pipeline_movements: moves.length,
    attendance: att?.attendance,
    member_days: att?.member_days,
    booked_people: att?.bookings.people,
  }
}

const delta = (a: number, b: number) => a - b

// ── MONEY ───────────────────────────────────────────────────────────────────
// Membership fees (membership_payments, active rows only — a voided receipt is
// not revenue) plus member card top-ups. Month-to-date runs from the 1st of the
// week's closing month to the week's end, so the figure never counts days the
// report has not reached. The target comes from finance_settings in USD; if the
// rate or the target is missing we show the money and no target rather than
// inventing a denominator.
async function moneyBlock(sb: SupabaseClient, start: string, end: string): Promise<MoneyBlock> {
  const monthStart = end.slice(0, 7) + '-01'
  const pays = async (from: string, to: string) => safe<{ amount_vnd: number; member_name_snap: string; tier_snap: string; payment_method: string }[]>(
    sb.from('membership_payments').select('amount_vnd, member_name_snap, tier_snap, payment_method')
      .eq('status', 'active').gt('amount_vnd', 0).gte('payment_date', from).lte('payment_date', to), [])
  const cards = async (from: string, to: string) => safe<{ amount_vnd: number; kind: string }[]>(
    sb.from('card_transactions').select('amount_vnd, kind').gte('created_at', from).lte('created_at', to + 'T23:59:59'), [])

  const [wkPays, wkCards, mPays, mCards, settings] = await Promise.all([
    pays(start, end), cards(start, end), pays(monthStart, end), cards(monthStart, end),
    safe<{ monthly_target_usd: number | null; monthly_cost_base_usd: number | null; usd_vnd_rate: number | null } | null>(
      sb.from('finance_settings').select('monthly_target_usd, monthly_cost_base_usd, usd_vnd_rate').maybeSingle(), null),
  ])

  const split = (rows: { amount_vnd: number; kind: string }[]) => {
    let topups = 0, charges = 0
    for (const t of rows) {
      const a = Number(t.amount_vnd) || 0
      if (t.kind === 'topup' || a > 0) topups += Math.abs(a); else charges += Math.abs(a)
    }
    return { topups, charges }
  }
  const wkCard = split(wkCards), mCard = split(mCards)
  const sum = (rows: { amount_vnd: number }[]) => rows.reduce((s, p) => s + (Number(p.amount_vnd) || 0), 0)
  const rate = Number(settings?.usd_vnd_rate) || 0
  const target = settings?.monthly_target_usd && rate ? Number(settings.monthly_target_usd) * rate : null
  const mtdTotal = sum(mPays) + mCard.topups

  return {
    week: {
      membership_total: sum(wkPays),
      membership_count: wkPays.length,
      payments: wkPays.map(p => ({ name: p.member_name_snap, tier: p.tier_snap, amount: Number(p.amount_vnd) || 0, method: p.payment_method })),
      card_topups: wkCard.topups,
      card_charges: wkCard.charges,
    },
    mtd: {
      month_label: new Date(end + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      membership: sum(mPays),
      card_topups: mCard.topups,
      total: mtdTotal,
      target_vnd: target,
      cost_base_vnd: settings?.monthly_cost_base_usd && rate ? Number(settings.monthly_cost_base_usd) * rate : null,
      pct_of_target: target ? Math.round((mtdTotal / target) * 100) : null,
    },
  }
}

// ── THE TEAM'S WEEK ─────────────────────────────────────────────────────────
// The shift board is reported as it stands, including when nothing was ticked:
// at the time of writing every task instance in the system is 'not_started', and
// a report that quietly omitted that would be hiding the most useful thing on it.
async function opsBlock(sb: SupabaseClient, start: string, end: string): Promise<OpsBlock> {
  const [tasks, acts, opened, resolved, openNow, away] = await Promise.all([
    safe<{ status: string }[]>(sb.from('shift_task_instances').select('status').gte('shift_date', start).lte('shift_date', end), []),
    safe<{ verb: string; object_type: string }[]>(sb.from('activity_events').select('verb, object_type').gte('created_at', start).lte('created_at', end + 'T23:59:59'), []),
    safe<{ id: string }[]>(sb.from('complaints').select('id').gte('reported_at', start).lte('reported_at', end + 'T23:59:59'), []),
    safe<{ id: string }[]>(sb.from('complaints').select('id').gte('resolved_at', start).lte('resolved_at', end + 'T23:59:59'), []),
    safe<{ id: string }[]>(sb.from('complaints').select('id').neq('status', 'resolved'), []),
    // Anyone whose leave OVERLAPS the week, not only leave that starts in it.
    safe<{ member_name: string; kind: string; start_date: string; end_date: string }[]>(
      sb.from('staff_time_off').select('member_name, kind, start_date, end_date').lte('start_date', end).gte('end_date', start), []),
  ])

  const by = (s: string) => tasks.filter(t => t.status === s).length
  const done = by('done')
  const verbs: Record<string, number> = {}
  for (const a of acts) { const k = `${a.verb} ${a.object_type}`; verbs[k] = (verbs[k] || 0) + 1 }

  return {
    tasks: {
      total: tasks.length, done, in_progress: by('in_progress'), blocked: by('blocked'), not_started: by('not_started'),
      pct_done: tasks.length ? Math.round((done / tasks.length) * 100) : null,
    },
    staff_actions: acts.length,
    top_actions: Object.entries(verbs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([what, count]) => ({ what, count })),
    complaints: { opened: opened.length, resolved: resolved.length, open_now: openNow.length },
    away: away.map(a => ({ name: a.member_name, kind: a.kind, start: a.start_date, end: a.end_date })),
  }
}

export async function gatherWeek(sb: SupabaseClient, start: string, end: string, opts: { includeFinancials: boolean }): Promise<{ auto: AutoData; financials: Financials | null }> {
  const priorEnd = addDays(start, -1)
  const priorStart = addDays(priorEnd, -(eachDay(start, end).length - 1))

  const [thisW, priorW] = await Promise.all([windowMetrics(sb, start, end), windowMetrics(sb, priorStart, priorEnd)])

  // Events
  const fixtures = await safe<{ id: string; sport: string; title: string; date: string; max_signups: number | null }[]>(
    sb.from('fixtures').select('id, sport, title, date, max_signups').gte('date', start).lte('date', end + 'T23:59:59'), [])
  // fixture_signup_counts() returns (fixture_id, signups). This read `count`, which
  // is never there, so every event reported 0 sign-ups (found 2026-09-15). It now
  // counts staff-added places too, because the function counts every row.
  const counts = await safe<{ fixture_id: string; signups?: number; count?: number }[]>(sb.rpc('fixture_signup_counts'), [])
  const countMap = new Map((counts || []).map(c => [c.fixture_id, Number(c.signups ?? c.count ?? 0)]))
  const cal = await safe<{ kind: string }[]>(
    sb.from('calendar_entries').select('kind').gte('entry_date', start).lte('entry_date', end), [])
  const calByKind: Record<string, number> = {}
  for (const c of cal) calByKind[c.kind] = (calByKind[c.kind] || 0) + 1

  // Pipeline
  const allProspects = await safe<{ stage: string }[]>(sb.from('prospects').select('stage'), [])
  const funnel = STAGES.map(s => ({ stage: s, count: allProspects.filter(p => p.stage === s).length }))
  const onboarded = funnel.find(f => f.stage === 'Onboarded')?.count || 0
  const totalProspects = allProspects.length || 1
  const movesRows = await safe<{ event_type: string }[]>(
    sb.from('prospect_activity').select('event_type').gte('created_at', start).lte('created_at', end + 'T23:59:59'), [])
  const movements: Record<string, number> = {}
  for (const m of movesRows) movements[m.event_type] = (movements[m.event_type] || 0) + 1
  const interviews = await safe<{ full_name: string; interview_date: string; interviewer: string | null }[]>(
    sb.from('prospects').select('full_name, interview_date, interviewer').gte('interview_date', start).lte('interview_date', end), [])

  // New members detail — with names, so the report can say who joined rather
  // than only how many.
  const newMemRows = await safe<{ tier: string; full_name: string }[]>(
    sb.from('members').select('tier, full_name').gte('join_date', start).lte('join_date', end), [])
  const byTier: Record<string, number> = {}
  for (const m of newMemRows) byTier[m.tier] = (byTier[m.tier] || 0) + 1
  const periods = await safe<{ complimentary: boolean }[]>(
    sb.from('membership_periods').select('complimentary').gte('start_date', start).lte('start_date', end), [])

  // Money, the team's week, and the press — the three the report never carried.
  // Each is independently guarded, so an empty table costs that block and
  // nothing else.
  const [money, ops, press] = await Promise.all([
    moneyBlock(sb, start, end).catch(() => undefined),
    opsBlock(sb, start, end).catch(() => undefined),
    safe<{ title: string; outlet: string | null; link: string | null; published_at: string }[]>(
      sb.from('press_items').select('title, outlet, link, published_at')
        .eq('is_published', true).gte('published_at', start).lte('published_at', end), []),
  ])

  // A lead created this week, counted from the pipeline's own audit trail.
  const newLeads = movesRows.filter(m => m.event_type === 'created').length

  // Member of the week (top visits)
  const wkVisits = await safe<{ member_no: string }[]>(
    sb.from('visits').select('member_no').is('archived_at', null).gte('visit_date', start).lte('visit_date', end), [])
  const tally = new Map<string, number>()
  for (const v of wkVisits) tally.set(v.member_no, (tally.get(v.member_no) || 0) + 1)
  let motw: AutoData['member_of_week'] = null
  if (tally.size) {
    const [topNo, topN] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
    const { data: mem } = await sb.from('members').select('full_name').eq('member_no', topNo).maybeSingle()
    motw = { member_no: topNo, name: mem?.full_name || topNo, visits: topN }
  }

  const auto: AutoData = {
    period: { start, end, label: `${new Date(start + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${new Date(end + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` },
    usage: thisW,
    money,
    ops,
    press: press.map(p => ({ title: p.title, outlet: p.outlet, link: p.link, date: p.published_at })),
    events: {
      fixtures: fixtures.map(f => ({ title: f.title, sport: f.sport, date: f.date, signups: countMap.get(f.id) || 0, max: f.max_signups })),
      calendar_by_kind: calByKind,
    },
    pipeline: {
      funnel,
      conversion_pct: Math.round((onboarded / totalProspects) * 100),
      movements,
      interviews: interviews.map(i => ({ name: i.full_name, date: i.interview_date, interviewer: i.interviewer })),
      signed: thisW.signed,
      new_leads: newLeads,
      onboarded: newMemRows.map(m => ({ name: m.full_name, tier: m.tier })),
    },
    members: { new_total: newMemRows.length, by_tier: byTier, complimentary: periods.filter(p => p.complimentary).length, paid: periods.filter(p => !p.complimentary).length },
    member_of_week: motw,
    deltas: {
      visits: delta(thisW.visits, priorW.visits),
      attendance: delta(thisW.attendance ?? thisW.visits, priorW.attendance ?? priorW.visits),
      footfall_unique: delta(thisW.footfall_unique, priorW.footfall_unique),
      unique_members: delta(thisW.unique_members, priorW.unique_members),
      new_members: delta(thisW.new_members, priorW.new_members),
      signed: delta(thisW.signed, priorW.signed),
      pipeline_movements: delta(thisW.pipeline_movements, priorW.pipeline_movements),
    },
    generated_at: new Date().toISOString(),
  }

  const financials = opts.includeFinancials ? await summariseFinancials(sb, end) : null
  return { auto, financials }
}
