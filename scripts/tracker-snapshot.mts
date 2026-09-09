import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { buildTracker } from '../lib/reports/tracker'
const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const t = await buildTracker(sb, '2026-09-09')
console.log('── DORMANCY, from bookings and split ──')
console.log(`  paying members: ${t.dormancy.paying_members}`)
console.log(`    not booked 30d: ${t.dormancy.paying_no_booking_30}  ·  60d: ${t.dormancy.paying_no_booking_60}  ·  never: ${t.dormancy.paying_never_booked}`)
console.log(`  honorary, counted apart: ${t.dormancy.honorary_members} (never booked ${t.dormancy.honorary_never_booked})`)
console.log('\n── ATTENDANCE COVERAGE ──')
console.log(`  bookings this month: ${t.attendance.bookings_in_month}`)
console.log(`  arrival recorded:    ${t.attendance.arrival_recorded}`)
console.log(`  end time recorded:   ${t.attendance.end_time_recorded}`)
console.log(`  walk-in visits:      ${t.attendance.walk_in_visits}`)
console.log(`  booked-vs-attended measurable: ${t.attendance.measurable}`)
console.log(`  original booked times preserved: ${t.attendance.booked_times_preserved}`)
console.log('\n── NOT MEASURED ──')
console.log(`  staff-recorded median ${t.usage.staff_recorded_median_min ?? '—'} min, on ${t.usage.staff_recorded_coverage_pct}% of visits`)
