import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { gatherWeek } from '@/lib/reports/gather'
import { lastCompleteWeekVN, isMonthEndWeek } from '@/lib/reports/week'

// Auto-draft the weekly report for the last complete Mon–Sun VN week.
// Scheduled Monday ~07:00 VN (0 0 * * 1 UTC). Idempotent — skips if it exists.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function authed(req: NextRequest): Promise<boolean> {
  const s = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && s && s === process.env.CRON_SECRET) return true
  return await isAdmin()
}

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const { start, end } = lastCompleteWeekVN()
  const { data: existing } = await sb.from('weekly_reports').select('id').eq('period_start', start).eq('period_end', end).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, id: existing.id, existed: true })

  const include_financials = isMonthEndWeek(end)
  const { auto, financials } = await gatherWeek(sb, start, end, { includeFinancials: include_financials })
  const { data: created, error } = await sb.from('weekly_reports').insert({
    period_start: start, period_end: end, status: 'draft', auto_data: auto, financials: financials || {}, include_financials, narrative: {},
  }).select('id').maybeSingle()
  if (error || !created) return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 })
  await sb.from('report_activity').insert({ report_id: created.id, event_type: 'generated', to_status: 'draft', note: 'auto-drafted' })
  return NextResponse.json({ ok: true, id: created.id, period: { start, end }, include_financials })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
