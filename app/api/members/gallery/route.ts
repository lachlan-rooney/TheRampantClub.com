import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { parseMediaUrl, isGalleryCategory, providerLabel } from '@/lib/gallery'

// Event Gallery — member surface.
//   GET  → the visible albums (newest event first), each flagged `mine`.
//   POST → submit a link {title, category, event_date?, url, caption?, fixture_id?}.
// Members only. Identity always from the session, never the client.

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const a = svc()
  const { data } = await a.from('event_albums')
    .select('id, title, category, event_date, url, caption, fixture_id, submitter_name, source, submitted_by, created_at')
    .eq('status', 'visible')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(300)
  const albums = (data || []).map(r => ({
    id: r.id, title: r.title, category: r.category, event_date: r.event_date,
    url: r.url, caption: r.caption, fixture_id: r.fixture_id,
    submitter_name: r.submitter_name, source: r.source,
    provider: providerLabel(r.url),
    mine: r.submitted_by === actor.id,
  }))
  return NextResponse.json({ albums })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })

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
  // Rate-limit: a member may add at most 20 links per hour.
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('event_albums').select('id', { count: 'exact', head: true })
    .eq('submitted_by', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 20) return NextResponse.json({ error: 'You’ve added a lot just now — give it a moment.' }, { status: 429 })

  // Resolve the member's display name for the byline.
  const { data: prof } = await a.from('profiles').select('display_name').eq('id', actor.id).maybeSingle()

  const ins = await a.from('event_albums').insert({
    title, category, event_date, url: parsed.url, caption, fixture_id,
    submitted_by: actor.id, submitter_name: prof?.display_name || 'A member',
    source: 'member', status: 'visible',
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not save the link.' }, { status: 500 })

  await socialEmit(actor.sb, 'posted', 'event_album', ins.data.id, { title, category })
  return NextResponse.json({ ok: true, id: ins.data.id })
}
