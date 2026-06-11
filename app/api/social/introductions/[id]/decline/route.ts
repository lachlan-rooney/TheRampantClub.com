import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Decline an introduction — SILENT. Recipient-only, pending-only. Sets status to
// declined (the requester reads it as 'pending' forever via introductions_for_me;
// the row leaves the recipient's view too). Emits introduction.declined for the
// STAFF/AUDIT spine ONLY — never a member-visible signal, and NO notification to
// the requester. A decline produces nothing but quiet.

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const { id } = await params
  const a = svc()

  const { data: intro } = await a.from('introductions').select('id, recipient, status').eq('id', id).maybeSingle()
  if (!intro || intro.recipient !== actor.id || intro.status !== 'pending') return NextResponse.json({ error: 'No such introduction.' }, { status: 404 })

  await a.from('introductions').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', id)
  await socialEmit(actor.sb, 'introduction.declined', 'introduction', id, {})   // audit only — NO notify
  return NextResponse.json({ ok: true })
}
