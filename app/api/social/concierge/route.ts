import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// The member's ONE persistent thread with The Club.
//   GET  → the caller's concierge thread + its messages (own only; RLS-backed).
//   POST → get-or-create that thread (idempotent; the partial unique index guards
//          concurrency — a racing second insert 23505s and we re-select).
// Members only; The Club's staff join as participants on first reply (route side).

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.', reason: actor.isAdmin ? 'staff' : 'unlinked' }, { status: 403 })

  // Read via the SESSION client so RLS (can_read_thread) enforces own-only — a
  // member can never pull another member's thread, even through this route.
  const { data: thread } = await actor.sb.from('threads')
    .select('id, kind, last_message_at, created_at')
    .eq('kind', 'concierge').eq('created_by', actor.id).maybeSingle()
  if (!thread) return NextResponse.json({ thread: null, messages: [] })

  const { data: messages } = await actor.sb.from('messages')
    .select('id, sender, body, created_at').eq('thread_id', thread.id).order('created_at', { ascending: true })
  return NextResponse.json({ thread, messages: messages || [] })
}

export async function POST() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.', reason: actor.isAdmin ? 'staff' : 'unlinked' }, { status: 403 })
  const a = svc()

  // Already have one? Return it (idempotent).
  const existing = await a.from('threads').select('id').eq('kind', 'concierge').eq('created_by', actor.id).maybeSingle()
  if (existing.data) return NextResponse.json({ thread_id: existing.data.id, created: false })

  const ins = await a.from('threads').insert({ kind: 'concierge', created_by: actor.id }).select('id').single()
  if (ins.error) {
    // Lost a race on the partial unique index — the other request created it.
    if (ins.error.code === '23505') {
      const again = await a.from('threads').select('id').eq('kind', 'concierge').eq('created_by', actor.id).maybeSingle()
      if (again.data) return NextResponse.json({ thread_id: again.data.id, created: false })
    }
    return NextResponse.json({ error: 'Could not open the thread.' }, { status: 500 })
  }
  await a.from('thread_participants').insert({ thread_id: ins.data.id, participant: actor.id, role: 'member' })
  await socialEmit(actor.sb, 'thread.created', 'thread', ins.data.id, { kind: 'concierge' })
  return NextResponse.json({ thread_id: ins.data.id, created: true })
}
