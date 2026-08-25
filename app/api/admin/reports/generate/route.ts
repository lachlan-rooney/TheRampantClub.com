import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { gatherWeek } from '@/lib/reports/gather'
import { lastCompleteWeekVN, isMonthEndWeek } from '@/lib/reports/week'

// POST /api/admin/reports/generate { period_start?, period_end?, include_financials? }
// Creates (or returns) the draft for a week with a FROZEN data snapshot.
// Defaults to the last complete Mon–Sun VN week; auto-includes financials on the
// month's final week. Idempotent on (period_start, period_end).

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const wk = lastCompleteWeekVN()
  const period_start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.period_start)) ? String(body.period_start) : wk.start
  const period_end = /^\d{4}-\d{2}-\d{2}$/.test(String(body.period_end)) ? String(body.period_end) : wk.end
  const include_financials = typeof body.include_financials === 'boolean' ? body.include_financials : isMonthEndWeek(period_end)

  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  const sb = svc()

  // Idempotent: if a report for this week exists, refresh its snapshot only if still draft.
  const { data: existing } = await sb.from('weekly_reports').select('id, status').eq('period_start', period_start).eq('period_end', period_end).maybeSingle()

  const { auto, financials } = await gatherWeek(sb, period_start, period_end, { includeFinancials: include_financials })

  if (existing) {
    if (existing.status === 'draft' || existing.status === 'pending_approval') {
      await sb.from('weekly_reports').update({ auto_data: auto, financials: financials || {}, include_financials, updated_at: new Date().toISOString() }).eq('id', existing.id)
      await sb.from('report_activity').insert({ report_id: existing.id, actor: user?.id || null, event_type: 'data_refreshed' })
    }
    return NextResponse.json({ ok: true, id: existing.id, status: existing.status, existed: true })
  }

  const { data: created, error } = await sb.from('weekly_reports').insert({
    period_start, period_end, status: 'draft',
    auto_data: auto, financials: financials || {}, include_financials,
    narrative: {}, created_by: user?.id || null,
  }).select('id').maybeSingle()
  if (error || !created) return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 })

  await sb.from('report_activity').insert({ report_id: created.id, actor: user?.id || null, event_type: 'generated', to_status: 'draft' })
  return NextResponse.json({ ok: true, id: created.id, status: 'draft', existed: false })
}
