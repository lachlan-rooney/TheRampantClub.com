import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { gatherWeek } from '@/lib/reports/gather'

// POST /api/admin/reports/:id/refresh-data → re-pull the frozen snapshot.
// Allowed only while draft/pending_approval (approved/sent are immutable).

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = svc()
  const { data: r } = await sb.from('weekly_reports').select('period_start, period_end, status, include_financials').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (r.status !== 'draft' && r.status !== 'pending_approval') return NextResponse.json({ error: 'Locked' }, { status: 400 })

  const { auto, financials } = await gatherWeek(sb, r.period_start, r.period_end, { includeFinancials: r.include_financials })
  await sb.from('weekly_reports').update({ auto_data: auto, financials: financials || {}, updated_at: new Date().toISOString() }).eq('id', id)

  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'data_refreshed' })
  return NextResponse.json({ ok: true, generated_at: auto.generated_at })
}
