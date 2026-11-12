import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { runReminders } from '@/app/api/admin/popup/mail/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// "YOUR SESSION STARTS IN TEN MINUTES", ON A TIMER.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ SAFE TO CALL AS OFTEN AS IT LIKES, which is the only reason a cron is an
// acceptable way to send email at all. popup_due_reminders excludes a session
// that has started, a cancelled booking, a waiting-list place, an address that
// has unsubscribed and anybody already sent one — so a second run inside the
// same minute sends nothing, and a missed run is caught by the next.
//
// ⚠ IT DOES NOTHING ON ANY OTHER NIGHT. The query is bounded by the event's
// own sessions, and outside the evening of the pop-up there is never a session
// inside the lead time. It costs one query a tick and sends nothing.
//
// Every two minutes against a ten-minute lead means a guest hears from us
// between eight and ten minutes before their session — never after it starts,
// which is the one outcome worse than not sending at all.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

async function authed(req: NextRequest): Promise<boolean> {
  const h = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && h && h === process.env.CRON_SECRET) return true
  return await isAdmin()
}

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } })
  const { data: ev } = await a.from('popup_events').select('*').eq('slug', SLUG).maybeSingle()
  if (!ev) return NextResponse.json({ ok: true, skipped: 'no pop-up is set up' })
  // An unpublished evening is a rehearsal. Nobody is reminded about a rehearsal.
  if (!ev.published) return NextResponse.json({ ok: true, skipped: 'not published' })
  return NextResponse.json(await runReminders(a, ev, req.nextUrl.searchParams.get('dry') === '1'))
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }
