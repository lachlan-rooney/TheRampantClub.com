import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { dispatchPendingEmails } from '@/lib/ops/notify-dispatch'

// POST/GET /api/cron/ops-materialise
//
// Materialises due recurring tasks and lapses prior un-done ones (carry-over c).
// Calls ops_materialise_due(), which keys off the Vietnam-local date (Trap 1) and
// is idempotent via the (template_id, materialised_for) unique index — safe to
// double-fire / retry.
//
// Auth mirrors the other crons: X-CRON-SECRET header (Vercel) or an authenticated
// admin (the manual "Materialise now" button). Runs under the service role — the
// materialiser is a system action; its events are labelled "Recurring".
//
// Vercel Cron config (vercel.json): "5 17 * * *" = 17:05 UTC = 00:05 Vietnam,
// daily — fires just after the VN midnight boundary so "today" is the new VN day.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function authed(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && headerSecret && headerSecret === process.env.CRON_SECRET) return true
  return await isAdmin()
}

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const { data, error } = await sb.rpc('ops_materialise_due')   // defaults to VN today
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── WEEKLY SHIFT TASKS ride on this job rather than a second scheduler ────
  // shift_materialise_week() is idempotent (unique on template_task + week), so
  // calling it daily is harmless and Monday is simply the first day it creates
  // anything. Generating lazily on first view was the alternative and is worse:
  // a week nobody opens never exists, so carry-over silently skips it and the
  // Monday review is short a person with no error raised anywhere.
  //
  // A failure here must NOT fail the ops materialiser — they are independent
  // jobs sharing a trigger, and one going down should not take the other with it.
  let shifts: number | null = null
  let shiftsError: string | null = null
  try {
    const r = await sb.rpc('shift_materialise_week')
    if (r.error) shiftsError = r.error.message
    else shifts = r.data as number
  } catch (e) { shiftsError = (e as Error).message }
  // Flush emails for any recurring-task assignments just materialised. At 00:05 VN
  // this is quiet hours → dispatch defers them (the daily 09:00 cron sweeps them).
  let flush
  try { flush = await dispatchPendingEmails(sb) } catch { /* daily sweep backstop */ }
  return NextResponse.json({ ok: true, summary: data, flush, shift_instances_created: shifts, shift_error: shiftsError })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest)  { return handle(req) }
