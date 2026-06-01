import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// MIS Pass 1 — member list endpoint.
// Returns every member from public.members along with a small per-member
// summary computed from preference_scores (counts of active prefs, score-5s,
// prefs flagged for revalidation). Admin-only via cookie session check, then
// service role to query under RLS.

export const dynamic = 'force-dynamic'

interface MemberRow {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  join_date: string | null
  birthday: string | null
  email: string | null
  phone: string | null
  referred_by: string | null
}

interface PreferenceScoreRow {
  member_no: string
  s0: number
  ps_t: number
  needs_revalidation: string
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: members, error: mErr } = await sb
    .from('members')
    .select('member_no, full_name, nickname, tier, status, join_date, birthday, email, phone, referred_by')
    .order('member_no', { ascending: true })

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Per-member rollup from preference_scores. Single fetch then group in JS so
  // we hit Postgres once for the whole list.
  const { data: scores, error: sErr } = await sb
    .from('preference_scores')
    .select('member_no, s0, ps_t, needs_revalidation')

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  const rollup: Record<string, { active: number; score_5s: number; needs_revalidation: number; avg_ps: number }> = {}
  for (const s of (scores as PreferenceScoreRow[]) || []) {
    const r = rollup[s.member_no] ||= { active: 0, score_5s: 0, needs_revalidation: 0, avg_ps: 0 }
    r.active += 1
    if (s.s0 === 5) r.score_5s += 1
    if (s.needs_revalidation && s.needs_revalidation.includes('REVALIDATE')) r.needs_revalidation += 1
    r.avg_ps += Number(s.ps_t) || 0
  }
  for (const k of Object.keys(rollup)) {
    rollup[k].avg_ps = Math.round((rollup[k].avg_ps / Math.max(rollup[k].active, 1)) * 100) / 100
  }

  const enriched = (members as MemberRow[]).map(m => ({
    ...m,
    stats: rollup[m.member_no] || { active: 0, score_5s: 0, needs_revalidation: 0, avg_ps: 0 },
  }))

  return NextResponse.json({ members: enriched })
}
