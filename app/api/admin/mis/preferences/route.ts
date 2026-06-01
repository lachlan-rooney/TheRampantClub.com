import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// MIS Pass 1 — preferences for a single member, read from preference_scores
// so PS(t), score_health_pct, and needs_revalidation come pre-computed.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const member_no = req.nextUrl.searchParams.get('member_no')
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the member's own row too, so the profile page has both panes from one call.
  const [{ data: member, error: mErr }, { data: preferences, error: pErr }] = await Promise.all([
    sb.from('members')
      .select('member_no, full_name, nickname, tier, status, join_date, birthday, email, phone, referred_by, created_at')
      .eq('member_no', member_no)
      .maybeSingle(),
    sb.from('preference_scores')
      .select('preference_id, category, subcategory, preference_name, detail, verbatim_quote, s0, confidence, lambda, frequency, last_validated, validation_count, days_since, ps_t, score_health_pct, needs_revalidation, source, contradiction, logged_by, created_date')
      .eq('member_no', member_no)
      .order('s0', { ascending: false })
      .order('ps_t', { ascending: false }),
  ])

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })

  return NextResponse.json({ member, preferences: preferences || [] })
}
