import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// MIS visits — staff-side log of when a member came to the club. Every row here
// feeds member_stats.avg_visits_per_month, which feeds the M term inside
// preference_scores. The moment the second visit lands, M starts amplifying
// PS(t) automatically (no code change needed).

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET /api/admin/mis/visits[?member_no=…&limit=…&include_archived=true] ──
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member_no = req.nextUrl.searchParams.get('member_no')
  const includeArchived = req.nextUrl.searchParams.get('include_archived') === 'true'
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 100), 500)

  const sb = svc()
  let q = sb.from('visits')
    .select('visit_id, member_no, visit_date, space, duration_min, emotional_state, logged_by, notes, created_at, archived_at')
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (member_no) q = q.eq('member_no', member_no)
  if (!includeArchived) q = q.is('archived_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ visits: data || [] })
}

// ── POST /api/admin/mis/visits ─────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const loggedBy = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const member_no = String(body.member_no || '').trim()
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const visit_date = String(body.visit_date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visit_date)) {
    return NextResponse.json({ error: 'visit_date must be YYYY-MM-DD' }, { status: 400 })
  }

  const duration = body.duration_min === '' || body.duration_min == null ? null : Number(body.duration_min)
  if (duration != null && (!Number.isFinite(duration) || duration < 0 || duration > 1440)) {
    return NextResponse.json({ error: 'duration_min must be 0–1440' }, { status: 400 })
  }

  const row = {
    member_no,
    visit_date,
    space:           body.space           ? String(body.space).slice(0, 80)            : null,
    duration_min:    duration,
    emotional_state: body.emotional_state ? String(body.emotional_state).slice(0, 80)  : null,
    notes:           body.notes           ? String(body.notes).slice(0, 1000)          : null,
    logged_by:       loggedBy,
  }

  const sb = svc()
  const { data, error } = await sb.from('visits').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ visit: data })
}

// ── DELETE /api/admin/mis/visits?visit_id=…[&restore=true] ─────────
// Soft-archive by default: sets archived_at = now() so member_stats stops
// counting the row (M reflects the change immediately). Pass ?restore=true
// to un-archive instead.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const visit_id = req.nextUrl.searchParams.get('visit_id')
  const restore = req.nextUrl.searchParams.get('restore') === 'true'
  if (!visit_id) return NextResponse.json({ error: 'visit_id required' }, { status: 400 })

  const sb = svc()
  const { error } = await sb.from('visits')
    .update({ archived_at: restore ? null : new Date().toISOString() })
    .eq('visit_id', visit_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, archived: !restore })
}
