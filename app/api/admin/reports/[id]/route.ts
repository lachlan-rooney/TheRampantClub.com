import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/reports/:id → the full report row (admin).
// PATCH /api/admin/reports/:id → edit narrative / headline / include_financials.
// Editable only while draft or pending_approval.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const NARRATIVE_KEYS = ['headline', 'interviews_commentary', 'marketing', 'cost_cutting', 'successes', 'guests_note', 'moment_of_week', 'closing_note']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data, error } = await svc().from('weekly_reports').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ report: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const sb = svc()

  const { data: cur } = await sb.from('weekly_reports').select('status, narrative, send_postponed_to').eq('id', id).maybeSingle()
  if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Editable while draft/pending, OR while approved but under an active send
  // postponement (so the version that finally sends is the most up to date).
  const heldOpen = cur.status === 'approved' && cur.send_postponed_to && new Date(cur.send_postponed_to) > new Date()
  if (cur.status !== 'draft' && cur.status !== 'pending_approval' && !heldOpen) {
    return NextResponse.json({ error: 'This report is locked (already sent, or approved and not postponed).' }, { status: 400 })
  }

  const narrative = { ...(cur.narrative || {}) }
  for (const k of NARRATIVE_KEYS) if (typeof body[k] === 'string') narrative[k] = String(body[k]).slice(0, 5000)

  const patch: Record<string, unknown> = { narrative, updated_at: new Date().toISOString() }
  if (typeof body.headline === 'string') patch.headline = String(body.headline).slice(0, 200)
  if (typeof body.include_financials === 'boolean') patch.include_financials = body.include_financials

  const { error } = await sb.from('weekly_reports').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'narrative_edited' })
  return NextResponse.json({ ok: true })
}
