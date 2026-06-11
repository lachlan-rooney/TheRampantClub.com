import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// One concierge thread, staff view: its messages + the member's identity (so the
// dossier is a click away). Admin-gated. from_member flags the member's lines so
// the UI can distinguish them from The Club's.

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const a = svc()

  const { data: thread } = await a.from('threads').select('id, kind').eq('id', id).maybeSingle()
  if (!thread || thread.kind !== 'concierge') return NextResponse.json({ error: 'No such thread.' }, { status: 404 })

  const { data: parts } = await a.from('thread_participants').select('participant, role').eq('thread_id', id)
  const memberId = (parts || []).find(p => p.role === 'member')?.participant ?? null
  let member: { member_no: string | null; name: string } = { member_no: null, name: 'Member' }
  if (memberId) {
    const { data: prof } = await a.from('profiles').select('display_name, member_no').eq('id', memberId).maybeSingle()
    member = { member_no: prof?.member_no ?? null, name: prof?.display_name || 'Member' }
  }

  const { data: msgs } = await a.from('messages').select('id, sender, body, created_at').eq('thread_id', id).order('created_at', { ascending: true })
  const messages = (msgs || []).map(m => ({ ...m, from_member: m.sender === memberId }))
  return NextResponse.json({ member, messages })
}
