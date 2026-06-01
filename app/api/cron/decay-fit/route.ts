import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { fitAllCategories, type Spell, type CategoryPosterior } from '@/lib/mis/decay-survival'
import { buildPriorMap, DESIGNED_LAMBDA, CANONICAL_CATEGORIES } from '@/lib/mis/decay-priors'

// POST/GET /api/cron/decay-fit[?dry=1]
//
// Monthly Bayesian λ-fit for the preference-decay model. Pulls survival spells
// from the three v_decay_* views (lambda > 0 already filtered there), runs the
// Gamma-conjugate posterior per category, and writes one proposal row per
// canonical category to learned_decay_constants with status set from the
// recommendation (proposed | insufficient_data; medical excludes are skipped
// entirely — they're not categories, see decay-priors.ts).
//
// Day-one behaviour: zero validation_events means every fit returns
// insufficient_data with priorOnly posteriors. That's the honest stance, not
// a fault. The cron writes the heartbeat regardless so /admin/decay-fit has
// a row to render.
//
// Authentication mirrors weekly-digest: X-CRON-SECRET header (Vercel) or
// authenticated admin (manual "Run fit now").
//
// Vercel Cron config: 0 4 1 * * = 04:00 UTC on the 1st of every month
// (≈ 11:00 Vietnam, well clear of the Sunday digest at 11:00 UTC).

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function authed(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (process.env.CRON_SECRET && headerSecret && headerSecret === process.env.CRON_SECRET) return true
  return await isAdmin()
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest)  { return handle(req) }

async function handle(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dry = searchParams.get('dry') === '1'

  const sb = svc()

  // ── 1. Pull sufficient statistics from the three views ──────────────
  // Each contradiction is an event-spell (event=true). Each confirmation
  // and each live exposure is a censored survival (event=false). The
  // views already filter lambda > 0, so medical preferences are excluded.
  const [contradictions, confirmations, liveExposure] = await Promise.all([
    sb.from('v_decay_contradictions').select('category, days'),
    sb.from('v_decay_confirmations').select('category, days'),
    sb.from('v_decay_live_exposure').select('category, days'),
  ])

  if (contradictions.error || confirmations.error || liveExposure.error) {
    return NextResponse.json({
      ok: false,
      error: 'view read failed',
      detail: {
        contradictions: contradictions.error?.message,
        confirmations: confirmations.error?.message,
        liveExposure: liveExposure.error?.message,
      },
    }, { status: 500 })
  }

  const spells: Spell[] = []
  for (const r of contradictions.data || []) spells.push({ category: String(r.category), days: Number(r.days), event: true })
  for (const r of confirmations.data  || []) spells.push({ category: String(r.category), days: Number(r.days), event: false })
  for (const r of liveExposure.data    || []) spells.push({ category: String(r.category), days: Number(r.days), event: false })

  // ── 2. Run the fit ──────────────────────────────────────────────────
  const priors = buildPriorMap()
  const { results, hyperprior } = fitAllCategories(spells, priors, {
    eventFloor: 20,
    ciMaxRelWidth: 1.0,
    useEmpiricalBayes: true,
  })

  const fitTimestamp = new Date().toISOString()

  // ── 3. Build proposal rows — one per canonical category ─────────────
  // recommendation maps to status:
  //   'propose'           → 'proposed'           (clears floor + CI gate)
  //   'insufficient_data' → 'insufficient_data'  (heartbeat row, no promotion)
  //   'excluded'          → never reaches here  (no medical category exists)
  const rowsToInsert = results
    .filter(r => !r.excluded)
    .map(r => ({
      category:         r.category,
      learned_lambda:   round6(r.learnedLambda),
      designed_lambda:  round6(r.designedLambda),
      lambda_ci_lower:  round6(r.lambdaCI95[0]),
      lambda_ci_upper:  round6(r.lambdaCI95[1]),
      n_observations:   r.nSpells,
      n_events:         r.nEvents,
      half_life_days:   isFinite(r.halfLifeDays) ? round2(r.halfLifeDays) : null,
      fit_timestamp:    fitTimestamp,
      status:           r.recommendation === 'propose' ? 'proposed' : 'insufficient_data',
      ci_relative_width: isFinite(r.ciRelativeWidth) ? round4(r.ciRelativeWidth) : null,
      meets_event_floor: r.meetsEventFloor,
      ci_narrow_enough:  r.ciNarrowEnough,
      notes: noteFor(r, hyperprior.activated),
    }))

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      fit_timestamp: fitTimestamp,
      hyperprior,
      canonical_categories: CANONICAL_CATEGORIES,
      designed_lambda: DESIGNED_LAMBDA,
      results,
      rowsToInsert,
    })
  }

  // ── 4. Write proposals ──────────────────────────────────────────────
  if (rowsToInsert.length > 0) {
    const { error } = await sb.from('learned_decay_constants').insert(rowsToInsert)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    fit_timestamp: fitTimestamp,
    proposals_written: rowsToInsert.length,
    propose_count: rowsToInsert.filter(r => r.status === 'proposed').length,
    insufficient_count: rowsToInsert.filter(r => r.status === 'insufficient_data').length,
    hyperprior_activated: hyperprior.activated,
    hyperprior_note: hyperprior.note,
  })
}

function round2(n: number): number { return Math.round(n * 1e2) / 1e2 }
function round4(n: number): number { return Math.round(n * 1e4) / 1e4 }
function round6(n: number): number { return Math.round(n * 1e6) / 1e6 }

function noteFor(r: CategoryPosterior, hyperpriorActive: boolean): string {
  const parts: string[] = []
  parts.push(`d=${r.nEvents}, T=${r.totalExposureDays.toFixed(0)}d across ${r.nSpells} spells`)
  parts.push(`prior=Gamma(α=${r.priorAlpha.toPrecision(3)}, β=${r.priorBeta.toPrecision(3)})`)
  parts.push(`post=Gamma(α=${r.postAlpha.toPrecision(3)}, β=${r.postBeta.toPrecision(3)})`)
  if (!r.meetsEventFloor) parts.push(`event floor not met (${r.nEvents}/20)`)
  if (!r.ciNarrowEnough && isFinite(r.ciRelativeWidth)) parts.push(`CI rel-width ${r.ciRelativeWidth.toFixed(2)} > 1.00`)
  if (hyperpriorActive) parts.push('empirical-Bayes pooling active')
  return parts.join(' · ')
}
