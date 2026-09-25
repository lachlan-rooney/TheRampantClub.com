// ═══════════════════════════════════════════════════════════════════════════
// THE WEEKLY REPORT'S FIGURES — the four the owner caught, 2026-09-25.
//   npx tsx tests/reports/report-figures.test.mts      (no dev server needed)
// ───────────────────────────────────────────────────────────────────────────
// The owner read the 14–20 Sept report and asked "is this pulling everything
// properly?". Most of it was; four things were not, and each is pinned here
// against the LIVE database rather than a fixture, because every one of them
// was a question about what the real rows say.
//
//   1. "0 ₫ fees · week" sat on the same page as "payment_recorded ×3". Three
//      payments worth 388,375,000₫ were typed in that week; all three carried
//      an earlier payment_date, and two were dated in August, after August's
//      reports had gone. They appeared in no report ever.
//   2. "0 pipeline moves" sat beside "8 new leads entered the pipeline".
//   3. The funnel showed 205 of 213 prospects; 8 were in stages the funnel
//      does not have. And rendered as bars, the tier chart ran into the
//      funnel, so "Legacy 1" read like a pipeline stage.
//   4. "0 agreements signed" counted the INVITATION's created_at, so a
//      signature this week on an invitation issued in April counted in April.
//
// IT READS ONLY. No report is created, saved, approved or sent — nothing in
// this file touches the send path, which stays guarded until the owner says
// go-live.
//
// ⚠ IT ASSERTS AGAINST REAL WEEKS. The April numbers are the only two signed
// agreements on file and the September ones are the payments as entered; if
// either is edited, the expectations here are what should be updated.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { gatherWeek } from '../../lib/reports/gather'
import { renderReportBody } from '../../lib/reports/render'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let pass = 0, fail = 0
const t = (ok: boolean, m: string, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

const week = async (start: string, end: string) => {
  const { auto } = await gatherWeek(sb as never, start, end, { includeFinancials: false })
  const row = {
    period_start: start, period_end: end, auto_data: auto,
    narrative: {}, narrative_extras: {}, include_financials: false, financials: null,
  } as never
  return { auto, text: renderReportBody(row, 'web').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }
}

// ── 1. MONEY ENTERED THIS WEEK FOR AN EARLIER PERIOD ──────────────────────
const sep = await week('2026-09-14', '2026-09-20')
t(sep.auto.money?.week.backdated?.count === 3 && sep.auto.money?.week.backdated?.total === 388_375_000,
  'the three payments entered that week are counted', JSON.stringify(sep.auto.money?.week.backdated))
t(sep.auto.money?.week.membership_total === 0,
  'and the week\'s revenue is untouched — they belong to the period they were paid for',
  String(sep.auto.money?.week.membership_total))
t(/payments recorded this week, taken earlier/.test(sep.text), 'the report says so in words')
// NAMED BY THE MONTH THEY BELONG TO (owner, 2026-09-25: "revenue from August
// should have been in august report"). Two of the three were taken in August:
// 100,000,000 + 158,000,000 = 258,000,000, and August's report had gone out.
t(/258\.000\.000|258,000,000/.test(sep.text) && /August 2026/.test(sep.text),
  'and names the month it belongs to, with that month’s total',
  sep.text.match(/\d+ payments recorded[^.]*\./)?.[0] ?? 'absent')
t(/report went out without them/.test(sep.text), 'and says that month was reported without them')

const quiet = await week('2026-09-21', '2026-09-27')
t(quiet.auto.money?.week.backdated?.count === 0 && !/recorded this week for earlier periods/.test(quiet.text),
  'a week with none of them says nothing at all')

// ── 2. WHAT THE PIPELINE TILE COUNTS ──────────────────────────────────────
t(/moved a stage/.test(sep.text) && !/pipeline moves/.test(sep.text),
  'the tile says "moved a stage", not "pipeline moves"', sep.text.match(/\d+ moved a stage/)?.[0] ?? '')
t(sep.auto.pipeline.new_leads === 8 && (sep.auto.pipeline.movements.stage_changed ?? 0) === 0,
  'that week really did take 8 leads and move none of them',
  `${sep.auto.pipeline.new_leads} leads, ${sep.auto.pipeline.movements.stage_changed ?? 0} moves`)

// ── 3. EVERY PROSPECT IS SOMEWHERE ────────────────────────────────────────
const off = sep.auto.pipeline.off_funnel ?? []
t(off.length === 3 && off.reduce((s, o) => s + o.count, 0) === 8,
  'the prospects on no funnel step are counted', JSON.stringify(off))
t(/Also on file, off the funnel:/.test(sep.text), 'and printed beside the funnel')
t(/Who joined, by tier/.test(sep.text) && /The pipeline/.test(sep.text),
  'the tier chart and the funnel each carry a heading, so a tier cannot read as a stage')

// ── 4. AN AGREEMENT COUNTS WHEN IT IS SIGNED ──────────────────────────────
// Both invitations on file were created on 6 April; the one signature is
// stamped 11 April. Counting created_at put 2 in the week of the 6th and
// nothing in the week of the signature. This is the proof the source changed.
const apr = await week('2026-04-06', '2026-04-12')
t(apr.auto.pipeline.signed === 1, 'the week of the signature counts it', String(apr.auto.pipeline.signed))
const before = await week('2026-03-30', '2026-04-05')
t(before.auto.pipeline.signed === 0, 'the week before it counts nothing', String(before.auto.pipeline.signed))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
