import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { gatherWeek } from '@/lib/reports/gather'
import { lastCompleteWeekVN } from '@/lib/reports/week'
import { gatherScorecardGap } from '@/lib/analytics/scorecard'

// THE WEEKLY OPS SCORECARD — read-only, and additive by construction.
//
// It touches nothing that exists. The admin dashboard reads
// /api/admin/dashboard; this is its own route under its own namespace, and
// the only thing the two share is the database.
//
// ── IT COMPOSES, IT DOES NOT DUPLICATE ────────────────────────────────────
// gatherWeek already computes task completion, complaints opened/resolved,
// staff actions, the pipeline funnel and its conversion — it has been doing it
// every Monday for the executive report since September. A second
// implementation of "complaints opened this week" would eventually disagree
// with the first, so this calls the same function the report calls and adds
// only what is genuinely missing (lib/analytics/scorecard).
//
// includeFinancials is false: the scorecard is an operations read, the money
// belongs to the month-end pack, and gathering it here would do work nobody
// is going to look at.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  // Defaults to the last COMPLETE Mon–Sun VN week, the same window the
  // executive report uses — so the two can never quote different weeks.
  const qs = url.searchParams.get('start')
  const qe = url.searchParams.get('end')
  const { start, end } = (qs && qe && /^\d{4}-\d{2}-\d{2}$/.test(qs) && /^\d{4}-\d{2}-\d{2}$/.test(qe))
    ? { start: qs, end: qe }
    : lastCompleteWeekVN()

  const sb = svc()
  const [report, gap] = await Promise.all([
    gatherWeek(sb, start, end, { includeFinancials: false }).catch(() => null),
    gatherScorecardGap(sb, start, end).catch(() => null),
  ])

  if (!gap) return NextResponse.json({ error: 'could not read the scorecard' }, { status: 500 })

  return NextResponse.json({
    period: { start, end },
    // From the existing gatherer — named so it is obvious where it came from,
    // and so a reader knows changing it means changing the report too.
    shared: report ? {
      usage: report.auto.usage,
      ops: report.auto.ops ?? null,
      pipeline: report.auto.pipeline,
      members: report.auto.members,
    } : null,
    gap,
    generated_at: new Date().toISOString(),
  })
}
