import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Staff moderation of one contribution: edit its caption, hide/show, or delete
// (clears Storage). Caption editing added 2026-09-15 alongside event editing.
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id, mediaId } = await params
  const p = await req.json().catch(() => null)
  if (!p || typeof p !== 'object') return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if ('status' in p) {
    if (p.status !== 'visible' && p.status !== 'hidden') return NextResponse.json({ error: 'Bad status.' }, { status: 400 })
    patch.status = p.status
  }
  if ('caption' in p) {
    patch.caption = typeof p.caption === 'string' && p.caption.trim() ? p.caption.trim().slice(0, 300) : null
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  // Scoped to its event too: an item id from one folder cannot be edited through another.
  const { data, error } = await svc().from('event_media').update(patch).eq('id', mediaId).eq('event_id', id)
    .select('id, caption, status').maybeSingle()
  if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'That item no longer exists.' }, { status: 404 })
  return NextResponse.json({ ok: true, media: data })
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
