import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'
import { isMedicalPreference, type ExtractedPreference } from '@/lib/mis/extraction-decay'

// MIS Pass 4 — Bulk-save of reconciled preferences.
//
// The intake stream reconciles the AI output and the client edits the
// reconciled list before sending it here. This route is the write boundary
// for the preferences table, so it re-asserts the two invariants that the
// UI displays but cannot, alone, guarantee:
//
//   1. MEDICAL LOCK RE-ASSERTION. Every incoming row is re-tested with the
//      same content-based isMedicalPreference predicate the reconcile step
//      uses. If a row tests medical at save time but arrives without forced
//      values (admin edited it, or a malformed client payload tampered),
//      the row is re-forced to s0=5 / C=1.00 / lambda=0 / lambda_origin=
//      'forced_medical'. The lock must survive the confirm step — an allergy
//      the admin can accidentally un-force is the same safety hole as the
//      one we already closed at the reconcile boundary.
//
//   2. NON-NULL lambda_origin. Every Pass-4-written row must carry one of the
//      four origins ('ai_specific' | 'category_baseline_learned' |
//      'category_baseline_designed' | 'forced_medical'). The column is the
//      audit trail and the loop-closure evidence; a silent null defeats both.
//      If any row arrives without a valid origin, the whole batch fails with
//      a per-row error rather than silently writing a null.
//
// The numeric allowed-sets are still snapped (defense in depth against a
// malformed client payload), and every other field is shape-validated.

export const dynamic = 'force-dynamic'

const allowedCategories = new Set([
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
])
const allowedConfidence = [1.00, 0.75, 0.50, 0.25]
const allowedLambda     = [0.000, 0.002, 0.005, 0.010, 0.020]
const allowedFrequency  = [0.8, 1.0, 1.2, 1.5]
const allowedOrigin = new Set([
  'ai_specific', 'category_baseline_learned', 'category_baseline_designed', 'forced_medical',
])

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
  lambda_origin?: unknown
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

  const today = vnDateString()
  const rows: Array<Record<string, unknown>> = []
  const errors: Array<{ index: number; reason: string }> = []
  let medicalReforced = 0

  ;(body.preferences as IncomingPref[]).forEach((p, i) => {
    try {
      const category = String(p.category || '').trim()
      if (!allowedCategories.has(category)) throw new Error(`category invalid: ${category}`)
      const preference_name = String(p.preference_name || '').trim()
      if (!preference_name) throw new Error('preference_name required')

      // ── Medical lock re-assertion ─────────────────────────────────
      // Run the same content-based detection reconcile uses. If it triggers,
      // the row is forced to medical regardless of what the client sent.
      // This closes the gap where a malformed client payload could send
      // unlocked values for a row the UI displayed as locked.
      const previewPref: ExtractedPreference = {
        category,
        subcategory:     typeof p.subcategory     === 'string' ? p.subcategory     : undefined,
        preference_name,
        detail:          typeof p.detail          === 'string' ? p.detail          : undefined,
        verbatim_quote:  typeof p.verbatim_quote  === 'string' ? p.verbatim_quote  : undefined,
      }
      const detectedMedical = isMedicalPreference(previewPref)

      let s0: number
      let confidence: number
      let lambda: number
      let lambda_origin: string

      if (detectedMedical) {
        s0 = 5; confidence = 1.00; lambda = 0.000; lambda_origin = 'forced_medical'
        // Count only the rows we had to FORCE — rows that already arrived
        // with the forced values aren't counted as a re-assertion.
        const arrivedForced =
          Number(p.s0) === 5 &&
          snap(p.confidence, allowedConfidence) === 1.00 &&
          snap(p.lambda, allowedLambda) === 0.000 &&
          p.lambda_origin === 'forced_medical'
        if (!arrivedForced) medicalReforced++
      } else {
        const s0In = Number(p.s0)
        if (!Number.isInteger(s0In) || s0In < 1 || s0In > 5) throw new Error('s0 must be integer 1..5')
        s0 = s0In
        const c = snap(p.confidence, allowedConfidence)
        if (c == null) throw new Error('confidence out of allowed set')
        confidence = c
        const l = snap(p.lambda, allowedLambda)
        if (l == null) throw new Error('lambda out of allowed set')
        lambda = l
        // lambda_origin must be a valid non-medical origin. 'forced_medical' is
        // only legal when isMedicalPreference fires — a row labelled medical
        // by the client without content signal is rejected, so a hand-crafted
        // payload can't smuggle the forced values onto a non-medical row.
        const origin = typeof p.lambda_origin === 'string' ? p.lambda_origin : ''
        if (!allowedOrigin.has(origin)) throw new Error(`lambda_origin invalid: "${origin}"`)
        if (origin === 'forced_medical') throw new Error('forced_medical origin requires medical content signal')
        lambda_origin = origin
      }

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
        lambda_origin,
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

  // Defence-in-depth: every row about to insert must have a non-null origin.
  // Should be impossible given the per-row branches above, but a missing
  // lambda_origin is silent corruption of the audit trail, so we re-check.
  const nullOrigins = rows.filter(r => !r.lambda_origin).map((_, i) => i)
  if (nullOrigins.length > 0) {
    return NextResponse.json({
      error: 'lambda_origin null on rows — refusing to write',
      indexes: nullOrigins,
    }, { status: 500 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let inserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await sb.from('preferences').insert(chunk)
    if (error) {
      return NextResponse.json({ error: error.message, inserted, medicalReforced }, { status: 500 })
    }
    inserted += chunk.length
  }

  return NextResponse.json({ ok: true, inserted, medicalReforced })
}
