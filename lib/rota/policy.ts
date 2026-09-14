// ═══════════════════════════════════════════════════════════════════════════
// THE SEVEN-DAY ROTA — planning a week, and checking one.
// ───────────────────────────────────────────────────────────────────────────
// Two pure functions over plain data, so both can be tested without a database
// and the page can use either half on its own:
//
//   planWeek()      proposes a week that obeys the rules
//   checkWeek()     reads ANY week — planned, hand-edited, or the one already
//                   in rota_shifts — and says which rules it breaks
//
// checkWeek is the one that matters. A generator that nobody trusts gets
// overridden by hand within a fortnight; a checker keeps working on the rota a
// manager actually built, and says "Tiên is four hours short" on a Tuesday
// rather than at payroll.
//
// THE RULES, in the order they bind:
//   1. Fixed days off are absolute. Hiếu Sun–Mon, Bình Mon–Tue (or whatever is
//      in team_members.fixed_days_off) — never assigned, never negotiated.
//   2. Nobody is off both Saturday and Sunday. The pair that becomes permanent.
//   3. One fixed OFFICE day each, on a named weekday — Mr Sĩ Monday, Tiên
//      Tuesday, Hiếu Wednesday, Nhi Thursday, Bình Friday. These never move;
//      the evenings and the days off rotate around them. (The column is still
//      morning_weekday — the shift was called Morning until 2026-09-14 and
//      renaming a live column to rename a shift is not a trade worth making.)
//   4. Every night has a supervisor on it.
//   5. Everybody reaches their contracted hours.
//   6. Days off vary from the previous week, for anyone not on a fixed pattern.
//
// A WORKED EXAMPLE OF RULE 6 NOT BEING FREE. With this roster, Saturday needs
// three on the floor and two of them are Hiếu and Bình — neither a supervisor.
// So Saturday's third must be Mr Sĩ or Nhi, and Tiên can NEVER work a
// Saturday. Her day off is therefore Saturday every week, and the rota is not
// at fault: two supervisors is. The check still says so each week rather than
// going quiet, because "this cannot vary and here is why" is worth reading.
//
// Rule 5 is the one that fails quietly, which is why it is computed from the
// shift TYPES' hours rather than from start/end times: the club closes after
// midnight and "end minus start" goes negative on every closing shift.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export interface RotaStaff {
  id: string
  name: string
  isSupervisor: boolean
  weeklyHours: number | null
  morningWeekday: number | null
  fixedDaysOff: number[]
  /** The evening shift this person always works, if that is the arrangement.
   *  Mr Sĩ closes — he is the boss, he is there at the end of the night, and
   *  he is on no mids. Their fixed morning is separate and unaffected. */
  alwaysShift?: string | null
  /** Another member of staff this person should get a day off WITH, once a
   *  fortnight. Hiếu and Bình are a couple; on the standing pattern he is off
   *  Sunday and she is off Monday, so they never have a day off together, and
   *  a rota that quietly does that to two people is a rota they will come to
   *  resent. Once every two weeks, not every week — the club is open seven
   *  days on five people, and taking two off the same night twice a month is
   *  what the roster can actually absorb. Set on BOTH of them. */
  pairedWith?: string | null
}

export interface ShiftType {
  name: string
  hours: number
  sortOrder: number
}

/** One assignment: a person, a date, a shift type. */
export interface PlannedShift {
  member: string
  shiftDate: string      // yyyy-mm-dd
  shiftName: string
}

