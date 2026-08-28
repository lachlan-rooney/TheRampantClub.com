import type { SupabaseClient } from '@supabase/supabase-js'
import { summariseFinancials, type Financials } from './financials'

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
}

export interface AutoData {
  period: { start: string; end: string; label: string }
  usage: WeekMetrics
  events: { fixtures: { title: string; sport: string; date: string; signups: number; max: number | null }[]; calendar_by_kind: Record<string, number> }
  pipeline: { funnel: { stage: string; count: number }[]; conversion_pct: number; movements: Record<string, number>; interviews: { name: string; date: string; interviewer: string | null }[]; signed: number }
  members: { new_total: number; by_tier: Record<string, number>; complimentary: number; paid: number }
  member_of_week: { member_no: string; name: string; visits: number } | null
  deltas: Record<string, number | null>
  generated_at: string
}

const STAGES = ['Lead', 'Initial Contact', 'Interview Scheduled', 'Interview Complete', 'Application Received', 'Onboarded']

// The headline metrics for a [start,end] window (used for both this + prior week).
async function windowMetrics(sb: SupabaseClient, start: string, end: string): Promise<WeekMetrics> {
  const visits = await safe<{ member_no: string; visit_date: string; duration_min: number | null }[]>(
    sb.from('visits').select('member_no, visit_date, duration_min').is('archived_at', null).gte('visit_date', start).lte('visit_date', end), [])
  const presence = await safe<{ member_number: string; seen_at: string }[]>(
    sb.from('card_presence').select('member_number, seen_at').gte('seen_at', start).lte('seen_at', end + 'T23:59:59'), [])
  const bookings = await safe<{ party_size: number; status: string; arrived_at: string | null }[]>(
    sb.from('bookings').select('party_size, status, arrived_at').gte('booking_date', start).lte('booking_date', end), [])
  const guests = await safe<{ duration_min: number | null; party_size: number | null }[]>(
    sb.from('guest_visits').select('duration_min, party_size').gte('visit_date', start).lte('visit_date', end), [])
  const newMembers = await safe<{ member_no: string }[]>(
    sb.from('members').select('member_no').gte('join_date', start).lte('join_date', end), [])
  const signed = await safe<{ id: string }[]>(
    sb.from('signing_invitations').select('id').eq('status', 'signed').gte('created_at', start).lte('created_at', end + 'T23:59:59'), [])
  const moves = await safe<{ id: string }[]>(
    sb.from('prospect_activity').select('id').gte('created_at', start).lte('created_at', end + 'T23:59:59'), [])

  const days = eachDay(start, end)
  const visitsByDay = days.map(d => ({ day: d, label: dayLabel(d), count: visits.filter(v => v.visit_date === d).length }))
  const closed = visits.filter(v => typeof v.duration_min === 'number')
  const footfallSet = new Set(presence.map(p => `${p.member_number}|${p.seen_at.slice(0, 10)}`))
  const footfallByDay = days.map(d => ({ day: d, count: new Set(presence.filter(p => p.seen_at.slice(0, 10) === d).map(p => p.member_number)).size }))

  const memberMinutes = closed.reduce((s, v) => s + (v.duration_min || 0), 0)
  return {
    visits: visits.length,
    unique_members: new Set(visits.map(v => v.member_no)).size,
    avg_minutes: closed.length ? Math.round(memberMinutes / closed.length) : 0,
    total_member_minutes: memberMinutes,
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
  }
}

const delta = (a: number, b: number) => a - b

export async function gatherWeek(sb: SupabaseClient, start: string, end: string, opts: { includeFinancials: boolean }): Promise<{ auto: AutoData; financials: Financials | null }> {
  const priorEnd = addDays(start, -1)
  const priorStart = addDays(priorEnd, -(eachDay(start, end).length - 1))

  const [thisW, priorW] = await Promise.all([windowMetrics(sb, start, end), windowMetrics(sb, priorStart, priorEnd)])

  // Events
  const fixtures = await safe<{ id: string; sport: string; title: string; date: string; max_signups: number | null }[]>(
    sb.from('fixtures').select('id, sport, title, date, max_signups').gte('date', start).lte('date', end + 'T23:59:59'), [])
  const counts = await safe<{ fixture_id: string; count: number }[]>(sb.rpc('fixture_signup_counts'), [])
  const countMap = new Map((counts || []).map(c => [c.fixture_id, Number(c.count)]))
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

  // New members detail
  const newMemRows = await safe<{ tier: string }[]>(
    sb.from('members').select('tier').gte('join_date', start).lte('join_date', end), [])
  const byTier: Record<string, number> = {}
  for (const m of newMemRows) byTier[m.tier] = (byTier[m.tier] || 0) + 1
  const periods = await safe<{ complimentary: boolean }[]>(
    sb.from('membership_periods').select('complimentary').gte('start_date', start).lte('start_date', end), [])

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
    },
    members: { new_total: newMemRows.length, by_tier: byTier, complimentary: periods.filter(p => p.complimentary).length, paid: periods.filter(p => !p.complimentary).length },
    member_of_week: motw,
    deltas: {
      visits: delta(thisW.visits, priorW.visits),
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
