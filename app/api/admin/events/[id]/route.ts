import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { providerLabel } from '@/lib/gallery'

// Staff: one event with ALL its media (incl. hidden), hide/show, delete.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const a = svc()
  const { data: event } = await a.from('events')
    .select('id, title, category, event_date, description, source, creator_name, status').eq('id', id).maybeSingle()
  if (!event) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { data: media } = await a.from('event_media')
    .select('id, kind, url, caption, submitter_name, source, status, created_at')
    .eq('event_id', id).order('created_at', { ascending: true })
  return NextResponse.json({
    event,
    media: (media || []).map(m => ({ ...m, provider: m.kind === 'link' ? providerLabel(m.url) : null })),
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const p = await req.json().catch(() => null)
  if (p?.status !== 'visible' && p?.status !== 'hidden') return NextResponse.json({ error: 'Bad status.' }, { status: 400 })
  const { error } = await svc().from('events').update({ status: p.status }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const a = svc()
  const { data: imgs } = await a.from('event_media').select('storage_path').eq('event_id', id).not('storage_path', 'is', null)
  const paths = (imgs || []).map(r => r.storage_path).filter(Boolean) as string[]
  if (paths.length) { try { await a.storage.from('event-media').remove(paths) } catch { /* best-effort */ } }
  await a.from('events').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
