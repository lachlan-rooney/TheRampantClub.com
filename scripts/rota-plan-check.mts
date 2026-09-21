// Does the new policy produce a week people can legally work?
// Real roster, real contracted hours, no database writes.
import { planWeek, checkWeek, DAY_SHIFT } from '@/lib/rota/policy'
import { readFileSync } from 'node:fs'

const env: Record<string,string> = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL, K=env.SUPABASE_SERVICE_ROLE_KEY
const get = async (p:string) => (await fetch(`${U}/rest/v1/${p}`,{headers:{apikey:K,Authorization:`Bearer ${K}`}})).json()

const team = await get('team_members?select=id,display_name,is_shift_supervisor,weekly_hours,morning_weekday,fixed_days_off,always_shift,rota_partner,on_rota&on_rota=is.true')
const types = await get('rota_shift_types?select=name,hours,sort_order,weekdays&order=sort_order')

const staff = team
  .filter((t:any) => t.weekly_hours)        // the five on the floor
  .map((t:any) => ({
    id: t.id, name: t.display_name, isSupervisor: t.is_shift_supervisor,
    weeklyHours: t.weekly_hours, morningWeekday: t.morning_weekday,
    fixedDaysOff: t.fixed_days_off ?? [], alwaysShift: t.always_shift, pairedWith: t.rota_partner,
  }))
const shiftTypes = types.map((t:any) => ({ name: t.name, hours: Number(t.hours), sortOrder: t.sort_order, weekdays: t.weekdays }))
const HOURS = Object.fromEntries(shiftTypes.map((t:any) => [t.name, t.hours]))

console.log('DAY_SHIFT =', DAY_SHIFT)
console.log('staff:', staff.map((s:any)=>s.name).join(', '), '\n')

const { shifts, violations } = planWeek({ weekStart: '2026-10-11', staff, shiftTypes })

const per: Record<string,{n:number;h:number}> = {}
for (const s of shifts) { const n = staff.find((p:any)=>p.id===s.member).name
  ;(per[n] ??= {n:0,h:0}); per[n].n++; per[n].h += HOURS[s.shiftName] ?? 0 }
console.log('HOURS THE PLANNER NOW PRODUCES')
for (const [n,v] of Object.entries(per).sort()) {
  const c = staff.find((p:any)=>p.name===n).weeklyHours
  console.log('  ', n.padEnd(10), String(v.n).padStart(2)+' shifts', String(v.h).padStart(3)+'h', `contract ${c}h  ${v.h-c>=0?'+':''}${v.h-c}`)
}
const byDay: Record<string,string[]> = {}
for (const s of shifts) (byDay[s.shiftDate] ??= []).push(s.shiftName)
console.log('\nPER DAY (floor)')
for (const [d,l] of Object.entries(byDay).sort())
  console.log('  ', d, new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'}),
              l.filter(x=>x==='Open').length+' Open', l.filter(x=>x==='Close').length+' Close')
console.log('\nVIOLATIONS')
for (const v of violations) console.log('  ', v.severity.toUpperCase(), '·', v.rule, '·', v.detail)
if (!violations.length) console.log('   none')
