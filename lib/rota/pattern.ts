import { addDays, weekdayOf, type PlannedShift } from '@/lib/rota/policy'

// ═══════════════════════════════════════════════════════════════════════════
// THE WEEKLY PATTERN — from Monday 28 September 2026.
// ───────────────────────────────────────────────────────────────────────────
// Replaced the three-week cycle the same day it went in, on two owner calls:
//   · "We are clearly not prioritising Friday Saturdays." The cycle put the
//     spare shifts on Monday, Wednesday and Thursday and left Friday at four
//     and Saturday at three. Asked how to split the five spare shifts, the
//     owner chose ALL SIX on the floor Friday AND Saturday.
//   · "Render it Monday to Sunday again, this is now confusing." The cycle only
//     worked on Sunday–Saturday weeks; on Monday–Sunday it dropped people to
//     one rest day at every rotation boundary.
//
// A FIXED WEEK, not a rotation, and that is what makes Monday–Sunday safe:
// every person rests the same two days every week, so no boundary can squeeze
// them. It also means people with second jobs know which days are theirs.
//
// Floor: Mon 3 · Tue 4 · Wed 4 · Thu 4 · Fri 6 · Sat 6 · Sun 3 — thirty shifts,
// five each, forty hours. With everyone on Friday and Saturday, all twelve rest
// days fall Sunday to Thursday. One supervisor closes every night (S3); on
// Saturday Hiếu closes alongside Bình, and Nhi opens (S1) — the first version
// had Nhi on S3 too, two supervisors closing and New alone on the 14:00 set-up. Mr Sĩ works every busy night, Tuesday to
// Saturday; New works only nights he is on.
//
// Known and said out loud: Nhi, Bình and Hiếu never have a Sunday off, and
// Mr Sĩ, Tiên and New always do. If that becomes a problem the two groups swap.
// ═══════════════════════════════════════════════════════════════════════════

/** Monday … Sunday. null = rest day. Keyed by display name. */
export const WEEKLY_PATTERN: Record<string, (string | null)[]> = {
  'Mr Sĩ': [null, 'S2', 'S3', 'S2', 'S3', 'S2', null],
  'Nhi':   ['S3', null, null, 'S3', 'S2', 'S1', 'S2'],
  'Bình':  ['S2', 'S3', null, null, 'S4', 'S3', 'S3'],
  'Hiếu':  ['S1', null, 'S1', null, 'S1', 'S3', 'S1'],
  'Tiên':  [null, 'S1', 'S4', 'S1', 'S2', 'S2', null],
  'New':   [null, 'S4', 'S2', 'S4', 'S4', 'S2', null],
}

/** The pattern as planned shifts for the week starting Monday `weekStart`. */
export function patternWeek(ids: Record<string, string>, weekStart: string): PlannedShift[] {
  if (weekdayOf(weekStart) !== 1) throw new Error('rota weeks start on a Monday')
  const out: PlannedShift[] = []
  for (const [name, week] of Object.entries(WEEKLY_PATTERN)) {
    const member = ids[name]
    if (!member) throw new Error(`nobody called ${name} on the team`)
    week.forEach((shiftName, d) => { if (shiftName) out.push({ member, shiftDate: addDays(weekStart, d), shiftName }) })
  }
  return out
}
