import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/gifts/summary
//   Returns the org-wide summary slice the dashboard wants.
//
// GET /api/admin/gifts/summary?member_no=…
//   Returns the single-member summary the profile panel wants (with the
//   member's gifts within the current budget year).

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const memberNo = searchParams.get('member_no')

  const sb = svc()

  if (memberNo) {
    const [{ data: summary }, { data: gifts }] = await Promise.all([
      sb.from('member_gifting_summary').select('*').eq('member_no', memberNo).maybeSingle(),
      sb.from('gifts').select('*').eq('member_no', memberNo).order('gift_date', { ascending: false }).limit(200),
    ])
    if (!summary) return NextResponse.json({ summary: null, gifts: gifts || [] })

    const windowStart = summary.window_start
    const windowEnd   = summary.window_end
    const thisYearGifts = (gifts || []).filter(g => {
      if (!windowStart) return false
      return g.gift_date >= windowStart && (!windowEnd || g.gift_date <= windowEnd)
    })

    return NextResponse.json({
      summary,
      this_year_gifts: thisYearGifts,
      all_gifts: gifts || [],
    })
  }

  // Org-wide view. Three slices: per-member current-year summary, recent
  // org spend, totals.
  const { data: summaries } = await sb.from('member_gifting_summary').select('*').eq('status', 'Active')
  const list = summaries || []

  const totalBudget = list.reduce((s, m) => s + Number(m.annual_budget_vnd || 0), 0)
  const totalSpent  = list.reduce((s, m) => s + Number(m.spent_vnd || 0), 0)

  // Members with budget but no gifts this year — the unloved-member alarm.
  const noGifts = list
    .filter(m => Number(m.annual_budget_vnd) > 0 && Number(m.gift_count) === 0)
    .sort((a, b) => Number(b.annual_budget_vnd) - Number(a.annual_budget_vnd))
    .slice(0, 12)

  // Spend by occasion in the last 90 days (org view).
  const ninetyAgo = new Date(); ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const fromIso = ninetyAgo.toISOString().slice(0, 10)
  const { data: recentGifts } = await sb.from('gifts').select('occasion, category, cost_vnd, gift_date').gte('gift_date', fromIso)
  const byOccasion = new Map<string, number>()
  const byCategory = new Map<string, number>()
  for (const g of (recentGifts || [])) {
    byOccasion.set(g.occasion, (byOccasion.get(g.occasion) || 0) + Number(g.cost_vnd))
    if (g.category) byCategory.set(g.category, (byCategory.get(g.category) || 0) + Number(g.cost_vnd))
  }

  return NextResponse.json({
    totals: {
      members: list.length,
      total_annual_budget_vnd: totalBudget,
      total_spent_vnd: totalSpent,
      remaining_vnd: Math.max(0, totalBudget - totalSpent),
      pct_used: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    },
    unloved: noGifts,
    by_occasion_90d: Array.from(byOccasion.entries()).map(([occasion, total]) => ({ occasion, total })).sort((a, b) => b.total - a.total),
    by_category_90d: Array.from(byCategory.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
  })
}
