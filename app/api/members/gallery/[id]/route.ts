import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// A member may remove their OWN submission. (Staff moderation lives in the
// admin gallery API.) Next 16: params is a Promise.
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const a = svc()
  const { data: row } = await a.from('event_albums').select('submitted_by').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (row.submitted_by !== actor.id && !actor.isAdmin) return NextResponse.json({ error: 'Not yours to remove.' }, { status: 403 })
  await a.from('event_albums').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
