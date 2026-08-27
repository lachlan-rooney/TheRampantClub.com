import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { isGalleryCategory } from '@/lib/gallery'

// Event Gallery v2 — staff surface (list + create club events).
//   GET  → ALL events (incl. hidden) with contribution counts + fixtures picker.
//   POST → create a club event (source 'club').
export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  const [{ data: events }, { data: fixtures }] = await Promise.all([
    a.from('events').select('id, title, category, event_date, description, source, creator_name, status, created_at').order('created_at', { ascending: false }).limit(400),
    a.from('fixtures').select('id, title, sport, date').order('date', { ascending: false }).limit(120),
  ])
  const ids = (events || []).map(e => e.id)
  const { data: media } = ids.length
    ? await a.from('event_media').select('event_id, status').in('event_id', ids)
    : { data: [] as { event_id: string; status: string }[] }
  const counts = new Map<string, { total: number; hidden: number }>()
  for (const m of media || []) {
    const c = counts.get(m.event_id) || { total: 0, hidden: 0 }
    c.total++; if (m.status === 'hidden') c.hidden++
    counts.set(m.event_id, c)
  }
  return NextResponse.json({
    events: (events || []).map(e => ({ ...e, media_count: counts.get(e.id)?.total || 0, media_hidden: counts.get(e.id)?.hidden || 0 })),
    fixtures: fixtures || [],
  })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
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
  const ins = await a.from('events').insert({
    title, category, event_date, description, fixture_id,
    created_by: actor.id, creator_name: 'The Club', source: 'club', status: 'visible',
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not create the event.' }, { status: 500 })
  await socialEmit(actor.sb, 'created', 'event', ins.data.id, { title, category, staff: true })
  return NextResponse.json({ ok: true, id: ins.data.id })
}
