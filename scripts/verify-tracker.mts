import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { buildTracker } from '../lib/reports/tracker'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let fails = 0
const ok = (c: boolean, l: string, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) fails++ }

// A month with no real data in it, so nothing below is confused with the club's
// own figures — and every seeded row carries a ZZ key.
const M = '2026-03'
const RECEIPTS = ['ZZ-R1', 'ZZ-R2', 'ZZ-R3', 'ZZ-R4', 'ZZ-R5']
const cleanup = async () => {
  await sb.from('membership_payments').delete().in('receipt_no', RECEIPTS)
  await sb.from('card_transactions').delete().like('member_number', 'ZZ-%')
  await sb.from('visits').delete().like('member_no', 'ZZ-%')
  await sb.from('whisky_weekly_sales').delete().gte('week_start', `${M}-01`).lte('week_start', `${M}-31`)
  await sb.from('members').delete().like('member_no', 'ZZ-TRK%')
}

try {
  await cleanup()
  const { data: cfg0 } = await sb.from('finance_settings').select('*').eq('id', true).single()

  // ── seed: a DISCOUNTED Legacy joiner and a full-price one, same week ──────
  const seedPay = await sb.from('membership_payments').insert([
    { receipt_no: 'ZZ-R1', member_no: 'ZZ-TRK1', member_name_snap: 'ZZ One', tier_snap: 'Legacy',
      amount_vnd: 104_000_000, payment_method: 'bank_transfer', payment_date: `${M}-03`, fee_kind: 'membership_fee', status: 'active', integrity_hash: 'zz-verification-row' },
    { receipt_no: 'ZZ-R2', member_no: 'ZZ-TRK2', member_name_snap: 'ZZ Two', tier_snap: 'Legacy',
      amount_vnd: 130_000_000, payment_method: 'bank_transfer', payment_date: `${M}-03`, fee_kind: 'membership_fee', status: 'active', integrity_hash: 'zz-verification-row' },
    // a different week, same COUNT, different tier → must look different
    { receipt_no: 'ZZ-R3', member_no: 'ZZ-TRK3', member_name_snap: 'ZZ Three', tier_snap: 'Pioneer',
      amount_vnd: 78_000_000, payment_method: 'bank_transfer', payment_date: `${M}-10`, fee_kind: 'membership_fee', status: 'active', integrity_hash: 'zz-verification-row' },
    { receipt_no: 'ZZ-R4', member_no: 'ZZ-TRK4', member_name_snap: 'ZZ Four', tier_snap: 'Pioneer',
      amount_vnd: 78_000_000, payment_method: 'bank_transfer', payment_date: `${M}-10`, fee_kind: 'membership_fee', status: 'active', integrity_hash: 'zz-verification-row' },
  ])
  // A seed that fails silently makes every assertion below meaningless — they
  // would all "pass" against an empty month.
  if (seedPay.error) throw new Error('seed membership_payments: ' + seedPay.error.message)
  const seedCard = await sb.from('card_transactions').insert([
    { member_number: 'ZZ-C1', amount_vnd: 20_000_000, kind: 'topup', balance_after_vnd: 20_000_000, created_at: `${M}-04T10:00:00Z` },
    { member_number: 'ZZ-C1', amount_vnd: -9_000_000, kind: 'charge', balance_after_vnd: 11_000_000, created_at: `${M}-05T10:00:00Z` },
  ])
  if (seedCard.error) throw new Error('seed card_transactions: ' + seedCard.error.message)
  const seedWk = await sb.from('whisky_weekly_sales').insert({ week_start: `${M}-02`, amount_vnd: 15_000_000 })
  if (seedWk.error) throw new Error('seed whisky_weekly_sales: ' + seedWk.error.message)

  const t = await buildTracker(sb, `${M}-28`)
  const wk = (d: string) => t.weeks.find(w => w.week_start <= d && d <= w.week_end)!

  console.log('── 1 · a discount shows as cash collected, not list price ──')
  const w1 = wk(`${M}-03`)
  const legacyAmounts = w1.joins.filter(j => j.tier === 'Legacy').map(j => j.amount_vnd).sort()
  ok(legacyAmounts.includes(104_000_000), 'the discounted joiner is counted at 104m, not 130m', legacyAmounts.map(a => a / 1e6 + 'm').join(' + '))
  ok(w1.dues_vnd === 234_000_000, 'the week totals what was actually collected', (w1.dues_vnd / 1e6) + 'm')

  console.log('\n── 2 · two Legacy and two Pioneer look different, not just smaller ──')
  const w2 = wk(`${M}-10`)
  ok(w1.joins.length === w2.joins.length, 'same number of joiners in both weeks', `${w1.joins.length} vs ${w2.joins.length}`)
  ok(w1.joins[0].tier !== w2.joins[0].tier, 'but the TIER is visible on the row, not only the total')
  ok(w1.cash_in_usd !== w2.cash_in_usd, 'and the cash differs', `${w1.cash_in_usd} vs ${w2.cash_in_usd}`)

  console.log('\n── 3 · a week not entered is MISSING, never zero ──')
  ok(w1.whisky_vnd === 15_000_000, 'the entered week carries its figure')
  ok(w2.whisky_vnd === null, 'the un-entered week is NULL, not 0', String(w2.whisky_vnd))
  ok(t.whisky.weeks_missing.length >= 2, 'and the tracker names the missing weeks', `${t.whisky.weeks_missing.length} missing`)

  console.log('\n── 4 · costs are smoothed, so quarterly rent cannot spike one week ──')
  const perDay = t.weeks.map(w => w.cost_usd / w.days_in_month)
  const spread = Math.max(...perDay) - Math.min(...perDay)
  ok(spread < 1, 'every week costs the same PER DAY (a partial week costs less, not zero)', `spread ${spread.toFixed(3)}`)
  ok(t.weeks.every(w => w.cost_usd > 0), 'and no week is costless')

  console.log('\n── 5 · target and breakeven are separate numbers ──')
  ok(t.target_usd !== t.cost_base_usd, 'they differ', `target ${t.target_usd} · breakeven ${t.cost_base_usd}`)
  await sb.from('finance_settings').update({ monthly_cost_base_usd: 31_000 }).eq('id', true)
  const t2 = await buildTracker(sb, `${M}-28`)
  ok(t2.cost_base_usd === 31_000 && t2.projected_close.cost_usd === 31_000, 'breakeven MOVES when the cost base is updated', `${t.cost_base_usd} → ${t2.cost_base_usd}`)
  ok(t2.target_usd === t.target_usd, 'and the target does not move with it')
  await sb.from('finance_settings').update({ monthly_cost_base_usd: cfg0?.monthly_cost_base_usd ?? 26400 }).eq('id', true)

  console.log('\n── 6 · the month closes to the sum of its weeks ──')
  const sumCash = t.weeks.reduce((s, w) => s + w.cash_in_usd, 0)
  ok(sumCash === t.projected_close.cash_usd, 'cash: sum of weeks === monthly close', `${sumCash} vs ${t.projected_close.cash_usd}`)
  const sumCost = t.weeks.reduce((s, w) => s + w.cost_usd, 0)
  ok(Math.abs(sumCost - t.cost_base_usd) <= t.weeks.length, 'costs: weeks sum to the cost base (within rounding)', `${sumCost} vs ${t.cost_base_usd}`)
  const sumTarget = t.weeks.reduce((s, w) => s + w.target_usd, 0)
  ok(Math.abs(sumTarget - t.target_usd) <= t.weeks.length, 'targets: weeks sum to the monthly target', `${sumTarget} vs ${t.target_usd}`)

  console.log('\n── 7 · credit consumed is USAGE and never cash-in ──')
  ok(w1.credit_consumed_vnd === 9_000_000, 'the charge is captured as credit consumed', (w1.credit_consumed_vnd / 1e6) + 'm')
  ok(w1.cash_in_vnd === w1.dues_vnd + w1.topups_vnd + (w1.whisky_vnd ?? 0), 'cash-in is dues + top-ups + whisky and NOTHING else')
  ok(!String(w1.cash_in_vnd).includes('NaN') && w1.cash_in_vnd === 269_000_000, 'so the charge did not leak into cash-in', (w1.cash_in_vnd / 1e6) + 'm')
  ok(t.usage.credit_consumed_vnd === 9_000_000, 'and it appears under usage')

  console.log('\n── 8 · distinct members is separate from total visits ──')
  await sb.from('members').insert([
    { member_no: 'ZZ-TRK9', full_name: 'ZZ Visitor', tier: 'Legacy', status: 'Active' },
  ])
  await sb.from('visits').insert([
    { member_no: 'ZZ-TRK9', visit_date: `${M}-04`, duration_min: 90 },
    { member_no: 'ZZ-TRK9', visit_date: `${M}-05`, duration_min: 60 },
    { member_no: 'ZZ-TRK9', visit_date: `${M}-06` },
  ])
  const t3 = await buildTracker(sb, `${M}-28`)
  ok(t3.usage.visits === 3 && t3.usage.distinct_members === 1,
     'three visits from one member reads as 3 visits, 1 member', `${t3.usage.visits} / ${t3.usage.distinct_members}`)
  ok(t3.usage.duration_coverage_pct === 67, 'duration coverage is reported honestly', `${t3.usage.duration_coverage_pct}%`)

  console.log('\n── 9 · dormancy against the visit data ──')
  const ageOk = t3.dormancy.active_members > 0 && t3.dormancy.no_visit_60 <= t3.dormancy.no_visit_30
  ok(ageOk, '60-day dormancy is a subset of 30-day', `${t3.dormancy.no_visit_30} / ${t3.dormancy.no_visit_60} of ${t3.dormancy.active_members}`)
  ok(t3.dormancy.never_visited <= t3.dormancy.no_visit_60, 'never-visited is a subset of 60-day', String(t3.dormancy.never_visited))
} catch (e) {
  ok(false, 'threw', '\n' + (e as Error).message.split('\n').slice(0, 6).join('\n'))
} finally {
  await cleanup(); console.log('\n  seeded rows removed')
}
console.log(fails === 0 ? 'PASS\n' : `FAIL — ${fails}\n`)
process.exit(fails ? 1 : 0)
