import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/mis/candidates[?status=pending|accepted|rejected&member_no=…]
//
// Lists preference candidates with member name resolved + the source
// observation snippet (so the reviewer can see the evidence behind the
// suggestion in one glance).

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const memberNo = searchParams.get('member_no')

  const sb = svc()
  let q = sb.from('preference_candidates').select('*').order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  if (memberNo) q = q.eq('member_no', memberNo)
  const { data: candidates, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = candidates || []
  if (list.length === 0) return NextResponse.json({ candidates: [] })

  // Resolve member names + source observation in two batched lookups.
  const memberNos = Array.from(new Set(list.map(c => c.member_no)))
  const obsIds    = list.map(c => c.source_observation_id).filter((x): x is string => !!x)

  const [{ data: members }, { data: observations }] = await Promise.all([
    sb.from('members').select('member_no, full_name, nickname, tier').in('member_no', memberNos),
    obsIds.length
      ? sb.from('harmony_observations').select('observation_id, visit_id, observation, sentiment, category, created_at').in('observation_id', obsIds)
      : Promise.resolve({ data: [] as Array<{ observation_id: string; visit_id: string; observation: string; sentiment: string; category: string | null; created_at: string }> }),
  ])

  const memberMap = new Map((members || []).map(m => [m.member_no, m] as const))
  const obsMap = new Map((observations || []).map(o => [o.observation_id, o] as const))

  const enriched = list.map(c => ({
    ...c,
    member: memberMap.get(c.member_no) || null,
    source_observation: c.source_observation_id ? obsMap.get(c.source_observation_id) || null : null,
  }))

  return NextResponse.json({ candidates: enriched })
}
