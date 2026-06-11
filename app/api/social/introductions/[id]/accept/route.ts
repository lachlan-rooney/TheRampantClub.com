import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit, notify } from '@/lib/social/server'

// Accept an introduction → open the direct thread. Recipient-only, pending-only.
// Thread + BOTH participant rows created atomically (the S1 lesson — both or
// neither, so each party can read it immediately). Notifies the requester (now
// they learn it succeeded). The DECLINE path never notifies — silence.

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const { id } = await params
  const a = svc()

  const { data: intro } = await a.from('introductions').select('id, requester, recipient, status, thread_id').eq('id', id).maybeSingle()
  if (!intro || intro.recipient !== actor.id || intro.status !== 'pending') return NextResponse.json({ error: 'No such introduction.' }, { status: 404 })

  const th = await a.from('threads').insert({ kind: 'direct', created_by: intro.requester, introduction_id: id }).select('id').single()
  if (th.error) return NextResponse.json({ error: 'Could not open the thread.' }, { status: 500 })
  const pr = await a.from('thread_participants').insert([
    { thread_id: th.data.id, participant: intro.requester, role: 'member' },
    { thread_id: th.data.id, participant: intro.recipient, role: 'member' },
  ])
  if (pr.error) { await a.from('threads').delete().eq('id', th.data.id); return NextResponse.json({ error: 'Could not open the thread.' }, { status: 500 }) }

  await a.from('introductions').update({ status: 'accepted', thread_id: th.data.id, decided_at: new Date().toISOString() }).eq('id', id)
  await socialEmit(actor.sb, 'introduction.accepted', 'introduction', id, {})
  await notify(a, intro.requester, 'introduction_accepted', { link: '/members/messages', label: 'An introduction was accepted' })
  return NextResponse.json({ thread_id: th.data.id })
}
