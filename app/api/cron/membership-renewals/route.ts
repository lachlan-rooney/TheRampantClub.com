import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { dispatchPendingEmails } from '@/lib/ops/notify-dispatch'

// Nightly membership-renewal scan: reminders at T-30/14/7/1 + Active→Lapsed past
// grace, then flush pending emails (quiet-hours aware). Same auth/shape as
// app/api/cron/ops-materialise and notify-daily.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function authed(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && headerSecret && headerSecret === process.env.CRON_SECRET) return true
  return await isAdmin()
}

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const { data, error } = await sb.rpc('membership_scan_renewals')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let flush
  try { flush = await dispatchPendingEmails(sb) } catch { /* daily sweep backstop */ }
  return NextResponse.json({ ok: true, summary: Array.isArray(data) ? data[0] : data, flush })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
