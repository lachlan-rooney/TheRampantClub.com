import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { providerLabel } from '@/lib/gallery'

// One event: its header + every visible contribution (images and links).
// DELETE removes an event the caller created (or any, for admins); its media
// cascade in the DB, and we best-effort clear the uploaded Storage objects.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const a = svc()
  const { data: event } = await a.from('events')
    .select('id, title, category, event_date, description, cover_url, fixture_id, source, creator_name, created_by, status')
    .eq('id', id).maybeSingle()
  if (!event || (event.status !== 'visible' && !actor.isAdmin)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: media } = await a.from('event_media')
    .select('id, kind, url, caption, submitter_name, source, submitted_by, created_at')
    .eq('event_id', id).eq('status', 'visible')
    .order('created_at', { ascending: true })

  return NextResponse.json({
    event: {
      id: event.id, title: event.title, category: event.category, event_date: event.event_date,
      description: event.description, cover_url: event.cover_url, fixture_id: event.fixture_id,
      source: event.source, creator_name: event.creator_name, mine: event.created_by === actor.id,
    },
    media: (media || []).map(m => ({
      id: m.id, kind: m.kind, url: m.url, caption: m.caption,
      submitter_name: m.submitter_name, source: m.source,
      provider: m.kind === 'link' ? providerLabel(m.url) : null,
      mine: m.submitted_by === actor.id,
    })),
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const a = svc()
  const { data: event } = await a.from('events').select('created_by').eq('id', id).maybeSingle()
  if (!event) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (event.created_by !== actor.id && !actor.isAdmin) return NextResponse.json({ error: 'Not yours to remove.' }, { status: 403 })

  // Best-effort: clear uploaded Storage objects before the rows cascade away.
  const { data: imgs } = await a.from('event_media').select('storage_path').eq('event_id', id).not('storage_path', 'is', null)
  const paths = (imgs || []).map(r => r.storage_path).filter(Boolean) as string[]
  if (paths.length) { try { await a.storage.from('event-media').remove(paths) } catch { /* best-effort */ } }

  await a.from('events').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
