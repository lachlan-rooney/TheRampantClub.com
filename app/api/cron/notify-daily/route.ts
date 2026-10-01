import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { dispatchPendingEmails } from '@/lib/ops/notify-dispatch'
import { sendStaffTaskDigest } from '@/lib/ops/staff-digest'

// POST/GET /api/cron/notify-daily
//
// The daily notifications tick. Four jobs:
//   1. Generate "due tomorrow" notifications — no event triggers these (time
//      just passes), so a daily scan creates them (assignee + owner, deduped,
//      idempotent via ops_generate_due_soon).
//   2. Flush pending emails — this is also the GUARANTEED post-quiet-hours
//      sweep: it runs at 09:00 VN (just after quiet hours end at 08:00), so any
//      email left pending overnight (e.g. the 00:05 materialiser's recurring
//      assignments) goes out this morning. Nothing stays stuck.
//   3. (2026-10-01) Send each staff member their own list of late and due
//      board tasks, to the address on their staff record. This does NOT go
//      through the notifications table above: a notification is addressed to a
//      LOGIN and a board task is assigned to a TEAM MEMBER, and thirteen of the
//      fifteen team members have no login — which is why every task_due_soon
//      email ever sent went to the owner. See lib/ops/staff-digest.ts.
//   4. (2026-09-14) Delete door-guest signatures older than seven days —
//      guest_signatures_purge() in db/guest_signin.sql. It rides on this route
//      rather than a cron of its own: Vercel Hobby allows only daily crons, and
//      this one already runs daily. The purge is housekeeping; the promise is kept
//      ON READ — /api/admin/guest-visits/[id]/signature refuses anything past the
//      cutoff — so a late or failed run here exposes nothing.
//
// Auth mirrors the other crons. Runs under the service role.
//
// Vercel Cron (vercel.json): "0 2 * * *" = 02:00 UTC = 09:00 Vietnam, daily.

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

  // FIRST, and on its own: a failure in the notifications work below returns
  // early, and must not also keep a week-old signature alive another day.
  let signatures_purged: number | string
  try {
    const { data: n, error: pErr } = await sb.rpc('guest_signatures_purge')
    signatures_purged = pErr ? `skipped: ${pErr.message}` : Number(n) || 0
  } catch (e) { signatures_purged = `skipped: ${(e as Error).message}` }

  const { data: dueSoon, error } = await sb.rpc('ops_generate_due_soon')   // defaults to VN tomorrow
  if (error) return NextResponse.json({ error: error.message, signatures_purged }, { status: 500 })

  const flush = await dispatchPendingEmails(sb)

  // After the flush, and never allowed to fail the run: a digest that throws
  // must not undo the purge or the notifications that have already gone.
  let digest
  try { digest = await sendStaffTaskDigest(sb) }
  catch (e) { digest = { ran: false, reason: (e as Error).message } }

  return NextResponse.json({ ok: true, due_soon_created: dueSoon, flush, digest, signatures_purged })
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest)  { return handle(req) }
