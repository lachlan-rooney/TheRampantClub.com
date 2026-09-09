// Shared date helpers pinned to Vietnam time (Asia/Ho_Chi_Minh = UTC+7,
// no DST). The club operates entirely in this timezone — calendar
// "today", booking defaults, visit_date defaults, etc. should all read
// the Vietnam calendar regardless of where the server or browser is.
//
// Use these instead of new Date().toISOString().slice(0,10) anywhere a
// YYYY-MM-DD is intended to mean "the current Vietnamese day."

export const VN_TZ = 'Asia/Ho_Chi_Minh'

// en-CA returns YYYY-MM-DD which is exactly the wire format we want.
const VN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
})

/** YYYY-MM-DD in Vietnam time. Defaults to "now." */
export function vnDateString(d: Date = new Date()): string {
  return VN_DATE_FMT.format(d)
}

const VN_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TZ,
  hour: '2-digit', minute: '2-digit', hour12: false,
})

/** HH:MM (24h) in Vietnam time. */
export function vnTimeString(d: Date = new Date()): string {
  return VN_TIME_FMT.format(d)
}

const VN_DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TZ,
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

/** Human-readable date + time in Vietnam time. */
export function vnDateTimeString(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return VN_DATETIME_FMT.format(date)
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMESTAMPS IN FORMS — the round-trip that silently ate seven hours.
// ───────────────────────────────────────────────────────────────────────────
// A <input type="datetime-local"> has NO timezone. It is a wall clock. So both
// directions have to say which wall clock, and the fixture editor said neither:
//
//   load   new Date(iso).toISOString().slice(0,16)   → put the UTC wall clock in
//   save   new Date(inputValue).toISOString()        → read it as the BROWSER's
//
// Those are different clocks, so every open-and-save moved the event 7 hours
// earlier. An event at seven showed as noon, was saved as five in the morning,
// and nothing anywhere reported an error. Ken Grier was found at 12:00 noon
// sitting directly above its own description promising "seven until ten".
//
// The club runs on one clock. Use these in both directions and the value cannot
// drift, however many times it is edited. Vietnam has no DST, so +07:00 is exact.
const VN_INPUT_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

/** A timestamptz → the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in Vietnam time. */
export function vnInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  // en-CA gives "2026-09-18, 19:00" — one split, no locale guesswork.
  const [day, time] = VN_INPUT_FMT.format(date).split(', ')
  return `${day}T${time}`
}

/** A datetime-local value read as VIETNAM wall-clock → ISO. The inverse of vnInputValue. */
export function vnInputToISO(v: string | null | undefined): string | null {
  if (!v) return null
  const withSeconds = v.length === 16 ? `${v}:00` : v      // "…THH:mm" → "…THH:mm:ss"
  const d = new Date(`${withSeconds}+07:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const VN_EVENT_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TZ, weekday: 'short', day: 'numeric', month: 'short',
})
const VN_EVENT_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
})

/** "Fri 18 Sept · 7:00 pm" in Vietnam time — what a member should read. */
export function vnEventLabel(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  // Two formatters, not one with a separator patched out of a locale string.
  return `${VN_EVENT_DATE.format(date)} · ${VN_EVENT_TIME.format(date)}`
}
