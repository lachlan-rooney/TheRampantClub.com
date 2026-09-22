// ═══════════════════════════════════════════════════════════════════════════
// Proves lib/rota/policy.ts against the real team and the real shift types.
// A check that has only ever said "pass" proves nothing, so this runs weeks
// that MUST fail alongside the ones that must pass, and exits non-zero if any
// of them comes out the wrong way.
//
//   npx tsx scripts/rota-check-new.mts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { checkWeek, addDays, type RotaStaff, type ShiftType, type PlannedShift } from '@/lib/rota/policy'
import { cycleWeek, type Line } from '@/lib/rota/cycle'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const get = async (p: string) => (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${p}`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json()

const team = await get('team_members?select=id,display_name,is_shift_supervisor,weekly_hours,fixed_days_off&weekly_hours=not.is.null')
const typeRows = await get('rota_shift_types?select=*')
const id = (n: string) => team.find((t: { display_name: string }) => t.display_name === n)?.id as string
const NEW = '00000000-0000-0000-0000-00000000new0'
let staff: RotaStaff[] = team.map((t: any) => ({ id: t.id, name: t.display_name, isSupervisor: t.is_shift_supervisor,
  weeklyHours: t.weekly_hours, fixedDaysOff: t.fixed_days_off ?? [] }))
const withNew = [...staff, { id: NEW, name: 'New hire', isSupervisor: false, weeklyHours: 40, fixedDaysOff: [] }]
// DUTY has no type yet (its hours are the owner's to set). Modelled here as
// eight paid, untimed, off-floor hours — which is what the cycle assumes.
const types: ShiftType[] = [...typeRows.map((t: any) => ({ name: t.name, hours: Number(t.hours), sortOrder: t.sort_order,
  weekdays: t.weekdays, startTime: t.start_time, endTime: t.end_time, breakMinutes: t.break_minutes })),
  { name: 'Duty', hours: 8, sortOrder: 99 }]


const blocking = (weekStart: string, ss: RotaStaff[], shifts: PlannedShift[]) =>
  checkWeek({ weekStart, staff: ss, shiftTypes: types, shifts }).filter(v => v.severity === 'blocking')

let failures = 0
const expect = (label: string, got: ReturnType<typeof blocking>, shouldPass: boolean) => {
  const ok = shouldPass ? got.length === 0 : got.length > 0
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}: ${got.length} blocking${got.length ? ' — e.g. ' + [...new Set(got.map(v => v.rule))].slice(0, 4).join(', ') : ''}`)
}

// 1. CONTROL — the rota as it stands must fail the new rules.
const live = await get(`rota_shifts?select=member,shift_date,shift_name,start_time,end_time&shift_date=gte.2026-10-04&shift_date=lte.2026-10-10`)
expect('live rota, week of Sun 4 Oct (must FAIL)', blocking('2026-10-04', staff,
  live.map((r: any) => ({ member: r.member, shiftDate: r.shift_date, shiftName: r.shift_name, startTime: r.start_time, endTime: r.end_time }))), false)

// 2. The five-person pattern, Sunday first — must pass, every week.
const T5: Record<string, (string | null)[]> = {   // Sun … Sat
  'Mr Sĩ': [null, null, 'S2', 'S2', 'S2', 'S2', 'S1'],
  'Nhi':   ['S2', null, null, 'S3', 'S3', 'S4', 'S3'],
  'Bình':  ['S3', 'S3', 'S3', null, null, 'S3', 'S2'],
  'Hiếu':  [null, 'S1', 'S4', 'S1', 'S4', 'S1', null],
  'Tiên':  ['S1', 'S2', 'S1', 'S4', 'S1', null, null],
}
const pattern = (start: string) => Object.entries(T5).flatMap(([n, w]) =>
  w.map((s, d) => s ? { member: id(n), shiftDate: addDays(start, d), shiftName: s } : null).filter(Boolean) as PlannedShift[])
for (const wk of ['2026-10-04', '2026-10-11']) expect(`five-person pattern, week of ${wk} (must pass)`, blocking(wk, staff, pattern(wk)), true)

// 3. The six-person cycle over nine weeks — must pass every week.
const assign: Record<string, Line> = { [id('Mr Sĩ')]: 'A', [id('Nhi')]: 'B', [id('Bình')]: 'C', [id('Hiếu')]: 'D', [id('Tiên')]: 'E', [NEW]: 'F' }
const anchor = '2026-10-04'
let cycleBad = 0
for (let w = 0; w < 9; w++) { const wk = addDays(anchor, 7 * w)
  const b = blocking(wk, withNew, [...cycleWeek(assign, anchor, wk), ...cycleWeek(assign, anchor, addDays(wk, -7))]) // include the week before for 12h checks
  if (b.length) { cycleBad++; console.log('   ', wk, b.map(v => v.detail).join(' | ')) } }
failures += cycleBad ? 1 : 0
console.log(`${cycleBad ? '✗' : '✓'} six-person cycle, nine weeks (must pass): ${cycleBad} failing week(s)`)

// 4. CONTROL — the cycle with nobody on line F must FAIL (the hire is why it works).
const noF = Object.fromEntries(Object.entries(assign).filter(([k]) => k !== NEW))
expect('cycle with line F empty — five people (must FAIL)', blocking(anchor, staff, cycleWeek(noF, anchor, anchor)), false)

// 5. CONTROL — a sixth shift must be caught as overtime.
const six = [...pattern('2026-10-04'), { member: id('Hiếu'), shiftDate: '2026-10-04', shiftName: 'S2' }]
expect('five-person pattern plus one extra shift for Hiếu (must FAIL)', blocking('2026-10-04', staff, six), false)

console.log(failures ? `\n${failures} check(s) came out wrong` : '\nevery check came out the way it must')
process.exit(failures ? 1 : 0)
