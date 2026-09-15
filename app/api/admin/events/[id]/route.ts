import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { providerLabel, isGalleryCategory } from '@/lib/gallery'

// Staff: one event with ALL its media (incl. hidden), edit, hide/show, delete.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const a = svc()
  const { data: event } = await a.from('events')
    .select('id, title, category, event_date, description, fixture_id, source, creator_name, status').eq('id', id).maybeSingle()
  if (!event) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { data: media } = await a.from('event_media')
    .select('id, kind, url, caption, submitter_name, source, status, created_at')
    .eq('event_id', id).order('created_at', { ascending: true })
  return NextResponse.json({
    event,
    media: (media || []).map(m => ({ ...m, provider: m.kind === 'link' ? providerLabel(m.url) : null })),
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Status (hide/show) AND the event's details. Until 2026-09-15 staff could only
// hide or delete a folder — so a misspelt title ("Hoi Binh" for Hoa Binh) meant
// deleting the folder and every photo in it. Each field is optional; whatever is
// sent is checked exactly as creating an event checks it (POST in ../route.ts).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const p = await req.json().catch(() => null)
  if (!p || typeof p !== 'object') return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if ('status' in p) {
    if (p.status !== 'visible' && p.status !== 'hidden') return NextResponse.json({ error: 'Bad status.' }, { status: 400 })
    patch.status = p.status
  }
  if ('title' in p) {
    const title = typeof p.title === 'string' ? p.title.trim() : ''
    if (title.length < 2 || title.length > 120) return NextResponse.json({ error: 'Give it a short title (2–120 characters).' }, { status: 400 })
    patch.title = title
  }
  if ('category' in p) {
    if (!isGalleryCategory(p.category)) return NextResponse.json({ error: 'Unknown category.' }, { status: 400 })
    patch.category = p.category
    // A fixture link only means something on a Sports Fixture folder.
    if (p.category !== 'fixture') patch.fixture_id = null
  }
  if ('event_date' in p) {
    if (p.event_date === null || p.event_date === '') patch.event_date = null
    else if (typeof p.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.event_date)) patch.event_date = p.event_date
    else return NextResponse.json({ error: 'The date must be YYYY-MM-DD.' }, { status: 400 })
  }
  if ('description' in p) {
    patch.description = typeof p.description === 'string' && p.description.trim() ? p.description.trim().slice(0, 600) : null
  }
  if ('fixture_id' in p && patch.fixture_id !== null) {
    if (p.fixture_id === null || p.fixture_id === '') patch.fixture_id = null
    else if (typeof p.fixture_id === 'string' && UUID.test(p.fixture_id)) patch.fixture_id = p.fixture_id
    else return NextResponse.json({ error: 'That fixture is not valid.' }, { status: 400 })
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { data, error } = await svc().from('events').update(patch).eq('id', id)
    .select('id, title, category, event_date, description, fixture_id, source, creator_name, status').maybeSingle()
  if (error) return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'That event no longer exists.' }, { status: 404 })
  return NextResponse.json({ ok: true, event: data })
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
