import type { SupabaseClient } from '@supabase/supabase-js'

// Monthly financial roll-up for the report. Revenue only (there is no expense
// table — cost-cutting is narrative). Reuses the same membership-summing logic
// as app/api/admin/membership/summary. Frozen into weekly_reports.financials.

export interface Financials {
  month: string                 // 'YYYY-MM'
  month_label: string
  membership: { total: number; count: number; by_method: Record<string, number> }
  card: { topups: number; charges: number; net: number }
  gifting: { total: number; by_occasion: Record<string, number> }
  total_revenue: number         // membership + card topups + (gifting is a cost, shown separately)
  mom: { month: string; label: string; membership: number; card_topups: number; gifting: number }[]
  delta_pct: number | null      // total revenue vs prior month
}

function monthKey(dateISO: string): string { return dateISO.slice(0, 7) }
function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) // day 0 of next month = last day
  return { start, end }
}
function shiftMonth(ym: string, back: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 - back, 1))
  return d.toISOString().slice(0, 7)
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

async function membershipTotal(sb: SupabaseClient, ym: string): Promise<{ total: number; count: number; by_method: Record<string, number> }> {
  const { start, end } = monthRange(ym)
  const { data } = await sb.from('membership_payments')
    .select('amount_vnd, payment_method, status').eq('status', 'active').gt('amount_vnd', 0)
    .gte('payment_date', start).lte('payment_date', end)
  let total = 0; const by_method: Record<string, number> = {}
  for (const p of data || []) { const a = Number(p.amount_vnd) || 0; total += a; by_method[p.payment_method] = (by_method[p.payment_method] || 0) + a }
  return { total, count: (data || []).length, by_method }
}

async function cardTotals(sb: SupabaseClient, ym: string): Promise<{ topups: number; charges: number; net: number }> {
  const { start, end } = monthRange(ym)
  const { data } = await sb.from('card_transactions').select('amount_vnd, kind').gte('created_at', start).lte('created_at', end + 'T23:59:59')
  let topups = 0, charges = 0
  for (const t of data || []) { const a = Number(t.amount_vnd) || 0; if (t.kind === 'topup' || a > 0) topups += Math.abs(a); else if (t.kind === 'charge' || a < 0) charges += Math.abs(a) }
  return { topups, charges, net: topups - charges }
}

async function giftingTotal(sb: SupabaseClient, ym: string): Promise<{ total: number; by_occasion: Record<string, number> }> {
  const { start, end } = monthRange(ym)
  const { data } = await sb.from('gifts').select('cost_vnd, occasion').gte('gift_date', start).lte('gift_date', end)
  let total = 0; const by_occasion: Record<string, number> = {}
  for (const g of data || []) { const a = Number(g.cost_vnd) || 0; total += a; by_occasion[g.occasion] = (by_occasion[g.occasion] || 0) + a }
  return { total, by_occasion }
}

export async function summariseFinancials(sb: SupabaseClient, asOfDate: string): Promise<Financials> {
  const month = monthKey(asOfDate)
  const [membership, card, gifting] = await Promise.all([membershipTotal(sb, month), cardTotals(sb, month), giftingTotal(sb, month)])

  // MoM: last 6 months oldest→newest
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, 5 - i))
  const mom = await Promise.all(months.map(async ym => {
    const [m, c, g] = await Promise.all([membershipTotal(sb, ym), cardTotals(sb, ym), giftingTotal(sb, ym)])
    return { month: ym, label: monthLabel(ym), membership: m.total, card_topups: c.topups, gifting: g.total }
  }))

  const totalRevenue = membership.total + card.topups
  const prior = mom[mom.length - 2]
  const priorTotal = prior ? prior.membership + prior.card_topups : 0
  const delta_pct = priorTotal > 0 ? Math.round(((totalRevenue - priorTotal) / priorTotal) * 100) : null

  return {
    month, month_label: monthLabel(month),
    membership, card, gifting,
    total_revenue: totalRevenue,
    mom,
    delta_pct,
  }
}
