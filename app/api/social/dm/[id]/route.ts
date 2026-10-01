import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { openBodySafe } from '@/lib/crypto/messages'

// One direct thread's messages. Read via the SESSION client → 404 if not readable
// (not a party, or severed by a block). Stamps the caller's last_read_at on view.

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params

  const { data: thread } = await actor.sb.from('threads').select('id, kind').eq('id', id).maybeSingle()
  if (!thread || thread.kind !== 'direct') return NextResponse.json({ error: 'No such thread.' }, { status: 404 })

  const { data: parts } = await actor.sb.from('thread_participants').select('participant').eq('thread_id', id)
  const otherId = (parts || []).map(p => p.participant).find(pid => pid !== actor.id) || null
  let other_name = 'A member'
  if (otherId) { const { data: prof } = await svc().from('profiles').select('display_name').eq('id', otherId).maybeSingle(); other_name = prof?.display_name || 'A member' }

  const { data: sealed } = await actor.sb.from('messages').select('id, sender, body, created_at').eq('thread_id', id).order('created_at', { ascending: true })
  // Opened here, for the member whose thread it is. The 'direct' scope is the
  // whole point: a concierge body handed to this call would not come back as
  // text.
  const msgs = (sealed || []).map(m => ({ ...m, body: openBodySafe(m.body, 'direct', id) }))
  // mark read (own last_read_at — the one granted column)
  await actor.sb.from('thread_participants').update({ last_read_at: new Date().toISOString() }).eq('thread_id', id).eq('participant', actor.id)

  return NextResponse.json({ other_id: otherId, other_name, messages: (msgs || []).map(m => ({ ...m, mine: m.sender === actor.id })) })
}
