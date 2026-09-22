// ═══════════════════════════════════════════════════════════════════════════
// Proves lib/rota/policy.ts against the real team, the real shift types and
// the weekly pattern (lib/rota/pattern.ts). A check that has only ever said
// "pass" proves nothing, so weeks that MUST fail run alongside the ones that
// must pass, and the script exits non-zero if any comes out the wrong way.
//
// The must-fail controls are FIXED weeks written here, never "whatever is on
// the rota now": the first version used the live rota as its control, and the
// day the live rota was replaced with a compliant one the control passed and
// the harness reported itself broken.
//
//   npx tsx scripts/rota-check-new.mts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { checkWeek, addDays, type RotaStaff, type ShiftType, type PlannedShift } from '@/lib/rota/policy'
import { rotaWeek, ANCHOR_LINES, lineFor } from '@/lib/rota/pattern'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const get = async (p: string) => (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${p}`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json()
const team = await get('team_members?select=id,display_name,is_shift_supervisor,weekly_hours,fixed_days_off&weekly_hours=not.is.null')
const staff: RotaStaff[] = team.map((t: any) => ({ id: t.id, name: t.display_name, isSupervisor: t.is_shift_supervisor, weeklyHours: t.weekly_hours, fixedDaysOff: t.fixed_days_off ?? [] }))
const ids = Object.fromEntries(team.map((t: any) => [t.display_name, t.id]))
const types: ShiftType[] = (await get('rota_shift_types?select=*')).map((t: any) => ({ name: t.name, hours: Number(t.hours), sortOrder: t.sort_order,
  weekdays: t.weekdays, startTime: t.start_time, endTime: t.end_time, breakMinutes: t.break_minutes }))
if (staff.length < 6) { console.log('✗ fewer than six people with weekly hours — inputs did not load'); process.exit(1) }

let failures = 0
const blocking = (wk: string, shifts: PlannedShift[]) => checkWeek({ weekStart: wk, staff, shiftTypes: types, shifts }).filter(v => v.severity === 'blocking')
const expect = (label: string, b: ReturnType<typeof blocking>, shouldPass: boolean) => {
  const ok = shouldPass ? b.length === 0 : b.length > 0; if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}: ${b.length} blocking${b.length ? ' — e.g. ' + [...new Set(b.map(v => v.rule))].slice(0, 4).join(', ') : ''}`) }

const WK = '2026-10-05'
// 1. The pattern passes, on several Mondays.
for (const wk of ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']) expect(`rota, week of ${wk} (must pass)`, blocking(wk, rotaWeek(ids, wk)), true)
// 1b. It changes every week, and never runs anyone more than five days in a row across the moves.
const weeks = Array.from({ length: 9 }, (_, i) => addDays('2026-09-28', 7 * i))
const moved = weeks.slice(1).every((w, i) => Object.keys(ANCHOR_LINES).every(n => lineFor(n, w) !== lineFor(n, weeks[i])))
const all = weeks.flatMap(w => rotaWeek(ids, w)); let maxRun = 0
for (const m of Object.values(ids)) { const ds = all.filter(s => s.member === m).map(s => s.shiftDate).sort(); let run = 0, prev = ''
  for (const d of ds) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; maxRun = Math.max(maxRun, run); prev = d } }
if (!moved || maxRun > 5) failures++
console.log(`${moved ? '✓' : '✗'} everyone changes line every week · ${maxRun <= 5 ? '✓' : '✗'} longest run over nine weeks: ${maxRun} days`)
// 2. It really does put all six on Friday and Saturday.
const p = rotaWeek(ids, WK); const fri = p.filter(s => s.shiftDate === addDays(WK, 4)).length, sat = p.filter(s => s.shiftDate === addDays(WK, 5)).length
const six = fri === 6 && sat === 6; if (!six) failures++
console.log(`${six ? '✓' : '✗'} Friday ${fri} and Saturday ${sat} on the floor (must be 6 and 6)`)
// 3. CONTROL: the OLD model — six 9-hour Closes 15:00–00:00 — must fail.
const oldWeek: PlannedShift[] = Object.values(ids).slice(0, 5).flatMap((m: any) =>
  [0, 1, 2, 3, 4, 5].map(d => ({ member: m, shiftDate: addDays(WK, d), shiftName: 'Close', startTime: '15:00', endTime: '00:00' })))
expect('old model, six 9-hour closes to 00:00 (must FAIL)', blocking(WK, oldWeek), false)
// 4. CONTROL: the pattern without New must fail — New is part of the floor plan.
expect('pattern with New taken out (must FAIL)', blocking(WK, p.filter(s => s.member !== ids['New'])), false)
// 5. CONTROL: one extra shift must be caught as overtime.
expect('pattern plus a sixth shift for Hiếu (must FAIL)', blocking(WK, [...p, { member: ids['Hiếu'], shiftDate: addDays(WK, 1), shiftName: 'S2' }]), false)
// 6. Every name in the rota is a real person with weekly hours.
const missing = Object.keys(ANCHOR_LINES).filter(n => !staff.some(s => s.name === n)); if (missing.length) failures++
console.log(`${missing.length ? '✗' : '✓'} every rota name is on the team${missing.length ? ' — missing ' + missing : ''}`)

// 7. CONTROL for 1b: the order B → C is the one that makes six days in a row. Prove the run check sees it.
{ const bad = [...LINES_B_TO_C()]; let r = 0, mx = 0, prev = ''; for (const d of bad) { r = prev && addDays(prev, 1) === d ? r + 1 : 1; mx = Math.max(mx, r); prev = d }
  const ok = mx > 5; if (!ok) failures++; console.log(`${ok ? '✓' : '✗'} control: line B then line C gives ${mx} days in a row (must be over 5)`) }
function LINES_B_TO_C(): string[] {
  const B = ['S3', null, null, 'S3', 'S2', 'S1', 'S2'], C = ['S2', 'S3', null, null, 'S4', 'S3', 'S3']
  return [...B.map((s, d) => s ? addDays('2026-10-05', d) : null), ...C.map((s, d) => s ? addDays('2026-10-12', d) : null)].filter(Boolean) as string[] }

console.log(failures ? `\n${failures} check(s) came out wrong` : '\nevery check came out the way it must')
process.exit(failures ? 1 : 0)
