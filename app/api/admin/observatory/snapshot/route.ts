import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { DESIGNED_LAMBDA, CANONICAL_CATEGORIES } from '@/lib/mis/extraction-decay'

// Observatory snapshot — single read serving Panel 1 (live decomposition +
// breadth table), Panel 2 (category posteriors), Panel 3 (baseline inheritance),
// Panel 5 (aggregate vitals).
//
// Read-only. All reads are existing rows/views; no joins beyond name resolution.
// The page recomputes PS(t) client-side via live-pst.ts on a 1s timer from these
// stored inputs — no DB poll for decay creep.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface PreferenceRow {
  preference_id: string
  member_no: string
  category: string
  preference_name: string
  detail: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  validation_count: number
  last_validated: string | null
  lambda_origin: string | null
  status: string
}

interface MemberRow { member_no: string; full_name: string; nickname: string | null }
interface MemberStatRow { member_no: string; avg_visits_per_month: number | null }
interface LdcRow {
  id: string; category: string;
  designed_lambda: number; learned_lambda: number;
  lambda_ci_lower: number | null; lambda_ci_upper: number | null;
  n_events: number; n_observations: number;
  status: string | null; ci_relative_width: number | null;
  meets_event_floor: boolean | null; ci_narrow_enough: boolean | null;
  fit_timestamp: string;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  const [prefsRes, membersRes, statsRes, ldcRes, eventsCountRes, flagRes] = await Promise.all([
    sb.from('preferences')
      .select('preference_id, member_no, category, preference_name, detail, s0, confidence, lambda, frequency, validation_count, last_validated, lambda_origin, status')
      .eq('status', 'active')
      .order('category', { ascending: true })
      .limit(2000),
    sb.from('members').select('member_no, full_name, nickname').order('full_name'),
    sb.from('member_stats').select('member_no, avg_visits_per_month'),
    sb.from('learned_decay_constants')
      .select('id, category, designed_lambda, learned_lambda, lambda_ci_lower, lambda_ci_upper, n_events, n_observations, status, ci_relative_width, meets_event_floor, ci_narrow_enough, fit_timestamp')
      .order('fit_timestamp', { ascending: false })
      .limit(500),
    sb.from('validation_events').select('event_id', { count: 'exact', head: true }),
    // THE REVALIDATION FLAG COMES FROM THE VIEW, NOT FROM ARITHMETIC HERE.
    // This route used to recompute PS(t) inline to decide the flag, with M
    // pinned to 1.0 and a comment saying "exact numerics not needed" — even
    // though it fetches member_stats two lines above and had the real M to
    // hand. M is 0.8 / 0.81 / 1.09 in the live data and never 1.0, so the
    // inline score was always low-biased, which under-flags. It happens not to
    // change today's count because all 159 preferences are flagged on the
    // day-count rules anyway, so the bug was latent rather than visible —
    // which is exactly how it survived. preference_scores filters on
    // status = 'active', the same filter as the query above.
    sb.from('preference_scores').select('preference_id, needs_revalidation').limit(2000),
  ])

  if (prefsRes.error)    return NextResponse.json({ error: prefsRes.error.message    }, { status: 500 })
  if (membersRes.error)  return NextResponse.json({ error: membersRes.error.message  }, { status: 500 })
  if (statsRes.error)    return NextResponse.json({ error: statsRes.error.message    }, { status: 500 })
  if (ldcRes.error)      return NextResponse.json({ error: ldcRes.error.message      }, { status: 500 })
  if (flagRes.error)     return NextResponse.json({ error: flagRes.error.message     }, { status: 500 })

  const preferences = (prefsRes.data || []) as PreferenceRow[]
  const members     = (membersRes.data || []) as MemberRow[]
  const stats       = (statsRes.data || [])   as MemberStatRow[]
  const ldcAll      = (ldcRes.data || [])     as LdcRow[]
  const totalEvents = eventsCountRes.count ?? 0

