// ═══════════════════════════════════════════════════════════════════════════
// ROTA — the whole lot, bug-tested: the stored rota, and the rule checker.
//   npx tsx tests/rota/rota.test.mts
// Every rule that must catch something has a case it must FAIL next to the
// case it must pass. A check that has only ever said "pass" proves nothing.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { checkWeek, addDays, shiftSpan, paidHours, mondayOf, type RotaStaff, type ShiftType, type PlannedShift } from '@/lib/rota/policy'
import { rotaWeek, lineFor, ANCHOR_LINES, LINES } from '@/lib/rota/pattern'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const get = async (p: string) => { const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }); if (!r.ok) throw new Error(p + ' ' + await r.text()); return r.json() }

let pass = 0, fail = 0; const bugs: string[] = []
const t = (ok: boolean, label: string, detail = '') => { if (ok) pass++; else { fail++; bugs.push(label + (detail ? ' — ' + detail : '')) } console.log(`${ok ? '✓' : '✗'} ${label}${detail && !ok ? ' — ' + detail : ''}`) }
const section = (s: string) => console.log(`\n── ${s}`)

const team = await get('team_members?select=*')
const types: ShiftType[] = (await get('rota_shift_types?select=*')).map((x: any) => ({ name: x.name, hours: +x.hours, sortOrder: x.sort_order, weekdays: x.weekdays, startTime: x.start_time, endTime: x.end_time, breakMinutes: x.break_minutes }))
const T = Object.fromEntries(types.map(x => [x.name, x]))
const floorTeam = team.filter((m: any) => m.weekly_hours != null)
const staff: RotaStaff[] = floorTeam.map((m: any) => ({ id: m.id, name: m.display_name, isSupervisor: m.is_shift_supervisor, weeklyHours: m.weekly_hours, fixedDaysOff: m.fixed_days_off ?? [] }))
const ids = Object.fromEntries(floorTeam.map((m: any) => [m.display_name, m.id])) as Record<string, string>
const name = (id: string) => team.find((m: any) => m.id === id)?.display_name ?? `?${id.slice(0, 6)}`
const rows = await get('rota_shifts?select=*&shift_date=gte.2026-09-22&order=shift_date')

section('INPUTS')
t(floorTeam.length === 6, 'six people carry weekly hours', `${floorTeam.length}: ${floorTeam.map((m: any) => m.display_name)}`)
t(rows.length > 150, 'the rota from today has rows to test', `${rows.length}`)
t(['S1', 'S2', 'S3', 'S4'].every(n => T[n]), 'S1–S4 exist as shift types')

section('TEAM')
t(floorTeam.every((m: any) => +m.weekly_hours === 40), 'every floor person is on 40 weekly hours')
const sups = team.filter((m: any) => m.is_shift_supervisor).map((m: any) => m.display_name).sort()
t(JSON.stringify(sups) === JSON.stringify(['Bình', 'Mr Sĩ', 'Nhi'].sort()), 'supervisors are exactly Mr Sĩ, Nhi, Bình', sups.join(', '))
t(floorTeam.every((m: any) => m.active && m.on_rota), 'every floor person is active and on the rota')
t(team.filter((m: any) => m.display_name === 'New').length === 1, 'exactly one "New"')
t(!team.some((m: any) => /probe|__/.test(m.display_name)), 'no probe people left behind')
t(!('morning_weekday' in team[0]) && !('always_shift' in team[0]) && !('rota_partner' in team[0]), 'the retired columns are gone')

section('SHIFT TYPES')
for (const n of ['S1', 'S2', 'S3', 'S4']) { const x = T[n]; t(paidHours({ member: '', shiftDate: '2026-10-06', shiftName: n }, types) === 8 && x.hours === 8 && (x.breakMinutes ?? 0) === 0, `${n} is 8 paid hours, break inside and paid`) }
t(JSON.stringify(T.S4.weekdays) === '[2,3,4,5]', 'S4 runs Tuesday to Friday only', JSON.stringify(T.S4.weekdays))
t(shiftSpan({ member: '', shiftDate: '', shiftName: 'S3' }, types)!.end === 24.5, 'S3 ends at 00:30')
t(!T.Open && !T.Close && !T.Mid, 'Open, Close and Mid are no longer shift types')

