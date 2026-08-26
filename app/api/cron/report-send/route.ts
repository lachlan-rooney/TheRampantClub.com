import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { sendReport } from '@/lib/reports/send'

// Auto-send APPROVED weekly reports to the configured recipients.
// Scheduled Monday 17:00 VN (0 10 * * 1 UTC) — once/day (Hobby-plan cron limit).
// Sends approved reports whose send hold (if any) has lapsed; a report postponed
// past 17:00 is held and the owner sends it manually with "Send now" when ready.
// Only approved reports send; unapproved ones wait.
// (Beta: the send layer hard-blocks Shawn regardless of settings.)

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
  // Approved reports whose send hold (if any) has lapsed. Runs hourly 17:00–21:00
  // VN Mon, so a postponed report goes out at the top of the hour it's due.
  const now = new Date().toISOString()
  const { data: approved } = await sb.from('weekly_reports').select('id')
    .eq('status', 'approved')
    .or(`send_postponed_to.is.null,send_postponed_to.lte.${now}`)
    .order('period_start', { ascending: true })
  const results: { id: string; ok: boolean; recipients?: string[]; error?: string }[] = []
  for (const r of approved || []) {
    const res = await sendReport(sb, r.id, { actor: null })
    results.push({ id: r.id, ok: res.ok, recipients: res.recipients, error: res.error })
  }
  return NextResponse.json({ ok: true, sent: results.filter(r => r.ok).length, results })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