  // Index stats by member.
  const statByMember = new Map(stats.map(s => [s.member_no, s.avg_visits_per_month ?? null] as const))

  // Per-member active pref count (so the picker can sort by activity).
  const prefCount = new Map<string, number>()
  for (const p of preferences) prefCount.set(p.member_no, (prefCount.get(p.member_no) || 0) + 1)

  const memberSummaries = members
    .map(m => ({
      member_no: m.member_no,
      full_name: m.full_name,
      nickname:  m.nickname,
      avg_visits_per_month: statByMember.get(m.member_no) ?? null,
      active_pref_count: prefCount.get(m.member_no) || 0,
    }))
    .filter(m => m.active_pref_count > 0)
    .sort((a, b) => b.active_pref_count - a.active_pref_count || a.full_name.localeCompare(b.full_name))

  // Per-category LDC slice for Panels 2 / 3 — always one row per canonical
  // category. If no LDC row exists yet for a category (today's state), the
  // slice still appears so Panel 2 can render the honest empty case: posterior
  // equals the designed prior, 0/20 events, status='no fit yet'.
  type CatSlice = {
    category: string
    designed_lambda: number
    active: LdcRow | null
    latestProposal: LdcRow | null  // 'proposed' or 'insufficient_data'
    latestAny: LdcRow | null
  }
  const byCat = new Map<string, CatSlice>()
  for (const cat of CANONICAL_CATEGORIES) {
    byCat.set(cat, {
      category: cat,
      designed_lambda: DESIGNED_LAMBDA[cat],
      active: null, latestProposal: null, latestAny: null,
    })
  }
  for (const r of ldcAll) {
    const slice = byCat.get(r.category)
    if (!slice) continue
    if (!slice.latestAny) slice.latestAny = r
    if (r.status === 'active' && !slice.active) slice.active = r
    if ((r.status === 'proposed' || r.status === 'insufficient_data') && !slice.latestProposal) {
      slice.latestProposal = r
    }
  }
  const categories = CANONICAL_CATEGORIES.map(c => byCat.get(c)!)

  // Vitals — Panel 5.
  const medicalLocked = preferences.filter(p => p.lambda === 0 || p.lambda_origin === 'forced_medical').length
  // Counted from the view's own verdict. The rule — PS(t) < 0.7·S0, or more
  // than 180 days, or S0 ≥ 4 and more than 90 — is stated once, in SQL, in
  // preference_scores.needs_revalidation. Nothing here reimplements it.
  const flaggedIds = new Set(
    (flagRes.data || [])
      .filter((r: { needs_revalidation: string | null }) => (r.needs_revalidation || '').includes('REVALIDATE'))
      .map((r: { preference_id: string }) => r.preference_id),
  )
  const flaggedForRevalidation = preferences.filter(p => flaggedIds.has(p.preference_id)).length
  const totalExposureDays = preferences.reduce((acc, p) => {
    if (!p.last_validated) return acc
    const d = Math.max(0, Math.floor((Date.now() - Date.parse(p.last_validated)) / 86400000))
    return acc + d
  }, 0)
  const lambdaOriginBreakdown = preferences.reduce((acc, p) => {
    const k = p.lambda_origin || '(null)'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const categoryStatusCounts = {
    active:            categories.filter(c => c.active !== null).length,
    proposed:          categories.filter(c => c.latestProposal?.status === 'proposed').length,
    insufficient_data: categories.filter(c => c.latestProposal?.status === 'insufficient_data').length,
    no_fit_yet:        categories.filter(c => c.latestAny === null).length,
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    members: memberSummaries,
    preferences,
    categories,
    vitals: {
      active_preferences: preferences.length,
      total_exposure_days: totalExposureDays,
      medical_locked: medicalLocked,
      flagged_for_revalidation: flaggedForRevalidation,
      lambda_origin_breakdown: lambdaOriginBreakdown,
      category_status_counts: categoryStatusCounts,
      total_validation_events: totalEvents,
    },
  })
}