section('STORED ROTA')
const floorRows = rows.filter((r: any) => floorTeam.some((m: any) => m.id === r.member))
const dup = new Map<string, number>(); for (const r of floorRows) { const k = r.member + r.shift_date; dup.set(k, (dup.get(k) ?? 0) + 1) }
const dups = [...dup.entries()].filter(([, n]) => n > 1)
t(dups.length === 0, 'nobody is rostered twice on one day', dups.map(([k]) => name(k.slice(0, 36)) + ' ' + k.slice(36)).join(', '))
const mis = floorRows.filter((r: any) => T[r.shift_name] && ['S1', 'S2', 'S3', 'S4'].includes(r.shift_name) && (r.start_time !== T[r.shift_name].startTime || r.end_time !== T[r.shift_name].endTime))
t(mis.length === 0, 'every S-shift carries its own shift\'s hours', mis.map((r: any) => `${r.shift_date} ${name(r.member)} ${r.shift_name} ${r.start_time}`).join(', '))
const untimed = rows.filter((r: any) => !r.start_time || !r.end_time)
t(untimed.length === 0, 'no shift from today is missing its times', `${untimed.length}`)
const s4bad = floorRows.filter((r: any) => r.shift_name === 'S4' && ![2, 3, 4, 5].includes(new Date(r.shift_date + 'T00:00:00Z').getUTCDay()))
t(s4bad.length === 0, 'no S4 outside Tuesday–Friday', s4bad.map((r: any) => r.shift_date).join(', '))
const stray = rows.filter((r: any) => r.shift_date > '2026-11-01' || (r.notes ?? '').includes('probe'))
t(stray.length === 0, 'no rows past 1 November and no probe rows', stray.map((r: any) => r.shift_date).join(', '))
const oldNames = floorRows.filter((r: any) => r.shift_date >= '2026-09-28' && !['S1', 'S2', 'S3', 'S4'].includes(r.shift_name))
t(oldNames.length === 0, 'from 28 September the floor is S1–S4 only', [...new Set(oldNames.map((r: any) => r.shift_name))].join(', '))
const inactive = rows.filter((r: any) => !team.find((m: any) => m.id === r.member)?.active)
t(inactive.length === 0, 'nobody inactive is rostered', inactive.map((r: any) => name(r.member)).join(', '))
const planned = rows.map((r: any) => ({ member: r.member, shiftDate: r.shift_date, shiftName: r.shift_name, startTime: r.start_time, endTime: r.end_time }))
for (let w = '2026-09-28'; w <= '2026-10-26'; w = addDays(w, 7)) {
  const v = checkWeek({ weekStart: w, staff, shiftTypes: types, shifts: planned })
  const floorV = v.filter(x => x.rule !== 'cleaning not covered')
  t(floorV.length === 0, `week of ${w}: floor rota — no breaches, no notes`, floorV.map(x => `${x.severity} ${x.rule} ${x.who ?? ''}`).join('; '))
  const expected = rotaWeek(ids, w).map(s => `${s.member}${s.shiftDate}${s.shiftName}`).sort()
  const stored = planned.filter((s: PlannedShift) => s.shiftDate >= w && s.shiftDate <= addDays(w, 6) && Object.values(ids).includes(s.member)).map((s: PlannedShift) => `${s.member}${s.shiftDate}${s.shiftName}`).sort()
  const diff = [...expected.filter(x => !stored.includes(x)), ...stored.filter(x => !expected.includes(x))]
  t(diff.length === 0 || w === '2026-09-28', `week of ${w} matches the rotation exactly`, `${diff.length} differences`)
}
const wk28 = [...rotaWeek(ids, '2026-09-28')].map(s => `${s.member}${s.shiftDate}${s.shiftName}`)
const st28 = planned.filter((s: PlannedShift) => s.shiftDate >= '2026-09-28' && s.shiftDate <= '2026-10-04' && Object.values(ids).includes(s.member)).map((s: PlannedShift) => `${s.member}${s.shiftDate}${s.shiftName}`)
const hand = st28.filter(x => !wk28.includes(x)).map(x => `${name(x.slice(0, 36))} ${x.slice(36, 46)} ${x.slice(46)}`)
console.log(`  (week of 28 Sep differs from the rotation by ${hand.length} hand edit(s): ${hand.join(', ') || 'none'})`)
let maxRun = 0, gaps: string[] = []
for (const m of Object.values(ids)) { const mine = planned.filter((s: PlannedShift) => s.member === m).sort((a: PlannedShift, b: PlannedShift) => a.shiftDate.localeCompare(b.shiftDate)); let run = 0, prev = ''
  for (const s of mine) { run = prev && addDays(prev, 1) === s.shiftDate ? run + 1 : 1; maxRun = Math.max(maxRun, run); prev = s.shiftDate }
  for (let i = 1; i < mine.length; i++) { const a = shiftSpan(mine[i - 1], types)!, b = shiftSpan(mine[i], types)!; const g = (Date.parse(mine[i].shiftDate) - Date.parse(mine[i - 1].shiftDate)) / 36e5 + b.start - a.end; if (g < 12) gaps.push(`${name(m)} ${mine[i].shiftDate} ${g}h`) } }
