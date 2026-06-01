import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Batch-saves preferences accepted from a transcript intake session.
// The intake stream emits raw extractions; the UI lets the admin edit/discard
// each one before committing. We re-validate every numeric field here so the
// browser can't bypass the spec's allowed sets.

export const dynamic = 'force-dynamic'

const allowedCategories = new Set([
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
])
const allowedConfidence = [1.00, 0.75, 0.50, 0.25]
const allowedLambda     = [0.000, 0.002, 0.005, 0.010, 0.020]
const allowedFrequency  = [0.8, 1.0, 1.2, 1.5]

function snap(v: unknown, allowed: number[]): number | null {
  const n = Number(v)
  if (Number.isNaN(n)) return null
  const m = allowed.find(a => Math.abs(a - n) < 1e-6)
  return m ?? null
}

interface IncomingPref {
  category?: unknown
  subcategory?: unknown
  preference_name?: unknown
  detail?: unknown
  verbatim_quote?: unknown
  s0?: unknown
  confidence?: unknown
  lambda?: unknown
  frequency?: unknown
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const loggedBy = user?.email || user?.id || 'unknown'

  let body: { member_no?: unknown; preferences?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const member_no = typeof body.member_no === 'string' ? body.member_no.trim() : ''
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  if (!Array.isArray(body.preferences) || body.preferences.length === 0) {
    return NextResponse.json({ error: 'preferences must be a non-empty array' }, { status: 400 })
  }
  if (body.preferences.length > 500) {
    return NextResponse.json({ error: 'too many preferences in one batch' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows: Array<Record<string, unknown>> = []
  const errors: Array<{ index: number; reason: string }> = []

  ;(body.preferences as IncomingPref[]).forEach((p, i) => {
    try {
      const category = String(p.category || '').trim()
      if (!allowedCategories.has(category)) throw new Error(`category invalid: ${category}`)
      const preference_name = String(p.preference_name || '').trim()
      if (!preference_name) throw new Error('preference_name required')
      const s0 = Number(p.s0)
      if (!Number.isInteger(s0) || s0 < 1 || s0 > 5) throw new Error('s0 must be integer 1..5')
      const confidence = snap(p.confidence, allowedConfidence)
      if (confidence == null) throw new Error('confidence out of allowed set')
      const lambda = snap(p.lambda, allowedLambda)
      if (lambda == null) throw new Error('lambda out of allowed set')
      const frequency = snap(p.frequency, allowedFrequency)
      if (frequency == null) throw new Error('frequency out of allowed set')

      rows.push({
        member_no,
        category,
        subcategory:    p.subcategory    ? String(p.subcategory).slice(0, 200)    : null,
        preference_name,
        detail:         p.detail         ? String(p.detail).slice(0, 2000)        : null,
        verbatim_quote: p.verbatim_quote ? String(p.verbatim_quote).slice(0, 2000) : null,
        s0, confidence, lambda, frequency,
        last_validated:   today,
        validation_count: 1,
        source:           'Interview',
        contradiction:    false,
        logged_by:        loggedBy,
        created_date:     today,
        status:           'active',
        last_event_timestamp: new Date().toISOString(),
      })
    } catch (e) {
      errors.push({ index: i, reason: (e as Error).message })
    }
  })

  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', errors }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Chunk to stay under PostgREST payload limits even though rows is small.
  let inserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await sb.from('preferences').insert(chunk)
    if (error) {
      return NextResponse.json({ error: error.message, inserted }, { status: 500 })
    }
    inserted += chunk.length
  }

  return NextResponse.json({ ok: true, inserted })
}
