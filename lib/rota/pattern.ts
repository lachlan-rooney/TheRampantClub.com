import { addDays, weekdayOf, type PlannedShift } from '@/lib/rota/policy'

// ═══════════════════════════════════════════════════════════════════════════
// THE ROTA — six weekly lines, and people moving through them each week.
// ───────────────────────────────────────────────────────────────────────────
// Three owner calls on 22 September shaped it:
//   · ALL SIX on the floor Friday AND Saturday ("we are clearly not
//     prioritising Friday Saturdays").
//   · Weeks run MONDAY TO SUNDAY ("render it Monday to Sunday again").
//   · "It should CHANGE EVERY WEEK" — a fixed week gave Mr Sĩ, Tiên and New
//     every Sunday off and Nhi, Bình and Hiếu none.
//
// THE LINES never change. They are the week: Mon 3 · Tue 4 · Wed 4 · Thu 4 ·
// Fri 6 · Sat 6 · Sun 3 on the floor, five shifts and two rest days a line, all
// rest days Sunday to Thursday, one supervisor closing every night. A–C are
// supervisor lines (each carries its night's close), D–F are server lines.
//
// PEOPLE MOVE ONE LINE EACH WEEK, supervisors among A–C and servers among
// D–F, so a supervisor is on every night whoever is where. The ORDER is
// chosen, not arbitrary: moving between lines joins the end of one week to the
// start of the next, and B ends on four days worked while C starts on two — so
// B → C would be six days in a row. A → C → B → A and D → E → F → D keep every
// run at five days or fewer. Everyone gets a Sunday off one week in three
// (supervisors) or two in three (servers), and the close moves round.
//
// Anchor: the week of Monday 28 September 2026 is week 1, with Mr Sĩ on A,
// Nhi on B, Bình on C, Hiếu on D, Tiên on E and New on F. Carry the position
// forward — never restart it at the top of a month.
// ═══════════════════════════════════════════════════════════════════════════

export type Line = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
/** Monday … Sunday. null = rest day. */
export const LINES: Record<Line, (string | null)[]> = {
  A: [null, 'S2', 'S3', 'S2', 'S3', 'S2', null],   // supervisor · rests Sun + Mon · closes Wed, Fri
  B: ['S3', null, null, 'S3', 'S2', 'S1', 'S2'],   // supervisor · rests Tue + Wed · closes Mon, Thu
  C: ['S2', 'S3', null, null, 'S4', 'S3', 'S3'],   // supervisor · rests Wed + Thu · closes Tue, Sat, Sun
  D: ['S1', null, 'S1', null, 'S1', 'S3', 'S1'],   // server · rests Tue + Thu · second closer Saturday
  E: [null, 'S1', 'S4', 'S1', 'S2', 'S2', null],   // server · rests Sun + Mon
  F: [null, 'S4', 'S2', 'S4', 'S4', 'S2', null],   // server · rests Sun + Mon
}
/** Where each line's holder goes next week. */
export const NEXT: Record<Line, Line> = { A: 'C', C: 'B', B: 'A', D: 'E', E: 'F', F: 'D' }
export const ANCHOR_WEEK = '2026-09-28'
export const ANCHOR_LINES: Record<string, Line> = { 'Mr Sĩ': 'A', 'Nhi': 'B', 'Bình': 'C', 'Hiếu': 'D', 'Tiên': 'E', 'New': 'F' }

/** The line `name` is on in the week starting Monday `weekStart`. */
export function lineFor(name: string, weekStart: string): Line {
  const start = ANCHOR_LINES[name]
  if (!start) throw new Error(`${name} has no line`)
  const weeks = Math.round((Date.parse(weekStart) - Date.parse(ANCHOR_WEEK)) / (7 * 864e5))
  let line = start
  for (let i = 0; i < ((weeks % 3) + 3) % 3; i++) line = NEXT[line]
  return line
}

/** The week starting Monday `weekStart` as planned shifts. */
export function rotaWeek(ids: Record<string, string>, weekStart: string): PlannedShift[] {
  if (weekdayOf(weekStart) !== 1) throw new Error('rota weeks start on a Monday')
  const out: PlannedShift[] = []
  for (const name of Object.keys(ANCHOR_LINES)) {
    const member = ids[name]
    if (!member) throw new Error(`nobody called ${name} on the team`)
    LINES[lineFor(name, weekStart)].forEach((shiftName, d) => { if (shiftName) out.push({ member, shiftDate: addDays(weekStart, d), shiftName }) })
  }
  return out
}
