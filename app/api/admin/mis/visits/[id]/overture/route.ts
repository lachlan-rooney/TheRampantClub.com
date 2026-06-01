import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/mis/visits/[id]/overture
//
// The pre-arrival brief. Assembled LIVE on read from current data — never
// cached. The spec is explicit: "Stamp overture_generated_at / _by when
// generated, for audit — but the content is always recomputed from current
// data."
//
// Brief contents (union):
//   - Score-5 non-negotiables  → preference_scores where s0=5
//   - Open revalidation flags  → preference_scores flagged ⚠ REVALIDATE
//   - Last continuum note      → last_continuum_note view (the loop closer
//                                from the previous visit)
//   - Identity + member_stats  → tier, status, days-since-last-visit,
//                                total_visits, avg_visits_per_month

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()

  const sb = svc()

  const { data: visit } = await sb.from('visits')
    .select('visit_id, member_no, visit_date, overture_generated_at, overture_generated_by')
    .eq('visit_id', id).maybeSingle()
  if (!visit) return NextResponse.json({ error: 'visit not found' }, { status: 404 })

  const member_no = visit.member_no

  const [{ data: member }, { data: stats }, { data: prefScores }, { data: lastNote }] = await Promise.all([
    sb.from('members').select('member_no, full_name, nickname, tier, status, birthday, join_date').eq('member_no', member_no).maybeSingle(),
    sb.from('member_stats').select('total_visits, last_visit, days_since_visit, avg_visits_per_month').eq('member_no', member_no).maybeSingle(),
    sb.from('preference_scores')
      .select('preference_id, category, subcategory, preference_name, detail, verbatim_quote, s0, confidence, lambda, frequency, last_validated, validation_count, ps_t, needs_revalidation, status')
      .eq('member_no', member_no)
      .eq('status', 'active')
      .order('category', { ascending: true }),
    sb.from('last_continuum_note').select('visit_id, visit_date, data_for_next_overture').eq('member_no', member_no).maybeSingle(),
  ])

  const prefs = prefScores || []
  // Spec §"The Overture brief": Score-5 non-negotiables first, then open
  // revalidation flags. needs_revalidation comes through as a label string
  // from preference_scores; the canonical "needs work" sentinel is the
  // ⚠ REVALIDATE label.
  const score5 = prefs.filter(p => Number(p.s0) === 5)
  const revalidate = prefs.filter(p => {
    const v = String(p.needs_revalidation || '').toUpperCase()
    return v.includes('REVALIDATE') || v.includes('⚠')
  })

  // Stamp the audit fields. Only fires once — the spec wants generation
  // audit, but the content itself is always live.
  if (!visit.overture_generated_at) {
    await sb.from('visits').update({
      overture_generated_at: new Date().toISOString(),
      overture_generated_by: user?.id || null,
    }).eq('visit_id', id)
  }

  return NextResponse.json({
    visit: {
      visit_id: visit.visit_id,
      visit_date: visit.visit_date,
      overture_generated_at: visit.overture_generated_at || new Date().toISOString(),
    },
    member,
    stats,
    brief: {
      score5,
      revalidate,
      last_continuum_note: lastNote || null,
    },
    // Surface every active preference too — the Accord linker needs it.
    all_preferences: prefs,
  })
}
