// ═══════════════════════════════════════════════════════════════════════════
// IS THIS KITCHEN TAKING ORDERS RIGHT NOW?
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-23: a restaurant that stops taking orders at a given time
// must show as closed when the time hits it.
//
// ── ONE FUNCTION, THREE CALLERS ───────────────────────────────────────────
// The tablet greys the restaurant out, the tray refuses to send it, and the
// server refuses to accept it. All three ask this, so a member cannot be shown
// one answer and given another.
//
// ── THE CLOCK IS THE SERVER'S ─────────────────────────────────────────────
// A tablet on a bar can have any time it likes on it; the club's kitchens do
// not close according to a device's clock. Every caller passes a time taken
// from the server, and the browser measures its own drift against it exactly
// the way the Tết countdown does.
//
// ── SAI GON, ALWAYS ───────────────────────────────────────────────────────
// Hours are club wall-clock times, so they are read in Asia/Ho_Chi_Minh. There
// is no daylight saving in Vietnam and there has not been since 1975, so the
// offset is a fixed +07:00 and the arithmetic below is safe. If the club ever
// opens somewhere that does change its clocks, this is the file that has to
// learn about it.
//
// ── THE LAST HALF HOUR ────────────────────────────────────────────────────
// Owner, 2026-09-25: "add a mini countdown to last orders if they're within 30
// mins of it." venueState returns minutesLeft whenever a kitchen is open, and
// the surfaces decide what to do with it; LAST_CALL_MIN is the club's idea of
// "nearly", kept here so the tablet and anything after it agree.
//
// ── PAST MIDNIGHT ─────────────────────────────────────────────────────────
// A window whose last order is EARLIER than its opening (17:00 → 00:30) runs
// into the next day. At 00:10 on Saturday the kitchen that is still serving is
// FRIDAY's window, so yesterday's rows are checked as well as today's. Getting
// this wrong would shut every late kitchen at midnight, which is when this
// club is busiest.
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceWindow {
  /** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
  weekday: number
  /** 'HH:MM', club wall clock. */
  opens_at: string
  /** 'HH:MM'. Earlier than opens_at means it runs past midnight. */
  last_order_at: string
}

export interface VenueState {
  /** Can this kitchen be ordered from at that moment? */
  open: boolean
  /** Open: when it stops taking orders, 'HH:MM'. */
  lastOrders?: string
  /** Open: whole minutes until last orders. Counts down to 1, never 0 —
   *  at 0 the kitchen is closed and this is not the field that says so. */
  minutesLeft?: number
  /** Closed: when it next opens, 'HH:MM', and whether that is today. */
  opensAt?: string
  opensToday?: boolean
  /** No hours have been set for this venue at all. */
  unknown: boolean
}

const VN_OFFSET_MIN = 7 * 60

/** Within this many minutes of last orders, a kitchen is on last call. */
export const LAST_CALL_MIN = 30

/** Minutes since midnight in Sài Gòn, and the weekday there. */
export function vnClock(now: Date | string | number): { minutes: number; weekday: number } {
  const t = new Date(now).getTime() + VN_OFFSET_MIN * 60_000
  const d = new Date(t)
  return { minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay() }
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const toHHMM = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Where a venue stands at `now`. No windows at all = unrestricted (and it
 *  says so through `unknown`, so a surface can stay quiet rather than claim
 *  opening times the club has never given). */
export function venueState(windows: ServiceWindow[] | null | undefined, now: Date | string | number): VenueState {
  const w = (windows ?? []).filter(x => x && x.opens_at && x.last_order_at)
  if (!w.length) return { open: true, unknown: true }

  const { minutes, weekday } = vnClock(now)
  const yesterday = (weekday + 6) % 7

  // Today's windows, plus yesterday's that run past midnight.
  for (const x of w) {
    const open = toMin(x.opens_at), last = toMin(x.last_order_at)
    const crosses = last <= open
    // How long is left, counted forward to last orders — the modulo carries a
    // window that runs past midnight (23:50 now, 00:30 last orders = 40 min).
    const left = ((last - minutes) % 1440 + 1440) % 1440
    const serving = { open: true as const, lastOrders: x.last_order_at, minutesLeft: left, unknown: false }
    if (x.weekday === weekday && !crosses && minutes >= open && minutes < last) return serving
    if (x.weekday === weekday && crosses && minutes >= open) return serving
    if (x.weekday === yesterday && crosses && minutes < last) return serving
  }

  // Closed: find the next opening, today or on a later day, and say when.
  let best: { at: number; today: boolean } | null = null
  // 0..7, not 0..6: a kitchen that serves only on Wednesdays, asked on a
  // Wednesday night after last orders, opens NEXT Wednesday — seven days
  // ahead. Stopping at six found nothing and said nothing.
  for (let ahead = 0; ahead <= 7; ahead++) {
    const day = (weekday + ahead) % 7
    for (const x of w.filter(x => x.weekday === day)) {
      const open = toMin(x.opens_at)
      if (ahead === 0 && open <= minutes) continue          // already gone today
      const at = ahead * 1440 + open
      if (!best || at < best.at) best = { at, today: ahead === 0 }
    }
    if (best) break
  }

  return best
    ? { open: false, opensAt: toHHMM(best.at), opensToday: best.today, unknown: false }
    : { open: false, unknown: false }
}

/** A kitchen's own estimate, as a short label. Null where the club has never
 *  said — an invented wait is worse than no wait. */
export function waitLabel(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null
  const n = Number(minutes)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 60) return `≈ ${Math.round(n)} min`
  const h = Math.floor(n / 60), m = Math.round(n % 60)
  return m ? `≈ ${h}h ${m}m` : `≈ ${h}h`
}
