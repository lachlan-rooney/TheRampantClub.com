import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildTracker } from '@/lib/reports/tracker'
import { vnDateString } from '@/lib/datetime'

// GET   /api/admin/tracker?month=YYYY-MM   — the weekly tracker
// POST  /api/admin/tracker                 — one whisky number for one week
// PATCH /api/admin/tracker                 — the cost base / target / rate
//
// Two inputs and nothing else. A tracker asking for one number a week survives;
// one asking for six does not.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const month = req.nextUrl.searchParams.get('month')
  const asOf = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-15` : vnDateString()
  // Anchored on the 15th for a past month so "elapsed weeks" means the whole
  // month rather than nothing; the current month uses today.
  const asOfDate = month && month !== vnDateString().slice(0, 7) ? `${month}-28` : asOf
  return NextResponse.json({ tracker: await buildTracker(svc(), asOfDate) })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const week = String(b.week_start || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: 'week_start must be YYYY-MM-DD.' }, { status: 400 })
  // The table enforces Mondays too; refusing here gives a message rather than a
  // constraint violation.
  const dow = (new Date(week + 'T00:00:00Z').getUTCDay() + 6) % 7
  if (dow !== 0) return NextResponse.json({ error: 'A week starts on a Monday.' }, { status: 400 })

  const amount = Number(b.amount_vnd)
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Enter the amount in VND.' }, { status: 400 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()

  const { error } = await svc().from('whisky_weekly_sales').upsert({
    week_start: week, amount_vnd: Math.round(amount),
    note: typeof b.note === 'string' ? b.note.slice(0, 300) : null,
    entered_by: user?.id ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'week_start' })
  if (error) return NextResponse.json({ error: 'Could not save that figure.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['monthly_target_usd', 'monthly_cost_base_usd', 'usd_vnd_rate'] as const) {
    if (k in b) {
      const n = Number(b[k])
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `${k} must be a number.` }, { status: 400 })
      if (k === 'usd_vnd_rate' && n <= 1000) return NextResponse.json({ error: 'That rate looks wrong — VND per USD, e.g. 26000.' }, { status: 400 })
      patch[k] = Math.round(n)
    }
  }
  if ('cost_base_note' in b) patch.cost_base_note = b.cost_base_note ? String(b.cost_base_note).slice(0, 500) : null

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  patch.updated_by = user?.id ?? null

  const { error } = await svc().from('finance_settings').update(patch).eq('id', true)
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
