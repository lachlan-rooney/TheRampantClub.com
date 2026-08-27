import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { parseMediaUrl, isGalleryCategory, providerLabel } from '@/lib/gallery'

// Event Gallery — staff surface (moderation + posting).
//   GET  → ALL albums (incl. hidden) + a recent-fixtures list for the picker.
//   POST → staff-post a link (source 'staff', shown as "The Club").
export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  const [{ data: albums }, { data: fixtures }] = await Promise.all([
    a.from('event_albums')
      .select('id, title, category, event_date, url, caption, fixture_id, submitter_name, source, status, created_at')
      .order('created_at', { ascending: false }).limit(500),
    a.from('fixtures').select('id, title, sport, date').order('date', { ascending: false }).limit(120),
  ])
  return NextResponse.json({
    albums: (albums || []).map(r => ({ ...r, provider: providerLabel(r.url) })),
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
  const parsed = parseMediaUrl(p?.url)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const caption = typeof p?.caption === 'string' && p.caption.trim() ? p.caption.trim().slice(0, 280) : null
  let event_date: string | null = null
  if (typeof p?.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.event_date)) event_date = p.event_date
  let fixture_id: string | null = null
  if (typeof p?.fixture_id === 'string' && p.fixture_id) fixture_id = p.fixture_id

  const a = svc()
  const ins = await a.from('event_albums').insert({
    title, category, event_date, url: parsed.url, caption, fixture_id,
    submitted_by: actor.id, submitter_name: 'The Club', source: 'staff', status: 'visible',
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not save the link.' }, { status: 500 })

  await socialEmit(actor.sb, 'posted', 'event_album', ins.data.id, { title, category, staff: true })
  return NextResponse.json({ ok: true, id: ins.data.id })
}
