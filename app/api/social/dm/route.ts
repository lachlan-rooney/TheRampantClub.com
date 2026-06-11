import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// The member's direct (member↔member) threads. Read via the SESSION client so RLS
// (can_read_thread) honours block severance — a blocked direct thread simply isn't
// returned. Enriched server-side (other party's name; profiles RLS blocks cross-
// member reads). Also returns the member's block list (with names) for management.

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ threads: [], blocked: [] })
  const a = svc()

  // Readable direct threads (severed ones excluded by RLS).
  const { data: threads } = await actor.sb.from('threads').select('id, last_message_at').eq('kind', 'direct')
  const ids = (threads || []).map(t => t.id)

  const out: { thread_id: string; other_name: string; last_preview: string; last_at: string | null; unread: number }[] = []
  if (ids.length) {
    const { data: parts } = await actor.sb.from('thread_participants').select('thread_id, participant, last_read_at').in('thread_id', ids)
    const { data: msgs } = await a.from('messages').select('thread_id, sender, body, created_at').in('thread_id', ids).order('created_at', { ascending: true })

    const otherOf: Record<string, string> = {}, myReadAt: Record<string, string | null> = {}
    for (const p of parts || []) {
      if (p.participant === actor.id) myReadAt[p.thread_id] = p.last_read_at
      else otherOf[p.thread_id] = p.participant
    }
    const otherIds = [...new Set(Object.values(otherOf))]
    const nameOf: Record<string, string> = {}
    if (otherIds.length) { const { data: profs } = await a.from('profiles').select('id, display_name').in('id', otherIds); for (const p of profs || []) nameOf[p.id] = p.display_name || 'A member' }

    for (const t of threads || []) {
      const tm = (msgs || []).filter(m => m.thread_id === t.id)
      const last = tm[tm.length - 1]
      const readAt = myReadAt[t.id] ? new Date(myReadAt[t.id]!).getTime() : 0
      const unread = tm.filter(m => m.sender !== actor.id && new Date(m.created_at).getTime() > readAt).length
      out.push({ thread_id: t.id, other_name: nameOf[otherOf[t.id]] || 'A member', last_preview: last ? last.body.slice(0, 80) : '', last_at: last?.created_at ?? t.last_message_at ?? null, unread })
    }
    out.sort((x, y) => new Date(y.last_at || 0).getTime() - new Date(x.last_at || 0).getTime())
  }

  // Block list (own; names resolved service-side).
  const { data: blocks } = await a.from('member_blocks').select('blocked').eq('blocker', actor.id)
  const blockedIds = (blocks || []).map(b => b.blocked)
  const blocked: { id: string; name: string }[] = []
  if (blockedIds.length) {
    const { data: bp } = await a.from('profiles').select('id, display_name').in('id', blockedIds)
    for (const p of bp || []) blocked.push({ id: p.id, name: p.display_name || 'A member' })
  }

  return NextResponse.json({ threads: out, blocked })
}
