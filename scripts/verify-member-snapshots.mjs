// ═══════════════════════════════════════════════════════════════════════════
// THE TRAJECTORY KEYSTONE — member_health_snapshots + its weekly job.
//   node scripts/verify-member-snapshots.mjs        (BASE=... for production)
// ───────────────────────────────────────────────────────────────────────────
// What matters here is not "did a row get written". It is:
//   · one row per member per week, and a SECOND run does not duplicate it
//   · the RAW INPUTS are frozen, not just a score — so the score stays
//     recomputable when its formula is replaced
//   · spend counts CHARGES only; summing every card kind nets top-ups against
//     charges and yields +32.3m VND of nonsense
//   · the existing dashboard and its API are provably untouched
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const BASE = process.env.BASE || 'http://localhost:3001'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
const g = async p => (await (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json())

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

console.log('\n0 · the migrations')
const tbl = await fetch(`${U}/rest/v1/member_health_snapshots?select=id&limit=1`, { headers: H })
const HAVE = tbl.status === 200
t(HAVE, '0 · member_health_snapshots exists', HAVE ? 'yes' : 'NO — run db/member_health_snapshots.sql first')
const sc = await fetch(`${U}/rest/v1/members?select=source_channel&limit=1`, { headers: H })
t(sc.status === 200, '0b · members.source_channel exists',
  sc.status === 200 ? 'yes' : 'NO — run db/members_source_channel.sql BEFORE merging, or conversion 400s')
if (!HAVE) { console.log('\nFAIL  the table is missing; nothing else can be proved\n'); process.exit(1) }

console.log('\n1 · the write')
const run = () => fetch(`${BASE}/api/cron/member-snapshots`, {
  method: 'POST', headers: { 'x-cron-secret': env.CRON_SECRET || 'none' } })
const r1 = await run()
const j1 = await r1.json().catch(() => ({}))
t(r1.ok, '1 · the cron route writes', r1.ok ? `${j1.members} members, week ${j1.week}` : `${r1.status} ${JSON.stringify(j1).slice(0, 150)}`)
const members = await g('members?select=member_no')
const after1 = await g('member_health_snapshots?select=member_no,snapshot_week')
t(after1.length === members.length, '1b · one row per member', `${after1.length} rows / ${members.length} members`)

console.log('\n2 · IDEMPOTENT — a second run must not duplicate')
const before = after1.length
await run()
const after2 = await g('member_health_snapshots?select=id,member_no,snapshot_week')
t(after2.length === before, '2 · the count did not move', `${before} → ${after2.length}`)
const keys = after2.map(r => `${r.member_no}|${r.snapshot_week}`)
t(new Set(keys).size === keys.length, '2b · no duplicate (member, week) pair')

console.log('\n3 · the INPUTS are frozen, not just a score')
const row = (await g('member_health_snapshots?select=*&limit=1'))[0] || {}
for (const c of ['total_visits', 'days_since_last_visit', 'card_spend_trailing_90d', 'card_spend_cumulative',
                 'bookings_trailing_90d', 'excellence_count', 'grievance_count', 'paid_through', 'tenure_days']) {
  t(c in row, `3 · ${c} is stored`)
}
t('engagement_score' in row && 'engagement_confidence' in row && 'score_formula_version' in row,
  '3b · and the score carries its confidence and formula version',
  `${row.engagement_score} / ${row.engagement_confidence} / ${row.score_formula_version}`)

console.log('\n4 · spend is CHARGES only')
const ct = await g('card_transactions?select=member_number,amount_vnd,kind')
const naive = ct.reduce((s, x) => s + Number(x.amount_vnd || 0), 0)
const charges = Math.abs(ct.filter(x => x.kind === 'charge').reduce((s, x) => s + Number(x.amount_vnd || 0), 0))
const snapTotal = (await g('member_health_snapshots?select=card_spend_cumulative'))
  .reduce((s, x) => s + Number(x.card_spend_cumulative || 0), 0)
t(snapTotal === charges, '4 · cumulative spend equals the charges', `${snapTotal.toLocaleString()} vs charges ${charges.toLocaleString()}`)
t(snapTotal !== naive, '4b · and NOT the naive sum of every kind', `naive would be ${naive.toLocaleString()}`)

console.log('\n5 · additive — the existing dashboard is untouched')
const touched = execSync('git diff --name-only main...HEAD || true', { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
const forbidden = touched.filter(f => /^app\/admin\/page\.tsx$|^app\/api\/admin\/dashboard\//.test(f))
t(forbidden.length === 0, '5 · /admin/page.tsx and /api/admin/dashboard not in the diff',
  forbidden.length ? forbidden.join(', ') : `${touched.length} files changed, none of them`)
t(!touched.some(f => f.startsWith('app/admin/observatory')), '5b · observatory untouched')

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
