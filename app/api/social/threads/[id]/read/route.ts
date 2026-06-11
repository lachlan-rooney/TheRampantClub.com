import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Stamp the caller's OWN last_read_at on a thread (read receipt). last_read_at is
// the single column authenticated members may update (S0 check 7 — the column
// grant blocks role escalation). Also clears the member's concierge_reply badge.

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id: threadId } = await params

  // Via the SESSION client: RLS gates the row (own participant) + the column grant
  // gates the column (last_read_at only). Defence in depth, not service-role.
  const { error } = await actor.sb.from('thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId).eq('participant', actor.id)
  if (error) return NextResponse.json({ error: 'Could not update.' }, { status: 500 })

  // Clear the member's unread concierge badge for this thread's replies.
  await svc().from('notifications').update({ read: true, read_at: new Date().toISOString() })
    .eq('recipient', actor.id).eq('type', 'concierge_reply').eq('read', false)

  return NextResponse.json({ ok: true })
}
