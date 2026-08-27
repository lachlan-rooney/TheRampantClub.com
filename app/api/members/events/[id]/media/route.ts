import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { parseMediaUrl } from '@/lib/gallery'

// Add a contribution to an event.
//   kind 'image' → {url, storage_path} from a prior Storage upload (browser
//                  uploads the file directly, then records it here).
//   kind 'link'  → {url} external link (Drive / Photos / YouTube…).
// Members only; live immediately; staff moderate later.
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const { id } = await params
  const a = svc()

  const { data: event } = await a.from('events').select('id, status').eq('id', id).maybeSingle()
  if (!event || event.status !== 'visible') return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

  const p = await req.json().catch(() => null)
  const kind = p?.kind === 'link' ? 'link' : 'image'
  const caption = typeof p?.caption === 'string' && p.caption.trim() ? p.caption.trim().slice(0, 280) : null

  let url: string
  let storage_path: string | null = null
  if (kind === 'link') {
    const parsed = parseMediaUrl(p?.url)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    url = parsed.url
  } else {
    // Uploaded image: the url must be one of OUR Storage objects, and we keep
    // the path so it can be deleted later. Guards against storing arbitrary URLs.
    if (typeof p?.url !== 'string' || !p.url.includes('/event-media/')) return NextResponse.json({ error: 'Bad image.' }, { status: 400 })
    if (typeof p?.storage_path !== 'string' || !p.storage_path) return NextResponse.json({ error: 'Bad image.' }, { status: 400 })
    url = p.url
    storage_path = p.storage_path
  }

  // Rate-limit: 60 contributions/hour per member (a photo dump is fine, spam is not).
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('event_media').select('id', { count: 'exact', head: true })
    .eq('submitted_by', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 60) return NextResponse.json({ error: 'That’s a lot at once — give it a moment.' }, { status: 429 })

  const { data: prof } = await a.from('profiles').select('display_name').eq('id', actor.id).maybeSingle()
  const ins = await a.from('event_media').insert({
    event_id: id, kind, url, storage_path, caption,
    submitted_by: actor.id, submitter_name: prof?.display_name || 'A member',
    source: 'member', status: 'visible',
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not add it.' }, { status: 500 })
  await socialEmit(actor.sb, 'contributed', 'event_media', ins.data.id, { event_id: id, kind })
  return NextResponse.json({ ok: true, id: ins.data.id })
}
