import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { DESIGNED_LAMBDA, CANONICAL_CATEGORIES } from '@/lib/mis/decay-priors'

// GET /api/admin/mis/decay-fit
//
// Returns everything the /admin/decay-fit page renders, in one shot:
//   - latest proposal row per canonical category (or null if none yet)
//   - active row per category (status='active') so we can show designed vs
//     promoted vs newly-proposed side-by-side
//   - recent decisions audit (last 50)
//   - designed-λ map (the prior centres) so the page can render
//     designed-vs-learned distance without re-importing constants client-side.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface LdcRow {
  id: string
  category: string
  learned_lambda: number
  designed_lambda: number
  lambda_ci_lower: number | null
  lambda_ci_upper: number | null
  n_observations: number
  n_events: number
  half_life_days: number | null
  fit_timestamp: string
  status: string | null
  ci_relative_width: number | null
  meets_event_floor: boolean | null
  ci_narrow_enough: boolean | null
  notes: string | null
}

interface DecisionRow {
  decision_id: string
  category: string
  proposal_row_id: string
  decision: 'accept' | 'reject'
  previous_status: string | null
  previous_lambda: number | null
  new_status: string | null
  new_lambda: number | null
  decided_by: string
  decided_at: string
  note: string | null
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  const [{ data: allRows, error: rowsErr }, { data: decisions, error: decErr }, { count: totalEvents }] = await Promise.all([
    sb.from('learned_decay_constants')
      .select('id, category, learned_lambda, designed_lambda, lambda_ci_lower, lambda_ci_upper, n_observations, n_events, half_life_days, fit_timestamp, status, ci_relative_width, meets_event_floor, ci_narrow_enough, notes')
      .order('fit_timestamp', { ascending: false })
      .limit(500),
    sb.from('decay_proposal_decisions')
      .select('decision_id, category, proposal_row_id, decision, previous_status, previous_lambda, new_status, new_lambda, decided_by, decided_at, note')
      .order('decided_at', { ascending: false })
      .limit(50),
    sb.from('validation_events').select('event_id', { count: 'exact', head: true }),
  ])

  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 })
  if (decErr)  return NextResponse.json({ error: decErr.message  }, { status: 500 })

  const rows = (allRows || []) as LdcRow[]

  // Build category → { active, latestProposal, history } from the full row dump.
  type CategorySlice = {
    category: string
    designedLambda: number
    active: LdcRow | null
    latestProposal: LdcRow | null
    history: LdcRow[]
  }
  const byCat = new Map<string, CategorySlice>()
  for (const cat of CANONICAL_CATEGORIES) {
    byCat.set(cat, {
      category: cat,
      designedLambda: DESIGNED_LAMBDA[cat],
      active: null,
      latestProposal: null,
      history: [],
    })
  }
  for (const r of rows) {
    const slice = byCat.get(r.category)
    if (!slice) continue
    slice.history.push(r)
    if (r.status === 'active' && !slice.active) slice.active = r
    if ((r.status === 'proposed' || r.status === 'insufficient_data') && !slice.latestProposal) {
      slice.latestProposal = r
    }
  }

  const categories = CANONICAL_CATEGORIES.map(c => byCat.get(c)!)

  return NextResponse.json({
    categories,
    decisions: (decisions || []) as DecisionRow[],
    total_validation_events: totalEvents ?? 0,
    designed_lambda: DESIGNED_LAMBDA,
  })
}
