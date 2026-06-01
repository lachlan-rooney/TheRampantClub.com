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
