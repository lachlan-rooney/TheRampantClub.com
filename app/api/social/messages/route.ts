import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit, notify, rateLimitOk } from '@/lib/social/server'

// Send a message into a thread the caller is party to.
// Guards: participant (or concierge-staff) · body 1–4000 (mirrors the DB check) ·
// rate-limit · block check for direct threads (S2 — concierge has no block case).
// sender is ALWAYS the session uid — a client-sent sender is ignored.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const payload = await req.json().catch(() => null)
  const threadId: unknown = payload?.thread_id
  const raw: unknown = payload?.body
  if (typeof threadId !== 'string' || typeof raw !== 'string') {
    return NextResponse.json({ error: 'Nothing to send.' }, { status: 400 })
  }
  const body = raw.trim()
  if (body.length < 1 || body.length > 4000) {
    return NextResponse.json({ error: 'Keep it between 1 and 4000 characters.' }, { status: 400 })
  }

  const a = svc()
  const { data: thread } = await a.from('threads').select('id, kind').eq('id', threadId).maybeSingle()
  if (!thread) return NextResponse.json({ error: 'No such thread.' }, { status: 404 })

  const { data: parts } = await a.from('thread_participants').select('participant, role').eq('thread_id', thread.id)
  const isParty = (parts || []).some(p => p.participant === actor.id)
  const concierge = thread.kind === 'concierge'
  // A concierge thread is readable/answerable by any admin (the staff inbox);
  // a direct thread is party-only. Authorisation, server-side.
  if (!isParty && !(concierge && actor.isAdmin)) {
    return NextResponse.json({ error: 'Not your thread.' }, { status: 403 })
  }

  // Block severance, defence in depth: RLS already blinds a blocked direct thread's
  // reads (S0 proven); the send route must also REFUSE writes into one.
  if (thread.kind === 'direct') {
    const other = (parts || []).map(p => p.participant).find(id => id !== actor.id)
    if (other) {
      const { data: blk } = await a.from('member_blocks').select('blocker')
        .or(`and(blocker.eq.${actor.id},blocked.eq.${other}),and(blocker.eq.${other},blocked.eq.${actor.id})`).maybeSingle()
      if (blk) return NextResponse.json({ error: 'This conversation is closed.' }, { status: 403 })
    }
  }

  if (!(await rateLimitOk(a, actor.id))) {
    return NextResponse.json({ error: 'You’re moving quickly — give the last note a moment to land.' }, { status: 429 })
  }

  // Staff-participation call (a): the first time a staff member replies to a
  // concierge thread, add their participant row (role='staff') so their unread
  // tracks via last_read_at — the one grantable column. No new policy needed.
  if (concierge && actor.isAdmin && !isParty) {
    await a.from('thread_participants').insert({ thread_id: thread.id, participant: actor.id, role: 'staff' })
  }

  const ins = await a.from('messages').insert({ thread_id: thread.id, sender: actor.id, body }).select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not send.' }, { status: 500 })
  await a.from('threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id)
  await socialEmit(actor.sb, 'message.sent', 'message', ins.data.id, { thread_id: thread.id, kind: thread.kind })

  // Notify the OTHER party — generic label + link only, never the body.
  if (concierge) {
    if (actor.isAdmin) {
      // The Club → member.
      const member = (parts || []).find(p => p.role === 'member')
      if (member) await notify(a, member.participant, 'concierge_reply', { link: '/members/concierge', label: 'The Club replied' })
    } else {
      // Member → The Club: signal every admin (the inbox is the working surface).
      const { data: admins } = await a.from('profiles').select('id').eq('is_admin', true)
      for (const ad of admins || []) {
        await notify(a, ad.id, 'concierge_message', { link: '/admin/concierge', label: 'A member wrote in' })
      }
    }
  }

  return NextResponse.json({ id: ins.data.id })
}
