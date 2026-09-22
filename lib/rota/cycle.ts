import { addDays, weekdayOf, type PlannedShift } from '@/lib/rota/policy'

// ═══════════════════════════════════════════════════════════════════════════
// THE THREE-WEEK CYCLE — a lookup, not a rebuild.
// ───────────────────────────────────────────────────────────────────────────
// The owner's design, 2026-09-22. Six fixed lines that never change; each
// week every person moves down one line. Supervisors rotate A → B → C,
// servers D → E → F, and the cycle resets on week four. Because a month is
// four-and-a-bit weeks and the cycle is three, each month starts at a
// different point in it — so the published month genuinely varies, and it is
// produced by carrying the cycle position forward, never by restarting.
//
// Checked (scripts/rota-check-new.mts) against lib/rota/policy.ts over nine
// weeks: five shifts and two rest days on every line, S4 only Tuesday to
// Friday, one supervisor closing every night, never more than five days in a
// row, twelve hours between shifts. On a SUNDAY-to-Saturday week. Measured
// Monday to Sunday it gives people one rest day at every rotation boundary.
//
// IN USE from Sunday 27 September 2026 (cycle week 1), with the new server —
// "New" — on line F. It needs all SIX people: with line F empty, Tuesday to
// Friday fall to three on the floor and Thursday has nobody in at 14:00.
//
// Settled by the owner, 22 September: Mr Sĩ is the GM and may run and close
// the floor alone (cycle week 2 has him the only supervisor both weekend
// nights); DUTY is "little side jobs" — and is REMOVED FOR NOW. A DUTY day is
// left unrostered, so a person on a line with one works four shifts that week,
// not five. DUTY_ROSTERED switches it back on; the lines keep it so nothing
// has to be redrawn when it returns.
// ═══════════════════════════════════════════════════════════════════════════

export type Line = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
/** Sunday … Saturday. null = rest. 'Duty' = off-floor, hours not yet set. */
export const ROTA_LINES: Record<Line, (string | null)[]> = {
  A: [null, 'Duty', 'S1', 'S3', 'S3', 'S3', null],
  B: ['S3', 'S2', null, 'Duty', 'S4', null, 'S3'],
  C: [null, 'S3', 'S3', 'S4', 'Duty', 'S1', null],
  D: ['S1', 'S1', null, 'S1', null, 'S4', 'S1'],
  E: ['S2', null, 'S2', 'Duty', 'S2', null, 'S2'],
  F: [null, 'Duty', 'S4', 'S2', 'S1', 'S2', null],
}
/** DUTY is off for now (owner, 2026-09-22): its days are left unrostered. */
export const DUTY_ROSTERED = false
/** Supervisor lines and server lines rotate separately. */
export const SUPERVISOR_LINES: Line[] = ['A', 'B', 'C']
export const SERVER_LINES: Line[] = ['D', 'E', 'F']
const next: Record<Line, Line> = { A: 'B', B: 'C', C: 'A', D: 'E', E: 'F', F: 'D' }

/** Which line someone is on in the week starting `weekStart`, given the line
 *  they were on in the week starting `anchorSunday`. Works backwards too. */
export function lineFor(startLine: Line, anchorSunday: string, weekStart: string): Line {
  const weeks = Math.round((Date.parse(weekStart) - Date.parse(anchorSunday)) / (7 * 864e5))
  let line = startLine
  for (let i = 0; i < ((weeks % 3) + 3) % 3; i++) line = next[line]
  return line
}

/** The whole week as planned shifts, for everyone in `assignment`
 *  (member id → the line they hold in the anchor week). */
export function cycleWeek(assignment: Record<string, Line>, anchorSunday: string, weekStart: string): PlannedShift[] {
  if (weekdayOf(anchorSunday) !== 0 || weekdayOf(weekStart) !== 0) throw new Error('cycle weeks start on a Sunday')
  const out: PlannedShift[] = []
  for (const [member, start] of Object.entries(assignment)) {
    ROTA_LINES[lineFor(start, anchorSunday, weekStart)].forEach((shiftName, d) => {
      if (shiftName && (shiftName !== 'Duty' || DUTY_ROSTERED)) out.push({ member, shiftDate: addDays(weekStart, d), shiftName })
    })
  }
  return out
}
