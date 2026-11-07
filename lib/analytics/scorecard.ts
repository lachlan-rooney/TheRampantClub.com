import type { SupabaseClient } from '@supabase/supabase-js'

// THE WEEKLY OPS SCORECARD — only the metrics nothing else already computes.
//
// ── WHY THIS FILE IS SMALL ────────────────────────────────────────────────
// lib/reports/gather.ts already computes most of a weekly ops read: task
// completion, complaints opened/resolved/open, staff actions, the pipeline
// funnel and its conversion, time off. It has been doing it every Monday for
// the executive report since September.
//
// Writing a second gatherer would have duplicated all of that, and two
// implementations of "complaints opened this week" WILL disagree eventually —
// which is the whole lesson of the PS(t) work. So the scorecard COMPOSES with
// gatherWeek and this file adds only what is genuinely missing:
//
//   · pipeline time-in-stage and who is stalled   (prospect_activity)
//   · rota coverage against target                (rota_shifts + targets)
//   · grievance resolution TIME                   (gather has counts only)
//   · ops BOARD overdue                           (tasks — gather's "tasks"
//     is shift_task_instances, the shift checklists, a different thing)
//   · member reach                                (visits ∪ card charges)
//
// Everything here READS. Nothing in the analytics layer writes.

export interface StalledCandidate {
  prospect_id: string
  name: string
  stage: string
  days_in_stage: number
}

export interface ScorecardGap {
  pipeline: {
    stalled: StalledCandidate[]
    median_days_in_stage: number | null
    moved_this_week: number
  }
  rota: { scheduled: number; target: number; coverage_pct: number | null }
  grievances: { open_now: number; median_days_to_resolve: number | null; oldest_open_days: number | null }
  board: { open: number; overdue: number; due_next_7: number; blocked: number }
  reach: { seen_30d: number; members: number; pct: number | null }
}