t(maxRun <= 5, 'nobody works more than five days in a row, across weeks', `${maxRun}`)
t(gaps.length === 0, 'twelve hours between every shift, across weeks', gaps.join(', '))

section('CLEANING — left as is by the owner, 2026-09-22 ("leave cleaners as is"): reported, not tested')
const clean = rows.filter((r: any) => r.shift_name.startsWith('Clean'))
const lastClean = clean.map((r: any) => r.shift_date).sort().at(-1)
const cleaners = team.filter((m: any) => (m.functions ?? []).includes('clean'))
console.log(`  · cleaning is rostered to ${lastClean}; the floor runs to 2026-11-01`)
for (const c of cleaners) console.log(`  · ${c.display_name}: ${clean.filter((r: any) => r.member === c.id && r.shift_date >= '2026-10-05' && r.shift_date <= '2026-10-11').length} cleaning shifts in the week of 5 Oct`)

section('ROTATION')
t(Object.keys(LINES).every(l => LINES[l as keyof typeof LINES].filter(Boolean).length === 5), 'every line is five shifts')
t(Array.from({ length: 6 }, (_, i) => addDays('2026-09-28', 7 * i)).slice(1).every((w, i, a) => Object.keys(ANCHOR_LINES).every(n => lineFor(n, w) !== lineFor(n, i ? a[i - 1] : '2026-09-28'))), 'everyone changes line every week')
t(lineFor('Mr Sĩ', '2026-10-19') === 'A' && lineFor('Mr Sĩ', '2026-09-21') === 'B', 'the rotation works forwards and backwards (3-week period)')
let threw = false; try { rotaWeek(ids, '2026-09-29') } catch { threw = true }
t(threw, 'a week that does not start on Monday is refused')

