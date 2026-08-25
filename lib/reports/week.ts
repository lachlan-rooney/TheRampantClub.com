// VN-week helpers for the weekly report. The canonical window is the last
// COMPLETE Monday–Sunday in Vietnam time; financials auto-include when the
// week ends in the final 7 days of its month.

function vnToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10)
}

// The most recent complete Mon–Sun that has ended before (VN) today.
export function lastCompleteWeekVN(today = vnToday()): { start: string; end: string } {
  const dow = new Date(today + 'T00:00:00Z').getUTCDay() // 0=Sun … 6=Sat
  const daysBackToSunday = dow === 0 ? 7 : dow           // most recent Sunday strictly before today
  const end = addDays(today, -daysBackToSunday)          // Sunday
  const start = addDays(end, -6)                          // Monday
  return { start, end }
}

// True when `end` (YYYY-MM-DD) falls in the last 7 days of its month → the
// month's final weekly report → auto-include financials.
export function isMonthEndWeek(end: string): boolean {
  const [y, m, d] = end.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return lastDay - d <= 6
}