const safe = async <T,>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> => {
  try { const { data } = await p; return (data ?? fallback) as T } catch { return fallback }
}
const vnDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${a}T12:00:00+07:00`).getTime() - new Date(`${b}T12:00:00+07:00`).getTime()) / 86_400_000)
const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** How long a candidate has sat where they are. 30 days is the stall line. */
const STALL_DAYS = 30

export async function gatherScorecardGap(
  sb: SupabaseClient, start: string, end: string,
): Promise<ScorecardGap> {
  const today = vnDate()

  const [acts, prospects, shifts, targets, comps, tasks, cols, projects, visits, charges, members] =
    await Promise.all([
      safe<{ prospect_id: string; event_type: string; to_value: string | null; created_at: string }[]>(
        sb.from('prospect_activity').select('prospect_id, event_type, to_value, created_at').order('created_at'), []),
      safe<{ prospect_id: string; full_name: string; stage: string; created_at: string; archived_at: string | null }[]>(
        sb.from('prospects').select('prospect_id, full_name, stage, created_at, archived_at'), []),
      safe<{ shift_name: string; role: string | null; shift_date: string }[]>(
        sb.from('rota_shifts').select('shift_name, role, shift_date').gte('shift_date', start).lte('shift_date', end), []),
      safe<{ shift_name: string; function: string; count: number }[]>(
        sb.from('rota_coverage_targets').select('shift_name, function, count'), []),
      safe<{ status: string; reported_at: string; resolved_at: string | null }[]>(
        sb.from('complaints').select('status, reported_at, resolved_at'), []),
      safe<{ column_id: string; project_id: string; status: string; due_date: string | null }[]>(
        sb.from('tasks').select('column_id, project_id, status, due_date'), []),
      safe<{ id: string; is_done_column: boolean; is_blocked_column: boolean | null }[]>(
        sb.from('board_columns').select('*'), []),
      safe<{ id: string }[]>(
        sb.from('projects').select('id').eq('status', 'active').is('deleted_at', null), []),
      safe<{ member_no: string; visit_date: string }[]>(
        sb.from('visits').select('member_no, visit_date'), []),
      safe<{ member_number: string; kind: string; created_at: string }[]>(
        sb.from('card_transactions').select('member_number, kind, created_at'), []),
      safe<{ member_no: string }[]>(sb.from('members').select('member_no'), []),
    ])

  // ── PIPELINE: time in stage, from the stage-change trail ────────────────
  // The strongest-instrumented thing in the estate: 44 recorded transitions
  // with from/to and a timestamp. A candidate's clock starts at their last
  // stage change, or at creation if they have never moved.
  const lastMove = new Map<string, string>()
  let movedThisWeek = 0
  for (const a of acts) {
    if (a.event_type !== 'stage_changed') continue
    lastMove.set(a.prospect_id, a.created_at)
    const d = String(a.created_at).slice(0, 10)
    if (d >= start && d <= end) movedThisWeek++
  }
  // Closed outcomes are not stalled — they are finished.
  const OPEN_STAGES = new Set(['Lead', 'Initial Contact', 'Interview Scheduled', 'Interview Complete', 'Application Received'])
  const live = prospects.filter(p => !p.archived_at && OPEN_STAGES.has(p.stage))
  const ages = live.map(p => ({
    p, days: daysBetween(today, String(lastMove.get(p.prospect_id) ?? p.created_at).slice(0, 10)),
  }))
  const stalled = ages.filter(x => x.days >= STALL_DAYS)
    .sort((a, b) => b.days - a.days)
    .map(x => ({ prospect_id: x.p.prospect_id, name: x.p.full_name, stage: x.p.stage, days_in_stage: x.days }))

  // ── ROTA: scheduled against the published target ────────────────────────
  // The target is per shift_name per function, so the week's requirement is
  // that multiplied by the days in the window.
  const days = Math.max(1, daysBetween(end, start) + 1)
  const targetPerDay = targets.reduce((s, t) => s + Number(t.count || 0), 0)
  const target = targetPerDay * days
  const coverage_pct = target > 0 ? Math.round((shifts.length / target) * 100) : null

  // ── GRIEVANCES: how long they take, not just how many ───────────────────
  const resolvedDurations = comps
    .filter(c => c.resolved_at && c.reported_at)
    .map(c => daysBetween(String(c.resolved_at).slice(0, 10), String(c.reported_at).slice(0, 10)))
    .filter(d => d >= 0)
  const openComps = comps.filter(c => c.status !== 'resolved')
  const oldestOpen = openComps.length
    ? Math.max(...openComps.map(c => daysBetween(today, String(c.reported_at).slice(0, 10))))
    : null

  // ── THE OPS BOARDS. Blocked and done excluded BY FLAG, never by name. ───
  const liveProjects = new Set(projects.map(p => p.id))
  const col = new Map(cols.map(c => [c.id, c]))
  const parked = (id: string) => {
    const c = col.get(id)
    return !!(c && (c.is_done_column || c.is_blocked_column))
  }
  const openTasks = tasks.filter(x => liveProjects.has(x.project_id) && x.status === 'open')
  const counted = openTasks.filter(x => !parked(x.column_id))
  const in7 = (() => { const d = new Date(`${today}T12:00:00+07:00`); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) })()

  // ── MEMBER REACH. The bluntest number, and the one that matters most
  //    while engagement scoring is thin: how many did we see AT ALL.
  //    A card charge counts — they spent money, so they were here.
  const from30 = (() => { const d = new Date(`${today}T12:00:00+07:00`); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })()
  const seen = new Set<string>()
  visits.filter(v => v.visit_date >= from30).forEach(v => seen.add(v.member_no))
  charges.filter(c => c.kind === 'charge' && String(c.created_at).slice(0, 10) >= from30)
    .forEach(c => seen.add(c.member_number))

  return {
    pipeline: {
      stalled: stalled.slice(0, 12),
      median_days_in_stage: median(ages.map(a => a.days)),
      moved_this_week: movedThisWeek,
    },
    rota: { scheduled: shifts.length, target, coverage_pct },
    grievances: {
      open_now: openComps.length,
      median_days_to_resolve: median(resolvedDurations),
      oldest_open_days: oldestOpen,
    },
    board: {
      open: openTasks.length,
      overdue: counted.filter(x => x.due_date && x.due_date < today).length,
      due_next_7: counted.filter(x => x.due_date && x.due_date >= today && x.due_date <= in7).length,
      blocked: openTasks.filter(x => col.get(x.column_id)?.is_blocked_column).length,
    },
    reach: {
      seen_30d: seen.size,
      members: members.length,
      pct: members.length ? Math.round((seen.size / members.length) * 100) : null,
    },
  }
}
