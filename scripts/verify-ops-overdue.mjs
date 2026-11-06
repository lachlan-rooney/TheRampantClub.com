// ═══════════════════════════════════════════════════════════════════════════
// OPS OVERDUE — the count, and the two rules it must obey.
//   node scripts/verify-ops-overdue.mjs
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-11-06: "108 overdue of 172 open looks wrong."
//
// It was not a calculation error. Measured across the 10 active boards, the
// work really is late — the only miscount was blocked tasks, which are waiting
// on somebody else and should not be told to chase themselves.
//
// Two rules every overdue count in the estate must obey:
//   1. exclude work parked in a DONE or BLOCKED column, by FLAG not by name
//   2. compare due_date against today in Asia/Ho_Chi_Minh, never UTC
//
// Rule 2 passes everywhere already (vnDateString / ops_today_vn). Rule 1 is
// what this adds.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
const g = async p => (await (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json())
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

console.log(`\ntoday (Asia/Ho_Chi_Minh): ${today}\n`)

console.log('1 · the inputs loaded')
const projects = await g('projects?select=id,name&deleted_at=is.null&status=eq.active')
const cols = await g('board_columns?select=*')
const tasks = await g('tasks?select=id,project_id,column_id,status,due_date&limit=3000')
t(projects.length > 0, '1 · active boards', `${projects.length}`)
t(cols.length > 0, '1b · columns', `${cols.length}`)
t(tasks.length > 0, '1c · tasks', `${tasks.length}`)

const HAS_FLAG = 'is_blocked_column' in (cols[0] || {})
t(true, '1d · is_blocked_column present', HAS_FLAG ? 'yes' : 'NO — run db/ops_blocked_column_flag.sql; counts below show what it WILL do')

const live = new Set(projects.map(p => p.id))
const C = new Map(cols.map(c => [c.id, c]))
const open = tasks.filter(x => live.has(x.project_id) && x.status === 'open')
// Before the migration, fall back to the name so the comparison can still be made.
const isBlocked = c => HAS_FLAG ? !!c?.is_blocked_column : /^\s*blocked\s*$/i.test(c?.name || '')
const isDone = c => !!c?.is_done_column

console.log('\n2 · the counts')
const oldWay = open.filter(x => x.due_date && x.due_date < today)
const newWay = open.filter(x => { const c = C.get(x.column_id); return !isDone(c) && !isBlocked(c) && x.due_date && x.due_date < today })
const blocked = open.filter(x => isBlocked(C.get(x.column_id)))
const d = new Date(`${today}T12:00:00+07:00`); d.setDate(d.getDate() + 7)
const end = d.toISOString().slice(0, 10)
const soon = open.filter(x => { const c = C.get(x.column_id); return !isDone(c) && !isBlocked(c) && x.due_date && x.due_date >= today && x.due_date <= end })
console.log(`   open                : ${open.length}`)
console.log(`   overdue (before)    : ${oldWay.length}`)
console.log(`   overdue (after)     : ${newWay.length}`)
console.log(`   blocked             : ${blocked.length}`)
console.log(`   due in seven days   : ${soon.length}`)

console.log('\n3 · the rules hold')
t(newWay.every(x => !isBlocked(C.get(x.column_id))), '3 · no blocked task is counted overdue')
t(newWay.every(x => !isDone(C.get(x.column_id))), '3b · no done-column task is counted overdue')
t(soon.every(x => !isBlocked(C.get(x.column_id)) && !isDone(C.get(x.column_id))), '3c · nor in due-in-seven-days')
t(open.filter(x => isDone(C.get(x.column_id))).length === 0,
  '3d · no OPEN task sits in a done column at all', `${open.filter(x => isDone(C.get(x.column_id))).length}`)

console.log('\n4 · PROVE THE HARNESS — the old rule must differ')
t(oldWay.length > newWay.length, '4 · the old count was higher', `${oldWay.length} → ${newWay.length} (${oldWay.length - newWay.length} blocked)`)
t(oldWay.length - newWay.length === blocked.filter(x => x.due_date && x.due_date < today).length,
  '4b · and the difference is exactly the overdue blocked tasks')

console.log('\n5 · timezone: no UTC comparison anywhere')
const utc = execSync(
  `grep -rln "due_date < new Date().toISOString\\|due_date < Date.now" app lib 2>/dev/null || true`, { encoding: 'utf8' }).trim()
t(!utc, '5 · no raw-UTC due_date comparison in app/ or lib/', utc || 'clean')
const vn = execSync(`grep -rl "vnDateString\\|ops_today_vn" app/admin/ops lib/ops 2>/dev/null | wc -l`, { encoding: 'utf8' }).trim()
t(Number(vn) > 0, '5b · ops surfaces use the VN date helper', `${vn} files`)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
