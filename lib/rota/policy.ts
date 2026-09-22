// ═══════════════════════════════════════════════════════════════════════════
// THE ROTA RULES — checking a week against them.
// ───────────────────────────────────────────────────────────────────────────
// Rebuilt 2026-09-22, after the staff's collective letter about working days
// and rest days. The rota these replaced ran one long night shift counted
// across the whole night: it put five people on six 8.5–9 hour shifts a week
// (47.5–59 hours), gave one rest day, and ended the closing shift at 00:00 —
// the minute the club shut — so close-down happened in unrecorded time.
//
// THE RULES, as the Company decided them. Not proposals; do not soften them:
//   · Five 8-hour shifts, 40 hours, two rest days — every person, every week.
//   · No shift over 8 paid hours. The 30-minute break (Art 109) falls INSIDE
//     the eight and is paid, which is why S1–S4 carry no break_minutes.
//   · The week runs SUNDAY to SATURDAY. The three-week cycle is built on that
//     week; measured Monday to Sunday it drops people to one rest day at every
//     rotation boundary. The rota page shows Sunday-first weeks to match.
//   · Exactly one supervisor closes, every night, and the close runs to 00:30.
//   · The floor meets the planned coverage: four at peak Tuesday to Friday
//     (S4 exists for that), three the other nights. See PLAN_COVER.
//   · Twelve hours between one shift and the next.
//   · Cover for an absence is a SWAP, not an extra shift. Anything over 40
//     hours is overtime at 150% and is flagged as a block, not a note.
//
// One word is not used anywhere in this file, or anywhere these rules are
// shown: the working-hours clause of the employment agreements reads only
// "Thời giờ làm việc: Theo yêu cầu của công việc". Forty hours is the
// Company's rota rule, and is only ever described as that.
//
// WHAT WAS REMOVED, and why each one would now be wrong:
//   · the fixed weekly "Office"/"Open" day per person — the Office is for
//     office staff; floor staff work S-shifts on a rotating pattern
//   · "always works Close" — supervisors rotate the close among themselves
//   · "never both weekend days off" — the cycle gives three of its six lines
//     the whole weekend off by design
//   · "days off must move week to week" — the cycle moves them itself
//   · the fortnightly shared day off for a couple — not part of the new rules
//   · planWeek(), the old generator. It solved the one-long-night model and
//     nothing on the site called it. The replacement is the three-week cycle
//     in lib/rota/cycle.ts, which is a lookup rather than a search.
// The Open and Close shift types, their coverage targets, the switched-off
// demand rules and the columns those rules read were removed the same day
// (supabase/migrations/20260922100000_rota_retire_old_rules.sql, which also
// holds the way back). Past Open and Close rota rows are kept: shift_name is a
// snapshot, and those rows are the record of what was rostered.
//
// Monthly rules — at least four rest days a month, at most 40 overtime hours
// a month — need a month of rota, not a week, and are not checked here.
// ═══════════════════════════════════════════════════════════════════════════

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export const WEEKLY_HOURS = 40
export const REST_DAYS = 2
export const MAX_SHIFT_HOURS = 8
/** The close runs to 00:30 — 24.5 on a clock that runs past midnight. */
export const CLOSE_BY = 24.5
export const MIN_HOURS_BETWEEN_SHIFTS = 12
/** Tuesday to Friday: the nights S4 runs and the floor plan wants four. */
export const PEAK_NIGHTS = [2, 3, 4, 5]

/** The planned floor, band by band. `peak` is Tuesday–Friday. */
export const PLAN_COVER: { from: number; to: number; peak: number; other: number }[] = [
  { from: 14,   to: 15.5, peak: 1, other: 1 },
  { from: 15.5, to: 16,   peak: 2, other: 2 },
  { from: 16,   to: 16.5, peak: 3, other: 2 },
  { from: 16.5, to: 22,   peak: 4, other: 3 },
  { from: 22,   to: 23.5, peak: 3, other: 2 },
  { from: 23.5, to: 24,   peak: 2, other: 1 },
  { from: 24,   to: 24.5, peak: 1, other: 1 },
]

/** Cleaning is rostered separately and is never floor cover. Held as a set
 *  rather than a name prefix, because "Clean" is a word somebody will one day
 *  put at the front of a floor shift. */
export const CLEANING_SHIFTS = new Set(['Clean Early', 'Clean Late'])
/** Rostered and paid, but not on the floor: the office, cleaning, and the
 *  cycle's DUTY shift (see lib/rota/cycle.ts — its hours are not yet set). */
export const OFF_FLOOR = new Set(['Office', 'Duty', ...CLEANING_SHIFTS])

export interface RotaStaff {
  id: string
  name: string
  isSupervisor: boolean
  /** The rota's weekly hours for this person — 40 under the new rules. */
  weeklyHours: number | null
  /** Days this person is never rostered, by arrangement. 0 = Sunday. */
  fixedDaysOff: number[]
}

