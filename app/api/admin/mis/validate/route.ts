import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// MIS Pass 2-lite — validation write endpoint.
// Wraps the apply_preference_validation Postgres function so UPDATE and
// INSERT happen in one transaction. Used for both "confirm" (no field
// changes) and "revise" (one or more of s0/c/lambda/f/status changed).

export const dynamic = 'force-dynamic'

const allowedEventTypes = ['confirmed', 'contradicted', 'revised', 'invalidated'] as const
type EventType = typeof allowedEventTypes[number]

const allowedConfidence = [1.00, 0.75, 0.50, 0.25]
const allowedLambda     = [0.000, 0.002, 0.005, 0.010, 0.020]
const allowedFrequency  = [0.8, 1.0, 1.2, 1.5]
const allowedStatus     = ['active', 'invalidated', 'archived']

function snap(value: unknown, allowed: number[], label: string): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  if (Number.isNaN(n)) throw new Error(`${label} must be a number`)
  const match = allowed.find(a => Math.abs(a - n) < 1e-6)
  if (match == null) throw new Error(`${label}=${n} not in allowed set ${JSON.stringify(allowed)}`)
  return match
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Capture who's making the change for the audit log
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const staffId = user?.email || user?.id || null

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const preference_id = String(body.preference_id || '').trim()
  const event_type = String(body.event_type || '').trim() as EventType
  if (!preference_id) return NextResponse.json({ error: 'preference_id required' }, { status: 400 })
  if (!allowedEventTypes.includes(event_type)) {
    return NextResponse.json({ error: `event_type must be one of ${allowedEventTypes.join(', ')}` }, { status: 400 })
  }

  let s0: number | null = null
  let confidence: number | null = null
  let lambda: number | null = null
  let frequency: number | null = null
  let status: string | null = null
  try {
    if (body.s0 != null) {
      const v = Number(body.s0)
      if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error('s0 must be an integer 1..5')
      s0 = v
    }
    if (body.confidence != null) confidence = snap(body.confidence, allowedConfidence, 'confidence')
    if (body.lambda != null)     lambda     = snap(body.lambda,     allowedLambda,     'lambda')
    if (body.frequency != null)  frequency  = snap(body.frequency,  allowedFrequency,  'frequency')
    if (body.status != null) {
      const s = String(body.status)
      if (!allowedStatus.includes(s)) throw new Error(`status must be one of ${allowedStatus.join(', ')}`)
      status = s
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const notes = body.notes ? String(body.notes).slice(0, 1000) : null

  // RPC the Postgres function under service role
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: eventId, error } = await sb.rpc('apply_preference_validation', {
    p_preference_id: preference_id,
    p_event_type:    event_type,
    p_staff_id:      staffId,
    p_notes:         notes,
    p_s0:            s0,
    p_confidence:    confidence,
    p_lambda:        lambda,
    p_frequency:     frequency,
    p_status:        status,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return the updated row from preference_scores so the UI can refresh in place.
  const { data: refreshed } = await sb
    .from('preference_scores')
    .select('preference_id, s0, confidence, lambda, frequency, last_validated, validation_count, days_since, ps_t, score_health_pct, needs_revalidation, status')
    .eq('preference_id', preference_id)
    .maybeSingle()

  return NextResponse.json({ event_id: eventId, preference: refreshed })
}
