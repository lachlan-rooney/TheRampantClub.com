#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════════════════
// lib/mis/live-pst.ts MUST EQUAL preference_scores. This proves it, or fails.
//
//   ./node_modules/.bin/tsx scripts/verify-live-pst-fidelity.mts
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
// PS(t) was reimplemented FOUR times outside SQL. Three of those are gone:
// the profile preview and the intake preview now call mis_preview_ps(), and
// the observatory snapshot route reads the view's own revalidation flag.
//
// live-pst.ts is the one that stayed, and it stayed for a real reason: the
// Observatory draws a 365-point decay curve and re-renders it on a one-second
// timer. That cannot be a database round trip per frame, so the arithmetic has
// to exist in the browser. It was measured against all 159 live rows on
// 2026-10-08 and found exact — 0 disagreements, worst error 4.4e-16, which is
// double-precision epsilon and not drift.
//
// But "faithful today" is the same thing the two deleted previews once were.
// Both of them carried a comment saying they matched the view, and both had
// stopped matching it by the time anybody looked. live-pst.ts carries an
// "INTEGRITY RULE" comment saying the same thing. A comment cannot hold a
// formula in step across two languages; a failing check can.
//
// So this runs the REAL module against the REAL view and demands agreement on
// ps_t, on integer days_since, and on the revalidation flag. If someone edits
// a coefficient in SQL and not here, or here and not in SQL, this is what says
// so.
//
// ⚠ It needs live data. With zero rows it proves nothing, and it says so and
//   fails rather than reporting a hollow pass.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { computePSt, reinforcement, engagement } from '../lib/mis/live-pst'

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('FAIL  .env.local has no Supabase url or service key'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

let pass = 0, fail = 0
const ok = (n: string, c: boolean, d = '') => {
  c ? (pass++, console.log(`  ✓ ${n}${d ? '  ' + d : ''}`)) : (fail++, console.log(`  ✗ ${n}${d ? '  ' + d : ''}`))
}

interface Row {
  preference_id: string; member_no: string; preference_name: string
  s0: number; confidence: number; lambda: number; frequency: number
  validation_count: number; last_validated: string; days_since: number
  r_reinforce: number; m_engage: number; ps_t: number; needs_revalidation: string
}

const rows: Row[] = await (await fetch(
  `${URL_}/rest/v1/preference_scores?select=preference_id,member_no,preference_name,s0,confidence,lambda,frequency,validation_count,last_validated,days_since,r_reinforce,m_engage,ps_t,needs_revalidation&limit=5000`,
  { headers: H })).json()
const stats: { member_no: string; avg_visits_per_month: number | null }[] = await (await fetch(
  `${URL_}/rest/v1/member_stats?select=member_no,avg_visits_per_month`, { headers: H })).json()
const avg = new Map(stats.map(s => [s.member_no, s.avg_visits_per_month]))

console.log('\n1 · the inputs actually loaded')
ok('the view returned rows', rows.length > 0, `${rows.length} preferences`)
ok('member_stats returned rows', stats.length > 0, `${stats.length} members`)
if (rows.length === 0 || stats.length === 0) {
  console.log('\nFAIL  nothing to compare — this check proves nothing on empty inputs\n')
  process.exit(1)
}
// The comparison is only meaningful if M actually varies. If every M were 1.0,
// a module that hardcoded M would pass this and the check would be worthless.
const mValues = [...new Set(rows.map(r => String(r.m_engage)))]
ok('M varies in the data, so M is genuinely under test', mValues.length > 1 || mValues[0] !== '1.0',
   `M = ${mValues.slice(0, 6).join(', ')}`)
const decaying = rows.filter(r => Number(r.lambda) > 0 && Number(r.days_since) > 0).length
ok('rows exist with lambda>0 and t>0, so decay is under test', decaying > 0, `${decaying} of ${rows.length}`)

console.log('\n2 · live-pst.ts vs the view, row by row')
let worstPs = 0, dPs = 0, dDays = 0, dFlag = 0, dR = 0, dM = 0
const worst: [string, string, number, number, number][] = []
for (const r of rows) {
  const b = computePSt({
    s0: Number(r.s0), confidence: Number(r.confidence), lambda: Number(r.lambda),
    frequency: Number(r.frequency), validationCount: Number(r.validation_count),
    lastValidatedISO: r.last_validated,
  }, { avgVisitsPerMonth: avg.get(r.member_no) })

  const e = Math.abs(b.pst - Number(r.ps_t))
  if (e > worstPs) worstPs = e
  // 1e-9 is the tolerance for float-vs-numeric, not for a formula difference.
  // The deleted previews were out by up to 3.5, so this gap is unmissable.
  if (e > 1e-9) { dPs++; worst.push([r.member_no, r.preference_name, Number(r.ps_t), b.pst, e]) }
  if (b.daysSince !== Number(r.days_since)) dDays++
  if (b.needsRevalidation !== r.needs_revalidation.includes('REVALIDATE')) dFlag++
  if (Math.abs(reinforcement(Number(r.validation_count)) - Number(r.r_reinforce)) > 1e-9) dR++
  if (Math.abs(engagement(avg.get(r.member_no)) - Number(r.m_engage)) > 1e-9) dM++
}
ok('every ps_t agrees with the view', dPs === 0,
   dPs ? `${dPs}/${rows.length} disagree, e.g. ${worst.sort((a, b) => b[4] - a[4]).slice(0, 3).map(w => `${w[0]} view ${w[2].toFixed(4)} vs module ${w[3].toFixed(4)}`).join(' | ')}`
       : `${rows.length}/${rows.length}, worst error ${worstPs.toExponential(2)} (float epsilon)`)
ok('every integer days_since agrees', dDays === 0, `${dDays} mismatches`)
ok('every revalidation verdict agrees', dFlag === 0, `${dFlag} mismatches`)
ok('R agrees term-by-term', dR === 0, `${dR} mismatches`)
ok('M agrees term-by-term', dM === 0, `${dM} mismatches`)

console.log('\n3 · PROVE THE HARNESS — the bug it is here to catch must fail it')
// Exactly the mistake the three deleted call sites made: pin M to 1.0.
const brokenM = (_: number | null | undefined) => 1.0
let brokenDisagreements = 0
for (const r of rows) {
  const R = reinforcement(Number(r.validation_count))
  const M = brokenM(avg.get(r.member_no))
  const pst = Math.min(5, Number(r.s0) * Number(r.confidence)
    * Math.exp(-Number(r.lambda) * Number(r.days_since)) * Number(r.frequency) * R * M)
  if (Math.abs(pst - Number(r.ps_t)) > 1e-9) brokenDisagreements++
}
ok('a module with M hardcoded to 1.0 FAILS this check', brokenDisagreements > 0,
   `${brokenDisagreements}/${rows.length} rows would disagree`)
// And dropping the decay term, which is what the profile preview did.
let noDecay = 0
for (const r of rows) {
  const pst = Math.min(5, Number(r.s0) * Number(r.confidence) * Number(r.frequency)
    * reinforcement(Number(r.validation_count)) * Number(r.m_engage))
  if (Math.abs(pst - Number(r.ps_t)) > 1e-9) noDecay++
}
ok('a module with no decay term FAILS this check', noDecay > 0, `${noDecay}/${rows.length} rows would disagree`)

console.log('\n4 · live-pst.ts is the ONLY place left with the arithmetic')
const { execSync } = await import('node:child_process')
const hits = execSync(
  `grep -rln "0\\.075 \\*\\|1 + 0\\.075\\|1\\.0 + 0\\.25 \\*" app/ lib/ components/ 2>/dev/null || true`,
  { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
// grep -r over "lib/" emits "lib//mis/live-pst.ts". Normalise before
// matching, or the one expected file reads as an unexpected one.
const norm = (f: string) => f.replace(/\/{2,}/g, '/').replace(/^\.\//, '')
const unexpected = hits.map(norm).filter(f => f !== 'lib/mis/live-pst.ts')
ok('no other file reimplements R or M', unexpected.length === 0,
   unexpected.length ? unexpected.join(', ') : 'only lib/mis/live-pst.ts, by design')

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