export interface Violation {
  severity: 'blocking' | 'warning'
  rule: string
  who?: string
  when?: string
  detail: string
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (start: string, n: number) => {
  const d = new Date(start + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()

/** How many people the club wants on each night.
 *
 *  These are not a wish — they are what the WEEK ADDS UP TO. Five people, one
 *  day off each (two where it is fixed by arrangement) and one morning each
 *  leaves exactly 23 evening shifts to place, and the nights can only take who
 *  is free: Monday has just Tiên and Nhi available once Mr Sĩ is on his
 *  morning and Hiếu and Bình are off, so Monday is 2 whatever anyone wants.
 *
 *  Change these and the planner will tell you within a second whether the week
 *  still closes. */
export const EVENING_DEMAND: Record<number, number> = {
  0: 3,  // Sunday     — Hiếu is off; Mr Sĩ takes his day off here
  1: 3,  // Monday     — Bình is off, Mr Sĩ is on his morning
  2: 4,  // Tuesday
  3: 4,  // Wednesday
  4: 4,  // Thursday
  5: 4,  // Friday
  6: 3,  // Saturday   — Mr Sĩ closes; Tiên and Nhi are off
}

/** The daytime shift — the one fixed weekday shift each person works.
 *
 *  Named "Office" from 2026-09-14, and named ONCE here rather than typed as a
 *  literal in five places, because the last rename had to be chased through
 *  the file by hand. It is not a bar shift: it is the desk, the deliveries, the
 *  stock and the paperwork, 10:00–16:00 with an hour for lunch. */
export const DAY_SHIFT = 'Office'

/** The evening shift types, in the order they are handed out.
 *
 *  TWO, not three. Mid was retired on 2026-09-14 with the move to a three-till-
 *  midnight night: it started at four and ended at half past twelve, which is
 *  the Close, so it was a second name for the same shift. Three or four people
 *  work each night on these two patterns. */
const EVENING_ORDER = ['Open', 'Close']

// ── PLAN ───────────────────────────────────────────────────────────────────
//
// A SEARCH, NOT A FILL. The first version handed each night to whoever was
// furthest from their hours, and it failed in a way worth recording: it left
// three people 8.75h short every week while Mr Sĩ ran 8.75h over, because a
// greedy pass cannot see that Thursday and Friday are FORCED — on those nights
// exactly four people are available and four are needed, so every other
// decision has to be made around them.
//
// The space is tiny (5 people × 7 nights), so this does the honest thing and
// searches it: each person needs an exact number of evenings to reach their
// contracted hours, each night needs its demand met with a supervisor present,
// and backtracking finds an arrangement or proves there isn't one. "There
// isn't one" is a useful answer — it is the difference between a rota that
// quietly shorts somebody and a sentence telling you Saturday cannot be
// covered.

/** How many evenings this person works.
 *
 *  From the STRUCTURE, not from their contracted hours: one day off a week
 *  (or the fixed pattern where they have one), one morning, and every other
 *  night on the floor. Hours are then a RESULT, which checkWeek reports against
 *  the contract — rather than a target the plan bends itself around.
 *
 *  That is the owner's rule, stated plainly: "one day off, then one morning
 *  shift will suffice." */
export const DEFAULT_DAYS_OFF = 1

function eveningsNeeded(p: RotaStaff, _shiftTypes: ShiftType[], hasMorning: boolean): number {
  const off = p.fixedDaysOff.length || DEFAULT_DAYS_OFF
  return Math.max(0, 7 - off - (hasMorning ? 1 : 0))
}

export function planWeek(opts: {
  weekStart: string            // a Sunday, yyyy-mm-dd
  staff: RotaStaff[]
  shiftTypes: ShiftType[]
  /** Which week of the rotation this is; it nudges the search so that two
   *  consecutive weeks do not come back identical. */
  cycleIndex?: number
  /** Last week's days off per member, so this week can differ from it. */
  previousDaysOff?: Record<string, number[]>
  /** Evenings wanted per weekday. Defaults to EVENING_DEMAND. */
  demand?: Record<number, number>
}): { shifts: PlannedShift[]; violations: Violation[] } {
  const { weekStart, staff, shiftTypes } = opts
  const cycle = opts.cycleIndex ?? 0
  const demand = opts.demand ?? EVENING_DEMAND
  const shifts: PlannedShift[] = []

  // 1 — the mornings. Fixed points: one person per weekday, never moved, and
  //     never placed on a day that person is off.
  const morningOn: Record<string, number | null> = {}
  for (const p of staff) {
    morningOn[p.id] = null
    if (p.morningWeekday == null) continue
    if (p.fixedDaysOff.includes(p.morningWeekday)) continue
    morningOn[p.id] = p.morningWeekday
    shifts.push({ member: p.id, shiftDate: addDays(weekStart, p.morningWeekday), shiftName: DAY_SHIFT })
  }

  // 2 — how many evenings each person must work to reach their hours.
  const need: Record<string, number> = {}
  for (const p of staff) need[p.id] = eveningsNeeded(p, shiftTypes, morningOn[p.id] != null)

  // 3 — who could work each night at all.
  const canWork = (p: RotaStaff, d: number) =>
    !p.fixedDaysOff.includes(d) && morningOn[p.id] !== d

  // Days are taken hardest-first — the nights with the least slack decide the
  // week, and choosing them first is what stops the search thrashing.
  const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => {
    const slack = (d: number) => staff.filter(p => canWork(p, d)).length - (demand[d] ?? 0)
    return slack(a) - slack(b)
  })

  const chosen: Record<number, string[]> = {}
  const remaining = { ...need }
  let requireSupervisor = true

  const search = (i: number): boolean => {
    if (i === order.length) {
      if (!Object.values(remaining).every(n => n === 0)) return false
      // Rule 2 belongs IN the search, not after it. Checking it afterwards
      // produced weeks where everyone hit their hours and two people were off
      // both weekend days — correct on one rule, broken on another, and no
      // amount of reporting fixes a plan that was built wrong.
      // Rule 2 belongs in the search. With one day off each it is nearly free —
      // but Hiếu and Bình have two, so it still has to be checked.
      for (const p of staff) {
        const worksSun = (chosen[0] ?? []).includes(p.id) || morningOn[p.id] === 0
        const worksSat = (chosen[6] ?? []).includes(p.id) || morningOn[p.id] === 6
        if (!worksSun && !worksSat) return false
      }
      return true
    }
    const d = order[i]
    const want = demand[d] ?? 0
    const pool = staff.filter(p => canWork(p, d))
    // Rotate the pool by the cycle so consecutive weeks differ, then prefer
    // whoever still owes the most evenings.
    const rotated = pool.map((_, k) => pool[(k + cycle + d) % pool.length])
    const sorted = [...rotated].sort((a, b) => remaining[b.id] - remaining[a.id])

    let combos: RotaStaff[][] = []
    const build = (startAt: number, acc: RotaStaff[]) => {
      if (acc.length === want) { combos.push([...acc]); return }
      for (let k = startAt; k < sorted.length; k++) {
        const p = sorted[k]
        if (remaining[p.id] <= 0) continue
        acc.push(p); build(k + 1, acc); acc.pop()
        if (combos.length > 400) return      // enough to choose from
      }
    }
    build(0, [])

    // Rule 6, made to happen rather than reported afterwards: prefer combos
    // that put someone BACK to work on the night they had off last week. A
    // cycle counter alone did not do it — the search kept finding the same
    // valid week and "varied days off" quietly became "Tiên always has
    // Saturday".
    // Two halves, and the second is the one that was missing. Preferring
    // people who were OFF this night last week is not enough on its own: on a
    // night where two of three must work, the same two kept being chosen and
    // the third kept the same day off for eight weeks running. So combos are
    // ALSO penalised for including someone who already worked this night last
    // week, and ties rotate with the cycle — otherwise a deterministic search
    // returns the identical valid week every time, which is how "varied days
    // off" becomes "Tiên always has Saturday".
    const wasOff = (p: RotaStaff) => opts.previousDaysOff?.[p.id]?.includes(d) ?? false
    const prevKnown = !!opts.previousDaysOff
    const score = (combo: RotaStaff[]) =>
      combo.filter(wasOff).length - (prevKnown ? combo.filter(p => !wasOff(p) && !p.fixedDaysOff.length).length * 0.5 : 0)
    const decorated = combos.map((c, idx) => ({ c, idx, s: score(c) }))
    decorated.sort((a, b) =>
      b.s - a.s || ((a.idx + cycle) % decorated.length) - ((b.idx + cycle) % decorated.length))
    combos = decorated.map(d2 => d2.c)

    for (const combo of combos) {
      if (requireSupervisor && !combo.some(p => p.isSupervisor)) continue   // rule 4, in the search
      for (const p of combo) remaining[p.id]--
      chosen[d] = combo.map(p => p.id)
      if (search(i + 1)) return true
      for (const p of combo) remaining[p.id]++
      delete chosen[d]
    }
    return false
  }

  // Two passes. The first insists on a supervisor every night; if the week
  // cannot be built that way, the second drops that one rule so a manager gets
  // a usable draft plus a sentence naming the night that cannot be covered —
  // rather than an empty grid and no explanation.
  let solved = search(0)
  let supervisorRelaxed = false
  if (!solved) {
    for (const k of Object.keys(chosen)) delete chosen[Number(k)]
    for (const p of staff) remaining[p.id] = need[p.id]
    requireSupervisor = false
    supervisorRelaxed = true
    solved = search(0)
  }

  for (let d = 0; d < 7; d++) {
    const ids = chosen[d] ?? []
    ids.forEach((id, k) => {
      shifts.push({ member: id, shiftDate: addDays(weekStart, d), shiftName: EVENING_ORDER[k % EVENING_ORDER.length] })
    })
  }

  const violations = checkWeek({ ...opts, shifts })

  if (supervisorRelaxed || !solved) {
    // Say WHICH night and WHY, with the arithmetic — "it didn't work" sends a
    // manager back to a spreadsheet; "Saturday has only Bình and Hiếu free,
    // and neither is a supervisor" tells them what to change.
    for (let d = 0; d < 7; d++) {
      const pool = staff.filter(p => canWork(p, d))
      const sups = pool.filter(p => p.isSupervisor)
      const want = demand[d] ?? 0
      if (pool.length < want) {
        violations.unshift({ severity: 'blocking', rule: 'not enough people', when: WEEKDAYS[d],
          detail: `${WEEKDAYS[d]} wants ${want} on the floor and only ${pool.length} can work it (${pool.map(p => p.name).join(', ') || 'nobody'}).` })
      } else if (sups.length === 0) {
        violations.unshift({ severity: 'blocking', rule: 'no supervisor can work this night', when: WEEKDAYS[d],
          detail: `${WEEKDAYS[d]} can only be worked by ${pool.map(p => p.name).join(', ')} — no supervisor among them.` })
      }
    }
  }
  if (!solved) {
    violations.unshift({
      severity: 'blocking',
      rule: 'no arrangement satisfies the rules',
      detail: 'No week reaches everyone\'s contracted hours on this demand, even with the supervisor rule '
            + 'set aside. Something has to give: the number wanted on one night, a fixed day off, or the hours.',
    })
  } else if (supervisorRelaxed) {
    violations.unshift({
      severity: 'blocking',
      rule: 'built without a supervisor every night',
      detail: 'Everyone reaches their hours, but only by leaving at least one night without a supervisor. '
            + 'Moving one evening from the busiest night to that one usually fixes it.',
    })
  }
  return { shifts, violations }
}

// ── CHECK ──────────────────────────────────────────────────────────────────

export function checkWeek(opts: {
  weekStart: string
  staff: RotaStaff[]
  shiftTypes: ShiftType[]
  shifts: PlannedShift[]
  previousDaysOff?: Record<string, number[]>
}): Violation[] {
  const { weekStart, staff, shiftTypes, shifts } = opts
  const out: Violation[] = []
  const hoursOf = (name: string) => shiftTypes.find(t => t.name === name)?.hours ?? 0
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  for (const p of staff) {
    const mine = shifts.filter(s => s.member === p.id)
    const workedDays = new Set(mine.map(s => weekdayOf(s.shiftDate)))
    const off = [0, 1, 2, 3, 4, 5, 6].filter(d => !workedDays.has(d))

    // 1 — fixed days off are absolute
    for (const d of p.fixedDaysOff) {
      if (workedDays.has(d)) {
        out.push({ severity: 'blocking', rule: 'fixed day off', who: p.name, when: WEEKDAYS[d],
          detail: `${p.name} is off ${WEEKDAYS[d]} every week by arrangement, and is rostered.` })
      }
    }

    // 2 — never both weekend days
    if (off.includes(0) && off.includes(6)) {
      out.push({ severity: 'blocking', rule: 'both weekend days off', who: p.name,
        detail: `${p.name} is off Saturday AND Sunday. That pair is the one the rota never hands out.` })
    }

    // 3 — the fixed morning
    if (p.morningWeekday != null && !p.fixedDaysOff.includes(p.morningWeekday)) {
      const has = mine.some(s => s.shiftName === DAY_SHIFT && weekdayOf(s.shiftDate) === p.morningWeekday)
      if (!has) {
        out.push({ severity: 'warning', rule: 'fixed morning', who: p.name, when: WEEKDAYS[p.morningWeekday],
          detail: `${p.name}'s ${WEEKDAYS[p.morningWeekday]} morning is missing — those do not move.` })
      }
    }

    // 4b — the shift they always work, where that is the arrangement
    if (p.alwaysShift) {
      const wrong = mine.filter(s => s.shiftName !== DAY_SHIFT && s.shiftName !== p.alwaysShift)
      for (const w of wrong) {
        out.push({ severity: 'blocking', rule: 'wrong shift for this person', who: p.name, when: w.shiftDate,
          detail: `${p.name} is on ${w.shiftName} on ${w.shiftDate} — they always work ${p.alwaysShift}.` })
      }
    }

    // 5 — contracted hours
    const hours = mine.reduce((t, s) => t + hoursOf(s.shiftName), 0)
    if (p.weeklyHours == null) {
      out.push({ severity: 'warning', rule: 'hours not recorded', who: p.name,
        detail: `${p.name} has no contracted hours on file, so this week cannot be checked against them.` })
    } else if (hours + 1.001 < p.weeklyHours) {
      // An hour's slack below the ceiling is not "short": six days at 8.5h and
      // a five-hour morning is 47.5h by design, and flagging that every week
      // would train everyone to ignore the check.
      out.push({ severity: 'blocking', rule: 'short of contracted hours', who: p.name,
        detail: `${p.name} is rostered ${hours.toFixed(2)}h against ${p.weeklyHours}h — ${(p.weeklyHours - hours).toFixed(2)}h short.` })
    } else if (hours > p.weeklyHours) {
      // 48 is a CEILING, not a target to drift past. Over it is a fault, not a
      // note — the rota is where that gets caught, because the alternative is
      // catching it in a payroll run or not at all.
      out.push({ severity: 'blocking', rule: 'over the weekly maximum', who: p.name,
        detail: `${p.name} is rostered ${hours.toFixed(2)}h against a ${p.weeklyHours}h maximum — ${(hours - p.weeklyHours).toFixed(2)}h over.` })
    }

    // 6 — days off should move week to week, for anyone not on a fixed pattern
    const prev = opts.previousDaysOff?.[p.id]
    if (prev && !p.fixedDaysOff.length && prev.length && off.length
        && prev.length === off.length && prev.every(d => off.includes(d))) {
      out.push({ severity: 'warning', rule: 'days off did not move', who: p.name,
        detail: `${p.name} has the same days off as last week (${off.map(d => WEEKDAYS[d]).join(', ')}).` })
    }
  }

  // 7 — couples get a day off together once a fortnight
  //
  // A WARNING, NOT A BLOCK, and deliberately: with five people covering seven
  // nights this is the first thing that has to give in a week where someone is
  // ill, and a rule that turns the whole rota red for it would get switched
  // off. It says "this fortnight has not happened yet", which is the thing a
  // manager can act on while there is still a week to act in.
  const seen = new Set<string>()
  for (const p of staff) {
    if (!p.pairedWith || seen.has(p.id)) continue
    const other = staff.find(q => q.id === p.pairedWith)
    if (!other) continue
    seen.add(p.id); seen.add(other.id)

    const offOf = (x: RotaStaff) => {
      const worked = new Set(shifts.filter(s => s.member === x.id).map(s => weekdayOf(s.shiftDate)))
      return [0, 1, 2, 3, 4, 5, 6].filter(d => !worked.has(d))
    }
    const shared = offOf(p).filter(d => offOf(other).includes(d))
    if (shared.length) continue

    // Not this week — which is fine if it happened last week. Only when the
    // fortnight has gone by with no shared day is there anything to say.
    const prevA = opts.previousDaysOff?.[p.id]
    const prevB = opts.previousDaysOff?.[other.id]
    const sharedLastWeek = prevA && prevB && prevA.some(d => prevB.includes(d))
    if (sharedLastWeek) continue
    if (!prevA || !prevB) continue   // no previous week on file: nothing proven either way

    out.push({ severity: 'warning', rule: 'no day off together this fortnight',
      who: `${p.name} & ${other.name}`,
      detail: `${p.name} and ${other.name} have had no day off together for two weeks — they should share one every other week.` })
  }

  // 4 — a supervisor on every night the club is open
  for (const date of dates) {
    const onTonight = shifts.filter(s => s.shiftDate === date && s.shiftName !== DAY_SHIFT)
    if (onTonight.length === 0) {
      out.push({ severity: 'blocking', rule: 'night with nobody on', when: date,
        detail: `Nobody is rostered for the evening of ${date}.` })
      continue
    }
    const hasSupervisor = onTonight.some(s => staff.find(p => p.id === s.member)?.isSupervisor)
    if (!hasSupervisor) {
      out.push({ severity: 'blocking', rule: 'night without a supervisor', when: date,
        detail: `${WEEKDAYS[weekdayOf(date)]} ${date} has no shift supervisor on the floor.` })
    }
  }

  return out
}
