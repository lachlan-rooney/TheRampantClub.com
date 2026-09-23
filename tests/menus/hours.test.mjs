// ═══════════════════════════════════════════════════════════════════════════
// WHEN A KITCHEN IS TAKING ORDERS — the arithmetic, on its own.
//   npx tsx tests/menus/hours.test.mjs
// ───────────────────────────────────────────────────────────────────────────
// No database and no browser: this is the rule the tablet, the tray and the
// server all obey, so it is worth pinning down by itself. The cases that
// matter are the boundaries (the minute of last orders), the window that runs
// past midnight, and a venue with no hours at all.
// ═══════════════════════════════════════════════════════════════════════════
import { venueState, waitLabel, vnClock } from '../../lib/menus/hours.ts'

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

/** A moment in Sài Gòn, written as one. */
const vn = (iso) => new Date(`${iso}+07:00`)

// Wed 23 Sep 2026 is a Wednesday (weekday 3).
t(vnClock(vn('2026-09-23T19:30')).weekday === 3, 'Wednesday evening reads as weekday 3')
t(vnClock(vn('2026-09-23T00:10')).minutes === 10, 'ten past midnight is 10 minutes in')
// The tablet may be anywhere; the instant is what matters.
t(vnClock(new Date('2026-09-23T12:30:00Z')).minutes === 19 * 60 + 30, 'a UTC instant is read in Sài Gòn time')

// A kitchen serving Wednesday 17:00, last orders 21:30.
const dinner = [{ weekday: 3, opens_at: '17:00', last_order_at: '21:30' }]
t(venueState(dinner, vn('2026-09-23T19:30')).open, 'open mid-service')
t(venueState(dinner, vn('2026-09-23T21:29')).open, 'open a minute before last orders')
t(!venueState(dinner, vn('2026-09-23T21:30')).open, 'CLOSED the minute last orders passes')
t(venueState(dinner, vn('2026-09-23T19:30')).lastOrders === '21:30', 'and says when last orders are while open')
const early = venueState(dinner, vn('2026-09-23T15:00'))
t(!early.open && early.opensAt === '17:00' && early.opensToday === true, 'before opening it says when it opens today', JSON.stringify(early))
const late = venueState(dinner, vn('2026-09-23T22:00'))
t(!late.open && late.opensAt === '17:00' && late.opensToday === false, 'after last orders it points at the next day it serves', JSON.stringify(late))
t(!venueState(dinner, vn('2026-09-24T19:30')).open, 'and it is shut on a day it does not serve')

// The club's own late window: Friday 17:00 → 00:30, which is Saturday.
const late_night = [{ weekday: 5, opens_at: '17:00', last_order_at: '00:30' }]
t(venueState(late_night, vn('2026-09-25T23:59')).open, 'a window that crosses midnight is open at 23:59')
t(venueState(late_night, vn('2026-09-26T00:10')).open, 'and still open at ten past midnight, on the next date')
t(!venueState(late_night, vn('2026-09-26T00:30')).open, 'and shut at 00:30 exactly')
t(!venueState(late_night, vn('2026-09-26T12:00')).open, 'and shut on Saturday lunchtime')

// Lunch and dinner, with the kitchen shut in between.
const split = [
  { weekday: 3, opens_at: '11:30', last_order_at: '14:00' },
  { weekday: 3, opens_at: '17:00', last_order_at: '21:30' },
]
t(venueState(split, vn('2026-09-23T12:00')).open, 'open at lunch')
const between = venueState(split, vn('2026-09-23T15:30'))
t(!between.open && between.opensAt === '17:00', 'shut between services, and says when dinner starts', JSON.stringify(between))
t(venueState(split, vn('2026-09-23T18:00')).open, 'open again at dinner')

// No hours set: unrestricted, and honest about it.
const none = venueState([], vn('2026-09-23T03:00'))
t(none.open && none.unknown, 'a venue with no hours set is not shut by this feature', JSON.stringify(none))
t(venueState(null, vn('2026-09-23T03:00')).unknown, 'and null is treated the same as empty')

// The wait label invents nothing.
t(waitLabel(null) === null && waitLabel(0) === null, 'no wait is shown where the club has not given one')
t(waitLabel(25) === '≈ 25 min', 'a wait reads as an estimate', String(waitLabel(25)))
t(waitLabel(90) === '≈ 1h 30m', 'and long waits read in hours', String(waitLabel(90)))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