section('CHECKER — each rule catches what it must (and the pass case passes)')
const W = '2026-10-05', base = rotaWeek(ids, W)
const rules = (shifts: PlannedShift[], wk = W) => checkWeek({ weekStart: wk, staff, shiftTypes: types, shifts })
const has = (v: ReturnType<typeof rules>, rule: string) => v.some(x => x.rule === rule)
t(rules(base).length === 0, 'baseline week is clean')
const d = (i: number) => addDays(W, i)
// Every case is built from the week actually under test — who works which day
// is looked up, never assumed. The first version assumed week-1 lines on a
// week-2 date, changed nothing, and "caught" nothing: seven false failures.
const me = ids['Hiếu']
const mine = base.filter(s => s.member === me).sort((a, b) => a.shiftDate.localeCompare(b.shiftDate))
const myDays = new Set(mine.map(s => s.shiftDate))
const myRest = Array.from({ length: 7 }, (_, i) => d(i)).find(x => !myDays.has(x))!
const onMonday = base.find(s => s.shiftDate === d(0) && s.shiftName !== 'S3')!
const closeThenNext = (() => { for (const s of base.filter(x => x.shiftName === 'S3')) { const n = base.find(x => x.member === s.member && x.shiftDate === addDays(s.shiftDate, 1)); if (n) return n } return null })()!
const twoSupNight = Array.from({ length: 7 }, (_, i) => d(i)).find(x => base.filter(s => s.shiftDate === x && staff.find(p => p.id === s.member)!.isSupervisor).length >= 2)!
const secondSup = base.find(s => s.shiftDate === twoSupNight && staff.find(p => p.id === s.member)!.isSupervisor && s.shiftName !== 'S3')!
const changes = (a: PlannedShift[]) => JSON.stringify(a) !== JSON.stringify(base)
const cases: [string, PlannedShift[], string, RotaStaff[]?][] = [
  ['a 9-hour shift', base.map(s => s === mine[0] ? { ...s, startTime: '14:00', endTime: '23:00' } : s), 'shift over 8 hours'],
  ['a sixth shift', [...base, { member: me, shiftDate: myRest, shiftName: 'S2' }], 'over the weekly hours'],
  ['six days worked', [...base, { member: me, shiftDate: myRest, shiftName: 'S2' }], 'fewer than two rest days'],
  ['S4 on a Monday', base.map(s => s === onMonday ? { ...s, shiftName: 'S4' } : s), 'shift on a day it does not run'],
  ['a close ending at midnight', base.map(s => s.shiftName === 'S3' && s.shiftDate === d(0) ? { ...s, startTime: '16:00', endTime: '00:00' } : s), 'close-down not rostered'],
  ['no supervisor that night', base.filter(s => !(s.shiftDate === d(0) && staff.find(p => p.id === s.member)!.isSupervisor)), 'night without a supervisor'],
  ['the closer is not a supervisor', base.filter(s => !(s.shiftDate === d(0) && s.shiftName === 'S3')).map(s => s.shiftDate === d(0) && !staff.find(p => p.id === s.member)!.isSupervisor && s.shiftName === 'S1' ? { ...s, shiftName: 'S3' } : s), 'no supervisor closing'],
  ['nobody on a night', base.filter(s => s.shiftDate !== d(6)), 'night with nobody on'],
  ['Friday one short', base.filter(s => !(s.shiftDate === d(4) && s.member === ids['New'])), 'floor below plan'],
  ['under 12 hours between shifts', base.map(s => s === closeThenNext ? { ...s, startTime: '08:00', endTime: '16:00' } : s), 'under 12 hours between shifts'],
  ['a fixed day off worked', base, 'fixed day off', staff.map(p => p.id === me ? { ...p, fixedDaysOff: [new Date(mine[0].shiftDate + 'T00:00:00Z').getUTCDay()] } : p)],
]
for (const [label, shifts, rule, who] of cases) {
  const altered = changes(shifts) || !!who
  const v = checkWeek({ weekStart: W, staff: who ?? staff, shiftTypes: types, shifts })
  t(altered && v.some(x => x.rule === rule), `catches ${label} → "${rule}"`, altered ? (v.map(x => x.rule).join(', ') || 'nothing raised') : 'THE CASE CHANGED NOTHING — test is broken')
}
t(has(rules(base.map(s => s === secondSup ? { ...s, shiftName: 'S3' } : s)), 'two supervisors closing'), 'notes two supervisors closing')
t(has(rules(base.filter(s => s !== mine[0])), 'under the weekly hours'), 'notes a person short of their hours')
t(has(rules(base, addDays(W, 1)), 'week does not start on Monday'), 'notes a week that does not start on Monday')
t(!has(rules([...base, { member: ids['Bình'], shiftDate: d(1), shiftName: 'Office', startTime: '09:00', endTime: '17:00' }]), 'floor below plan') , 'an Office shift is not counted as floor cover')
t(paidHours({ member: '', shiftDate: '', shiftName: 'Office', startTime: '10:00', endTime: '16:00' }, types) === 5, 'Office 10:00–16:00 pays 5 hours (unpaid hour)', String(paidHours({ member: '', shiftDate: '', shiftName: 'Office', startTime: '10:00', endTime: '16:00' }, types)))
t(paidHours({ member: '', shiftDate: '', shiftName: 'Nope' }, types) === 0, 'an unknown shift with no times counts 0, not a crash')
t(has(rules([...base, { member: me, shiftDate: d(1), shiftName: 'S2', startTime: null, endTime: null }].map(s => s.shiftName === 'S2' && s.shiftDate === d(1) && s.member === me ? { ...s, shiftName: 'Mystery' } : s)), 'shift with no times'), 'notes a shift it cannot time')
t(mondayOf('2026-10-11') === '2026-10-05' && mondayOf('2026-10-05') === '2026-10-05', 'mondayOf: a Sunday belongs to the week before')

console.log(`\n${pass} passed, ${fail} failed`)
if (bugs.length) { console.log('\nBUGS:'); bugs.forEach(b => console.log('  · ' + b)) }
process.exit(fail ? 1 : 0)
