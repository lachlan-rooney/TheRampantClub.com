import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST  /api/admin/mis/candidates/[id]/accept    — promote to preference (write contract B)
// POST  /api/admin/mis/candidates/[id]/reject    — mark rejected (no preference write)
// PATCH /api/admin/mis/candidates/[id]           — edit the suggested fields before accept
//
// Express routing: the action sits in the body as { action } so the route
// stays a single endpoint. POST body: { action: 'accept' | 'reject',
// overrides?: { category, preference_name, detail, s0, confidence, lambda,
// frequency } }.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_CONFIDENCE = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_LAMBDA     = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_FREQUENCY  = [0.8, 1.0, 1.2, 1.5]

function snap(v: unknown, allowed: number[], fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  let best = allowed[0]
  let bestDist = Math.abs(allowed[0] - n)
  for (const a of allowed) {
    const d = Math.abs(a - n)
    if (d < bestDist) { best = a; bestDist = d }
  }
  return best
}
function clampS0(v: unknown, fallback = 3): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(5, n))
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const action = typeof body.action === 'string' ? body.action : ''
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'accept' or 'reject'" }, { status: 400 })
  }

  const sb = svc()
  const { data: candidate } = await sb.from('preference_candidates').select('*').eq('candidate_id', id).maybeSingle()
  if (!candidate) return NextResponse.json({ error: 'candidate not found' }, { status: 404 })
  if (candidate.status !== 'pending') {
    return NextResponse.json({ error: `candidate is ${candidate.status}, not pending` }, { status: 409 })
  }

  if (action === 'reject') {
    const { error } = await sb.from('preference_candidates').update({
      status: 'rejected',
      reviewed_by: actor,
      reviewed_at: new Date().toISOString(),
    }).eq('candidate_id', id).eq('status', 'pending').select('candidate_id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // accept → promote via the RPC (write contract B is one transaction)
  const overrides = (body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides))
    ? body.overrides as Record<string, unknown>
    : {}

  const category    = typeof overrides.category === 'string' ? overrides.category : candidate.suggested_category
  const name        = typeof overrides.preference_name === 'string' ? overrides.preference_name : (candidate.suggested_name || 'Untitled preference')
  const detail      = typeof overrides.detail === 'string' ? overrides.detail : candidate.detail
  const verbatim    = typeof overrides.verbatim_quote === 'string' ? overrides.verbatim_quote : candidate.verbatim_quote
  const s0          = clampS0(overrides.s0 ?? candidate.suggested_s0 ?? 3)
  const confidence  = snap(overrides.confidence ?? candidate.suggested_confidence, ALLOWED_CONFIDENCE, 0.75)
  const lambda      = snap(overrides.lambda     ?? candidate.suggested_lambda,     ALLOWED_LAMBDA,     0.010)
  const frequency   = snap(overrides.frequency  ?? candidate.suggested_frequency,  ALLOWED_FREQUENCY,  1.0)

  if (!category) return NextResponse.json({ error: 'category required (override on accept)' }, { status: 400 })
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'preference_name required' }, { status: 400 })

  const { data: prefId, error: rpcErr } = await sb.rpc('promote_preference_candidate', {
    p_candidate_id:    id,
    p_member_no:       candidate.member_no,
    p_category:        String(category).slice(0, 40),
    p_preference_name: String(name).slice(0, 200),
    p_detail:          detail ? String(detail).slice(0, 2000) : null,
    p_verbatim_quote:  verbatim ? String(verbatim).slice(0, 1000) : null,
    p_s0:              s0,
    p_confidence:      confidence,
    p_lambda:          lambda,
    p_frequency:       frequency,
    p_source:          candidate.source || 'Observation',
    p_reviewer:        actor,
  })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, status: 'accepted', preference_id: prefId })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (typeof body.suggested_category === 'string') patch.suggested_category = body.suggested_category.slice(0, 40)
  if (typeof body.suggested_name === 'string')     patch.suggested_name     = body.suggested_name.slice(0, 200)
  if (typeof body.detail === 'string')             patch.detail             = body.detail.slice(0, 2000)
  if (typeof body.verbatim_quote === 'string')     patch.verbatim_quote     = body.verbatim_quote.slice(0, 1000)
  if (body.suggested_s0 != null)         patch.suggested_s0         = clampS0(body.suggested_s0)
  if (body.suggested_confidence != null) patch.suggested_confidence = snap(body.suggested_confidence, ALLOWED_CONFIDENCE, 0.75)
  if (body.suggested_lambda != null)     patch.suggested_lambda     = snap(body.suggested_lambda,     ALLOWED_LAMBDA,     0.010)
  if (body.suggested_frequency != null)  patch.suggested_frequency  = snap(body.suggested_frequency,  ALLOWED_FREQUENCY,  1.0)

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const sb = svc()
  const { data, error } = await sb.from('preference_candidates').update(patch)
    .eq('candidate_id', id).eq('status', 'pending')
    .select('candidate_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'candidate no longer pending' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