export interface ShiftType {
  name: string
  /** Paid hours when a shift carries no times of its own. */
  hours: number
  sortOrder: number
  /** Weekdays the shift runs (0 = Sun … 6 = Sat); null/absent = every day. */
  weekdays?: number[] | null
  startTime?: string | null
  endTime?: string | null
  /** UNPAID break inside the span. S1–S4 have none: their break is paid. */
  breakMinutes?: number | null
}

export interface PlannedShift {
  member: string
  shiftDate: string      // yyyy-mm-dd
  shiftName: string
  /** A row's own times win over its type's — the rota lets a manager move one. */
  startTime?: string | null
  endTime?: string | null
}

export interface Violation {
  severity: 'blocking' | 'warning'
  rule: string
  who?: string
  when?: string
  detail: string
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (start: string, n: number) => {
  const d = new Date(start + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
export const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()
/** The Sunday a date's rota week starts on. */
export const sundayOf = (date: string) => addDays(date, -weekdayOf(date))

const clock = (t: string) => { const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60 }
const fmt = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

/** Start and end on a clock that runs past midnight (00:30 → 24.5), or null
 *  when neither the row nor its type says when the shift is. */
export function shiftSpan(s: PlannedShift, types: ShiftType[]): { start: number; end: number } | null {
  const type = types.find(t => t.name === s.shiftName)
  const a = s.startTime || type?.startTime, b = s.endTime || type?.endTime
  if (!a || !b) return null
  const start = clock(a)
  let end = clock(b)
  if (end <= start) end += 24
  return { start, end }
}

/** Paid hours: the span less any UNPAID break, else the type's stated hours. */
export function paidHours(s: PlannedShift, types: ShiftType[]): number {
  const span = shiftSpan(s, types)
  const type = types.find(t => t.name === s.shiftName)
  if (!span) return type?.hours ?? 0
  return span.end - span.start - (type?.breakMinutes ?? 0) / 60
}

// ── CHECK ──────────────────────────────────────────────────────────────────

export function checkWeek(opts: {
  /** The Sunday the week starts on. */
  weekStart: string
  staff: RotaStaff[]
  shiftTypes: ShiftType[]
  shifts: PlannedShift[]
}): Violation[] {
  const { weekStart, staff, shiftTypes: types, shifts } = opts
  const out: Violation[] = []
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const inWeek = shifts.filter(s => dates.includes(s.shiftDate))
  const isFloor = (s: PlannedShift) => !OFF_FLOOR.has(s.shiftName)
  const supervisor = (id: string) => !!staff.find(p => p.id === id)?.isSupervisor
  const dayName = (date: string) => `${WEEKDAYS[weekdayOf(date)]} ${date.slice(8)}/${date.slice(5, 7)}`

  if (weekdayOf(weekStart) !== 0) {
    out.push({ severity: 'warning', rule: 'week does not start on Sunday',
      detail: `The rota week runs Sunday to Saturday; this one starts on a ${WEEKDAYS[weekdayOf(weekStart)]}, so the rest-day count is measured over the wrong seven days.` })
  }

  for (const p of staff) {
    const mine = inWeek.filter(s => s.member === p.id)
      .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || (shiftSpan(a, types)?.start ?? 0) - (shiftSpan(b, types)?.start ?? 0))
    const worked = new Set(mine.map(s => weekdayOf(s.shiftDate)))

    for (const d of p.fixedDaysOff) {
      if (worked.has(d)) out.push({ severity: 'blocking', rule: 'fixed day off', who: p.name, when: WEEKDAYS[d],
        detail: `${p.name} is off ${WEEKDAYS[d]} every week by arrangement, and is rostered.` })
    }

    for (const s of mine) {
      const h = paidHours(s, types)
      if (h > MAX_SHIFT_HOURS + 1e-9) out.push({ severity: 'blocking', rule: 'shift over 8 hours', who: p.name, when: s.shiftDate,
        detail: `${p.name}'s ${s.shiftName} on ${dayName(s.shiftDate)} is ${h.toFixed(2)} paid hours — ${(h - MAX_SHIFT_HOURS).toFixed(2)}h over the limit.` })
      const runs = types.find(t => t.name === s.shiftName)?.weekdays
      if (!CLEANING_SHIFTS.has(s.shiftName) && runs?.length && !runs.includes(weekdayOf(s.shiftDate)))
        out.push({ severity: 'blocking', rule: 'shift on a day it does not run', who: p.name, when: s.shiftDate,
          detail: `${s.shiftName} only runs ${runs.map(d => WEEKDAYS[d].slice(0, 3)).join(', ')} — ${p.name} is on it ${dayName(s.shiftDate)}.` })
    }

    const hours = mine.reduce((t, s) => t + paidHours(s, types), 0)
    const target = p.weeklyHours ?? WEEKLY_HOURS
    if (hours > target + 1e-9) {
      out.push({ severity: 'blocking', rule: 'over the weekly hours', who: p.name,
        detail: `${p.name} is rostered ${hours.toFixed(2)}h against ${target}h — the ${(hours - target).toFixed(2)}h over is overtime at 150%. Cover should be a swap, not an extra shift.` })
    } else if (hours + 1 < target) {
      out.push({ severity: 'warning', rule: 'under the weekly hours', who: p.name,
        detail: `${p.name} is rostered ${hours.toFixed(2)}h against ${target}h — ${(target - hours).toFixed(2)}h unscheduled. Leave, a closure day, or a shift missing?` })
    }

    const rest = 7 - worked.size
    if (rest < REST_DAYS) out.push({ severity: 'blocking', rule: 'fewer than two rest days', who: p.name,
      detail: `${p.name} has ${rest} rest day${rest === 1 ? '' : 's'} this week — every person gets ${REST_DAYS}.` })

    for (let i = 1; i < mine.length; i++) {
      const a = shiftSpan(mine[i - 1], types), b = shiftSpan(mine[i], types)
      if (!a || !b) continue
      const days = (Date.parse(mine[i].shiftDate) - Date.parse(mine[i - 1].shiftDate)) / 864e5
      const gap = days * 24 + b.start - a.end
      if (gap < MIN_HOURS_BETWEEN_SHIFTS) out.push({ severity: 'blocking', rule: 'under 12 hours between shifts', who: p.name, when: mine[i].shiftDate,
        detail: `${p.name} finishes at ${fmt(a.end)} and starts again ${gap.toFixed(1)} hours later — the minimum is ${MIN_HOURS_BETWEEN_SHIFTS}.` })
    }
  }

  for (const date of dates) {
    const floor = inWeek.filter(s => s.shiftDate === date && isFloor(s))
    if (!floor.length) {
      out.push({ severity: 'blocking', rule: 'night with nobody on', when: date, detail: `Nobody is on the floor ${dayName(date)}.` })
      continue
    }
    if (!floor.some(s => supervisor(s.member))) out.push({ severity: 'blocking', rule: 'night without a supervisor', when: date,
      detail: `${dayName(date)} has no supervisor on the floor.` })

    const timed = floor.map(s => ({ s, span: shiftSpan(s, types) })).filter(x => x.span) as { s: PlannedShift; span: { start: number; end: number } }[]
    if (timed.length < floor.length) out.push({ severity: 'warning', rule: 'shift with no times', when: date,
      detail: `${floor.length - timed.length} shift(s) on ${dayName(date)} have no times, so the close and the floor plan cannot be checked.` })
    if (!timed.length) continue

    const last = Math.max(...timed.map(x => x.span.end))
    if (last < CLOSE_BY - 1e-9) out.push({ severity: 'blocking', rule: 'close-down not rostered', when: date,
      detail: `The last person leaves at ${fmt(last)} on ${dayName(date)} — the close runs to 00:30.` })
    const closers = timed.filter(x => x.span.end >= Math.min(last, CLOSE_BY) - 1e-9)
    const supClosers = closers.filter(x => supervisor(x.s.member))
    if (!supClosers.length) out.push({ severity: 'blocking', rule: 'no supervisor closing', when: date,
      detail: `Nobody closing on ${dayName(date)} is a supervisor.` })
    else if (supClosers.length > 1) out.push({ severity: 'warning', rule: 'two supervisors closing', when: date,
      detail: `${supClosers.length} supervisors close on ${dayName(date)} — the rule is exactly one.` })

    const peak = PEAK_NIGHTS.includes(weekdayOf(date))
    const short = PLAN_COVER.map(b => ({ b, want: peak ? b.peak : b.other,
      got: timed.filter(x => x.span.start <= b.from + 1e-9 && x.span.end >= b.to - 1e-9).length })).filter(x => x.got < x.want)
    if (short.length) out.push({ severity: 'blocking', rule: 'floor below plan', when: date,
      detail: `${dayName(date)}: ` + short.map(x => `${fmt(x.b.from)}–${fmt(x.b.to)} has ${x.got} of ${x.want}`).join('; ') + '.' })
  }

  // Cleaning, from nine in the morning to eleven at night. Asked only once the
  // week has any cleaning on it — before that, every week would come back with
  // fourteen complaints about a shift nobody had been put on yet.
  if (inWeek.some(s => CLEANING_SHIFTS.has(s.shiftName))) {
    for (const date of dates) for (const name of CLEANING_SHIFTS) {
      const runsOn = types.find(t => t.name === name)?.weekdays
      if (runsOn?.length && !runsOn.includes(weekdayOf(date))) continue
      if (inWeek.some(s => s.shiftDate === date && s.shiftName === name)) continue
      out.push({ severity: 'warning', rule: 'cleaning not covered', when: date,
        detail: `Nobody is on ${name} on ${dayName(date)}.` })
    }
  }

  return out
}
