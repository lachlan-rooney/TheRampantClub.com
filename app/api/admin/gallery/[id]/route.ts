import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Staff moderation of one album.
//   PATCH {status:'visible'|'hidden'} → hide/show a member (or staff) submission.
//   DELETE → remove permanently.
// Next 16: params is a Promise.
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const p = await req.json().catch(() => null)
  if (p?.status !== 'visible' && p?.status !== 'hidden') return NextResponse.json({ error: 'Bad status.' }, { status: 400 })
  const a = svc()
  const { error } = await a.from('event_albums').update({ status: p.status }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  await svc().from('event_albums').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
