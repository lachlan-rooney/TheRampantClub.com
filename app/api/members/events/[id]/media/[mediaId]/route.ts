import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Remove a single contribution the caller added (admins can remove any).
// Deletes the uploaded Storage object too, when there is one.
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { mediaId } = await params
  const a = svc()
  const { data: row } = await a.from('event_media').select('submitted_by, storage_path').eq('id', mediaId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (row.submitted_by !== actor.id && !actor.isAdmin) return NextResponse.json({ error: 'Not yours to remove.' }, { status: 403 })
  // Delete the Storage object only if NO OTHER row still references it — so
  // removing one contribution can never destroy an object another row points at
  // (defense in depth behind the per-uploader path binding).
  if (row.storage_path) {
    const { count } = await a.from('event_media').select('id', { count: 'exact', head: true }).eq('storage_path', row.storage_path).neq('id', mediaId)
    if (!count) { try { await a.storage.from('event-media').remove([row.storage_path]) } catch { /* best-effort */ } }
  }
  await a.from('event_media').delete().eq('id', mediaId)
  return NextResponse.json({ ok: true })
}
