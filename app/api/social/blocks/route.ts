import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Block / unblock another member. Own-write (blocker = session uid). A block
// severs any shared DIRECT thread for both (proven S0, via can_read_thread) +
// the send route refuses writes; concierge is untouched. Spine-logged.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const p = await req.json().catch(() => null)
  const target: unknown = p?.target
  const block: unknown = p?.block
  if (typeof target !== 'string' || target === actor.id || typeof block !== 'boolean') return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  const a = svc()

  if (block) {
    await a.from('member_blocks').upsert({ blocker: actor.id, blocked: target }, { onConflict: 'blocker,blocked' })
    await socialEmit(actor.sb, 'member.blocked', 'member', null, { blocked: target })
  } else {
    await a.from('member_blocks').delete().eq('blocker', actor.id).eq('blocked', target)
    await socialEmit(actor.sb, 'member.unblocked', 'member', null, { blocked: target })
  }
  return NextResponse.json({ ok: true })
}
