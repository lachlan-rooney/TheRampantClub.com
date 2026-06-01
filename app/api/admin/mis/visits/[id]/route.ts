import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET   /api/admin/mis/visits/[id]   — visit row + observations on this visit
// PATCH /api/admin/mis/visits/[id]   — update phase / timestamps / continuum field
//
// Phase transitions stamp the matching timestamp when the client doesn't
// provide one explicitly:
//   overture  → accord     : arrival_time = now() (if null)
//   accord    → continuum  : departure_time = now() (if null)
//   continuum → closed     : requires data_for_next_overture; stamps
//                            continuum_completed_at = now()

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_PHASES = ['overture', 'accord', 'continuum', 'closed'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sb = svc()
  const [{ data: visit, error: vErr }, { data: observations }] = await Promise.all([
    sb.from('visits')
      .select('visit_id, member_no, visit_date, phase, space, duration_min, emotional_state, notes, logged_by, archived_at, overture_generated_at, overture_generated_by, arrival_time, departure_time, continuum_completed_at, data_for_next_overture, created_at')
      .eq('visit_id', id).maybeSingle(),
    sb.from('harmony_observations')
      .select('observation_id, visit_id, member_no, category, observation, sentiment, score, links_to_preference_id, spawned_candidate, logged_by, created_at')
      .eq('visit_id', id).order('created_at', { ascending: true }),
  ])
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
  if (!visit) return NextResponse.json({ error: 'visit not found' }, { status: 404 })

  // Pull member + tier so the page header doesn't need a second round-trip.
  const { data: member } = await sb.from('members')
    .select('member_no, full_name, nickname, tier, status, birthday, join_date')
    .eq('member_no', visit.member_no).maybeSingle()

  return NextResponse.json({ visit, observations: observations || [], member })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sb = svc()
  const { data: before } = await sb.from('visits').select('*').eq('visit_id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'visit not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  // Phase transition with timestamp stamping.
  if (typeof body.phase === 'string' && (ALLOWED_PHASES as readonly string[]).includes(body.phase) && body.phase !== before.phase) {
    const next = body.phase
    patch.phase = next
    const now = new Date().toISOString()

    if (next === 'accord' && !before.arrival_time && !body.arrival_time) {
      patch.arrival_time = now
    }
    if (next === 'continuum' && !before.departure_time && !body.departure_time) {
      patch.departure_time = now
    }
    if (next === 'closed') {
      const finalNote = typeof body.data_for_next_overture === 'string'
        ? body.data_for_next_overture
        : before.data_for_next_overture
      if (!finalNote || !String(finalNote).trim()) {
        return NextResponse.json({ error: 'data_for_next_overture is required before closing — capture the handoff to the next Overture.' }, { status: 400 })
      }
      patch.continuum_completed_at = now
    }
  }

  if (typeof body.arrival_time === 'string')           patch.arrival_time = body.arrival_time
  if (typeof body.departure_time === 'string')         patch.departure_time = body.departure_time
  if (typeof body.continuum_completed_at === 'string') patch.continuum_completed_at = body.continuum_completed_at
  if (typeof body.data_for_next_overture === 'string') patch.data_for_next_overture = body.data_for_next_overture.slice(0, 4000) || null
  if (typeof body.space === 'string')                  patch.space = body.space.slice(0, 80) || null
  if (typeof body.emotional_state === 'string')        patch.emotional_state = body.emotional_state.slice(0, 80) || null
  if (typeof body.notes === 'string')                  patch.notes = body.notes.slice(0, 2000) || null
  if (body.duration_min === null) {
    patch.duration_min = null
  } else if (body.duration_min != null) {
    const n = Number(body.duration_min)
    if (Number.isFinite(n) && n >= 0 && n <= 1440) patch.duration_min = Math.round(n)
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const { error } = await sb.from('visits').update(patch).eq('visit_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
