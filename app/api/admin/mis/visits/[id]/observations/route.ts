import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/mis/visits/[id]/observations
//
// Records one Accord Note. Body shape supports the spec's three paths:
//
//   1. Plain observation (no preference linkage) — just inserts the row.
//   2. Linked to an existing preference (write contract A):
//        body.links_to_preference_id + body.validation_event_type
//          ('confirmed' | 'contradicted' | 'revised')
//        Optional revised fields: s0, confidence, lambda, frequency, status.
//        Server: insert observation → call apply_preference_validation RPC.
//   3. Spawn a new preference candidate (write contract B):
//        body.spawn_candidate = true + body.candidate { suggested_category,
//        suggested_name, detail, etc. }
//        Server: insert observation with spawned_candidate=true → insert
//        into preference_candidates linked back via source_observation_id.
//
// DELETE /api/admin/mis/visits/[id]/observations?observation_id=…
//   Hard-delete; only sensible for fixing mis-logged rows.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_SENTIMENT = ['excellence', 'neutral', 'grievance']
const ALLOWED_EVENT_TYPE = ['confirmed', 'contradicted', 'revised']

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: visit_id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const observationText = String(body.observation || '').trim()
  if (!observationText) return NextResponse.json({ error: 'observation required' }, { status: 400 })

  const sb = svc()
  const { data: visit } = await sb.from('visits').select('visit_id, member_no, phase').eq('visit_id', visit_id).maybeSingle()
  if (!visit) return NextResponse.json({ error: 'visit not found' }, { status: 404 })
  if (visit.phase === 'closed') return NextResponse.json({ error: 'visit is closed — cannot add observations' }, { status: 409 })

  const sentiment = typeof body.sentiment === 'string' && ALLOWED_SENTIMENT.includes(body.sentiment) ? body.sentiment : 'neutral'
  const score = Number.isInteger(body.score) && (body.score as number) >= 1 && (body.score as number) <= 5 ? body.score : null
  const linksTo = typeof body.links_to_preference_id === 'string' && body.links_to_preference_id ? body.links_to_preference_id : null
  const spawnCandidate = !!body.spawn_candidate

  // 1. Insert the observation row.
  const { data: obs, error: obsErr } = await sb.from('harmony_observations').insert({
    visit_id,
    member_no: visit.member_no,
    category: body.category ? String(body.category).slice(0, 40) : null,
    observation: observationText.slice(0, 4000),
    sentiment,
    score,
    links_to_preference_id: linksTo,
    spawned_candidate: spawnCandidate,
    logged_by: actor,
  }).select('*').single()
  if (obsErr || !obs) return NextResponse.json({ error: obsErr?.message || 'insert failed' }, { status: 500 })

  let validation_event_id: string | null = null
  let candidate_id: string | null = null
  const warnings: string[] = []

  // 2. Write contract A — link to preference + event type → atomic RPC.
  if (linksTo) {
    const eventType = typeof body.validation_event_type === 'string' && ALLOWED_EVENT_TYPE.includes(body.validation_event_type)
      ? body.validation_event_type
      : 'confirmed'

    const rpcParams: Record<string, unknown> = {
      p_preference_id: linksTo,
      p_event_type:    eventType,
      p_staff_id:      actor,
      p_notes:         observationText.slice(0, 2000),
    }
    if (eventType === 'revised') {
      if (Number.isInteger(body.revised_s0))     rpcParams.p_s0         = body.revised_s0
      if (body.revised_confidence != null)       rpcParams.p_confidence = Number(body.revised_confidence)
      if (body.revised_lambda     != null)       rpcParams.p_lambda     = Number(body.revised_lambda)
      if (body.revised_frequency  != null)       rpcParams.p_frequency  = Number(body.revised_frequency)
      if (typeof body.revised_status === 'string') rpcParams.p_status   = body.revised_status
    }

    const { data: eventId, error: rpcErr } = await sb.rpc('apply_preference_validation', rpcParams)
    if (rpcErr) {
      warnings.push(`validation_event failed: ${rpcErr.message}`)
    } else {
      validation_event_id = typeof eventId === 'string' ? eventId : eventId ? String(eventId) : null
    }
  }

  // 3. Write contract B — spawn a candidate row.
  if (spawnCandidate) {
    const cand = (body.candidate && typeof body.candidate === 'object' && !Array.isArray(body.candidate))
      ? body.candidate as Record<string, unknown>
      : {}
    const { data: c, error: cErr } = await sb.from('preference_candidates').insert({
      member_no: visit.member_no,
      source_observation_id: obs.observation_id,
      suggested_category: cand.suggested_category ? String(cand.suggested_category).slice(0, 40) : (body.category ? String(body.category).slice(0, 40) : null),
      suggested_name:     cand.suggested_name     ? String(cand.suggested_name).slice(0, 200)   : null,
      detail:             cand.detail             ? String(cand.detail).slice(0, 2000)         : observationText.slice(0, 2000),
      verbatim_quote:     cand.verbatim_quote     ? String(cand.verbatim_quote).slice(0, 1000) : null,
      suggested_s0:         Number.isInteger(cand.suggested_s0) ? cand.suggested_s0 : null,
      suggested_confidence: cand.suggested_confidence != null ? Number(cand.suggested_confidence) : null,
      suggested_lambda:     cand.suggested_lambda     != null ? Number(cand.suggested_lambda)     : null,
      suggested_frequency:  cand.suggested_frequency  != null ? Number(cand.suggested_frequency)  : null,
      source: 'Observation',
    }).select('candidate_id').single()
    if (cErr) {
      warnings.push(`candidate insert failed: ${cErr.message}`)
    } else {
      candidate_id = c?.candidate_id || null
    }
  }

  return NextResponse.json({ ok: true, observation: obs, validation_event_id, candidate_id, warnings })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: visit_id } = await ctx.params
  const obsId = req.nextUrl.searchParams.get('observation_id')
  if (!obsId) return NextResponse.json({ error: 'observation_id required' }, { status: 400 })

  const sb = svc()
  const { error } = await sb.from('harmony_observations').delete().eq('observation_id', obsId).eq('visit_id', visit_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
