import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// The staff concierge inbox: every member↔Club thread, with the ops-honesty signal
// — RESPONSE AGE (time since the member's last unanswered message). A thread is
// "awaiting" when its last message is from the member. Admin-gated.

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()

  const { data: threads } = await a.from('threads').select('id, last_message_at').eq('kind', 'concierge')
  const ids = (threads || []).map(t => t.id)
  if (!ids.length) return NextResponse.json({ threads: [] })

  const { data: parts } = await a.from('thread_participants').select('thread_id, participant, role').in('thread_id', ids)
  const { data: msgs } = await a.from('messages').select('thread_id, sender, body, created_at').in('thread_id', ids).order('created_at', { ascending: true })

  // member participant per thread → member name + no.
  const memberOf: Record<string, string> = {}
  for (const p of parts || []) if (p.role === 'member') memberOf[p.thread_id] = p.participant
  const memberIds = [...new Set(Object.values(memberOf))]
  const { data: profs } = await a.from('profiles').select('id, display_name, member_no').in('id', memberIds.length ? memberIds : ['_'])
  const profOf: Record<string, { name: string; member_no: string | null }> = {}
  for (const p of profs || []) profOf[p.id] = { name: p.display_name || 'Member', member_no: p.member_no }

  // last message per thread.
  const last: Record<string, { sender: string; body: string; created_at: string }> = {}
  for (const m of msgs || []) last[m.thread_id] = m   // ordered asc → last wins

  const rows = (threads || []).map(t => {
    const memberId = memberOf[t.id]
    const prof = memberId ? profOf[memberId] : undefined
    const lm = last[t.id]
    const awaiting = !!lm && lm.sender === memberId   // last word is the member's → unanswered
    return {
      thread_id: t.id,
      member_no: prof?.member_no ?? null,
      member_name: prof?.name ?? 'Member',
      last_preview: lm ? lm.body.slice(0, 120) : '',
      last_at: lm?.created_at ?? t.last_message_at ?? null,
      awaiting,
      awaiting_since: awaiting ? lm!.created_at : null,
    }
  })
  // Awaiting first (oldest wait = most urgent), then answered by recency.
  rows.sort((x, y) => {
    if (x.awaiting !== y.awaiting) return x.awaiting ? -1 : 1
    if (x.awaiting) return new Date(x.awaiting_since!).getTime() - new Date(y.awaiting_since!).getTime()
    return new Date(y.last_at || 0).getTime() - new Date(x.last_at || 0).getTime()
  })
  return NextResponse.json({ threads: rows })
}
