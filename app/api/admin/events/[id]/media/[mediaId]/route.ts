import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Staff moderation of one contribution: hide/show, or delete (clears Storage).
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { mediaId } = await params
  const p = await req.json().catch(() => null)
  if (p?.status !== 'visible' && p?.status !== 'hidden') return NextResponse.json({ error: 'Bad status.' }, { status: 400 })
  const { error } = await svc().from('event_media').update({ status: p.status }).eq('id', mediaId)
  if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { mediaId } = await params
  const a = svc()
  const { data: row } = await a.from('event_media').select('storage_path').eq('id', mediaId).maybeSingle()
  if (row?.storage_path) { try { await a.storage.from('event-media').remove([row.storage_path]) } catch { /* best-effort */ } }
  await a.from('event_media').delete().eq('id', mediaId)
  return NextResponse.json({ ok: true })
}
