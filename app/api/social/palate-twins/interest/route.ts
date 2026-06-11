import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit, notify } from '@/lib/social/server'
import { decryptMatch } from '@/lib/social/match-token'

// Express interest in an anonymous palate match → creates a MASKED introduction
// (via='palate_match'), reusing all of S2c's gracious machinery. ALWAYS returns
// neutral { status:'pending' } — block, re-request (23505), or success look
// identical. The recipient sees "a member whose palate is N% yours", NOT the
// requester, until they accept (the double-blind).

export const dynamic = 'force-dynamic'
const NEUTRAL = { status: 'pending' as const }

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const p = await req.json().catch(() => null)
  const token: unknown = p?.token
  if (typeof token !== 'string') return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  const target = decryptMatch(actor.id, token)
  if (!target || target === actor.id) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  const a = svc()

  // both must still hold the consent (mutual opt-in)
  const { data: cons } = await a.from('member_consents').select('member').eq('feature', 'palate_twin').eq('enabled', true).in('member', [actor.id, target])
  if ((cons || []).length < 2) return NextResponse.json(NEUTRAL)

  // block → neutral, no insert
  const { data: blk } = await a.from('member_blocks').select('blocker')
    .or(`and(blocker.eq.${actor.id},blocked.eq.${target}),and(blocker.eq.${target},blocked.eq.${actor.id})`).maybeSingle()
  if (blk) return NextResponse.json(NEUTRAL)

  // rate-limit (shared with directory intros)
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('introductions').select('id', { count: 'exact', head: true }).eq('requester', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 15) return NextResponse.json({ error: 'You’ve reached out a few times — give it a moment.' }, { status: 429 })

  const ins = await a.from('introductions').insert({ requester: actor.id, recipient: target, status: 'pending', via: 'palate_match' }).select('id').single()
  if (ins.error) {
    if (ins.error.code === '23505') return NextResponse.json(NEUTRAL)
    return NextResponse.json({ error: 'Could not send.' }, { status: 500 })
  }
  await socialEmit(actor.sb, 'introduction.requested', 'introduction', ins.data.id, { via: 'palate_match' })
  await notify(a, target, 'introduction_request', { link: '/members/introductions', label: 'An introduction awaits' })
  return NextResponse.json(NEUTRAL)
}
