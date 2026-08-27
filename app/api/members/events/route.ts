import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { isGalleryCategory } from '@/lib/gallery'

// Event Gallery v2 — member surface (the list).
//   GET  → visible events, each with a cover image + contribution count.
//   POST → create an event {title, category, event_date?, description?, fixture_id?}.
export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const a = svc()
  const { data: events } = await a.from('events')
    .select('id, title, category, event_date, description, cover_url, source, creator_name, created_by, created_at')
    .eq('status', 'visible')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200)
  const ids = (events || []).map(e => e.id)
  // Pull visible media for these events to derive a cover + a count in one go.
  const { data: media } = ids.length
    ? await a.from('event_media').select('event_id, kind, url, created_at')
        .in('event_id', ids).eq('status', 'visible').order('created_at', { ascending: true })
    : { data: [] as { event_id: string; kind: string; url: string; created_at: string }[] }
  const byEvent = new Map<string, { count: number; cover: string | null }>()
  for (const m of media || []) {
    const cur = byEvent.get(m.event_id) || { count: 0, cover: null }
    cur.count++
    if (!cur.cover && m.kind === 'image') cur.cover = m.url
    byEvent.set(m.event_id, cur)
  }
  const out = (events || []).map(e => {
    const agg = byEvent.get(e.id) || { count: 0, cover: null }
    return {
      id: e.id, title: e.title, category: e.category, event_date: e.event_date,
      description: e.description, source: e.source, creator_name: e.creator_name,
      mine: e.created_by === actor.id,
      media_count: agg.count,
      cover: e.cover_url || agg.cover,
    }
  })
  return NextResponse.json({ events: out })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })

  const p = await req.json().catch(() => null)
  const title = typeof p?.title === 'string' ? p.title.trim() : ''
  if (title.length < 2 || title.length > 120) return NextResponse.json({ error: 'Give it a short title (2–120 characters).' }, { status: 400 })
  const category = isGalleryCategory(p?.category) ? p.category : 'other'
  const description = typeof p?.description === 'string' && p.description.trim() ? p.description.trim().slice(0, 600) : null
  let event_date: string | null = null
  if (typeof p?.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.event_date)) event_date = p.event_date
  let fixture_id: string | null = null
  if (typeof p?.fixture_id === 'string' && p.fixture_id) fixture_id = p.fixture_id

  const a = svc()
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('events').select('id', { count: 'exact', head: true })
    .eq('created_by', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 15) return NextResponse.json({ error: 'You’ve created a lot just now — give it a moment.' }, { status: 429 })

  const { data: prof } = await a.from('profiles').select('display_name').eq('id', actor.id).maybeSingle()
  const ins = await a.from('events').insert({
    title, category, event_date, description, fixture_id,
    created_by: actor.id, creator_name: prof?.display_name || 'A member',
    source: 'member', status: 'visible',
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not create the event.' }, { status: 500 })
  await socialEmit(actor.sb, 'created', 'event', ins.data.id, { title, category })
  return NextResponse.json({ ok: true, id: ins.data.id })
}
