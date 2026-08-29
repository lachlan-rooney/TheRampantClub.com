import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { rederiveAndPersist } from '@/lib/whisky/derive-taste'

// Member tasting notes — a member's own notes on a whisky (private), optionally
// shared to the Snug, with an optional photo. Writes route-only (no member INSERT
// policy). Reads via the SESSION client so RLS enforces visibility (own any ·
// others' snug only); author names + photo signed-URLs are resolved service-side.
// Photos: private member-media bucket, EXIF/GPS stripped server-side before store,
// served only via short-lived signed URLs (no public access).

export const dynamic = 'force-dynamic'
const VIS = ['private', 'snug']
const BUCKET = 'member-media'

export async function GET(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ notes: [] })
  const whiskyId = new URL(req.url).searchParams.get('whisky_id')
  const a = svc()

  // No whisky_id → the member's OWN collection (all their notes, any visibility),
  // each with its whisky name + a signed photo URL. Their personal journal.
  if (!whiskyId) {
    const { data: mine } = await actor.sb.from('tasting_notes')
      .select('id, note, flavour_tags, visibility, media_path, created_at, whisky_id, whiskies(name)')
      .eq('author', actor.id).order('created_at', { ascending: false })
    const out = []
    for (const n of mine || []) {
      let photo_url: string | null = null
      if (n.media_path) { const { data: sig } = await a.storage.from(BUCKET).createSignedUrl(n.media_path, 3600); photo_url = sig?.signedUrl ?? null }
      const wname = Array.isArray(n.whiskies) ? n.whiskies[0]?.name : (n.whiskies as { name?: string } | null)?.name
      out.push({ id: n.id, note: n.note, flavour_tags: n.flavour_tags || [], visibility: n.visibility, created_at: n.created_at, whisky_id: n.whisky_id, whisky_name: wname || 'A whisky', photo_url })
    }
    return NextResponse.json({ notes: out })
  }

  // RLS-filtered to own (any visibility) + others' snug.
  const { data: notes } = await actor.sb.from('tasting_notes')
    .select('id, author, note, flavour_tags, visibility, media_path, created_at')
    .eq('whisky_id', whiskyId).order('created_at', { ascending: false })
  const authorIds = [...new Set((notes || []).map(n => n.author))].filter(id => id !== actor.id)
  const nameOf: Record<string, string> = {}
  if (authorIds.length) {
    const { data: profs } = await a.from('profiles').select('id, display_name').in('id', authorIds)
    for (const p of profs || []) nameOf[p.id] = p.display_name || 'A member'
  }

  const out = []
  for (const n of notes || []) {
    let photo_url: string | null = null
    if (n.media_path) {
      const { data: sig } = await a.storage.from(BUCKET).createSignedUrl(n.media_path, 3600)
      photo_url = sig?.signedUrl ?? null
    }
    out.push({
      id: n.id, note: n.note, flavour_tags: n.flavour_tags || [], visibility: n.visibility, created_at: n.created_at,
      is_own: n.author === actor.id, author_name: n.author === actor.id ? 'You' : (nameOf[n.author] || 'A member'),
      photo_url,
    })
  }
  return NextResponse.json({ notes: out })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.', reason: actor.isAdmin ? 'staff' : 'unlinked' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  const whiskyId = form.get('whisky_id')
  const raw = form.get('note')
  const visibility = (form.get('visibility') as string) || 'private'
  const tagsRaw = form.get('flavour_tags')
  const photo = form.get('photo')

  if (typeof whiskyId !== 'string' || typeof raw !== 'string') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  const note = raw.trim()
  if (note.length < 1 || note.length > 8000) return NextResponse.json({ error: 'Keep it between 1 and 8000 characters.' }, { status: 400 })
  if (!VIS.includes(visibility)) return NextResponse.json({ error: 'Pick private or the Snug.' }, { status: 400 })
  let tags: string[] = []
  try { const parsed = typeof tagsRaw === 'string' ? JSON.parse(tagsRaw) : []; if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string').slice(0, 16) } catch { /* no tags */ }

  const a = svc()
  // Rate-limit note spam (count-rows, generous).
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('tasting_notes').select('id', { count: 'exact', head: true }).eq('author', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 30) return NextResponse.json({ error: 'That’s a lot of notes at once — take a breath.' }, { status: 429 })

  // Optional photo: strip EXIF/GPS + auto-orient (sharp drops all metadata unless
  // told to keep it; .rotate() applies then discards orientation). Store in the
  // PRIVATE bucket under the member's own prefix. Reads are signed-URL only.
  let media_path: string | null = null
  if (photo && typeof photo === 'object' && 'arrayBuffer' in photo && (photo as File).size > 0) {
    const f = photo as File
    if (f.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Photo is too large (8MB max).' }, { status: 400 })
    try {
      const cleaned = await sharp(Buffer.from(await f.arrayBuffer())).rotate().jpeg({ quality: 82 }).toBuffer()
      media_path = `${actor.id}/${randomUUID()}.jpg`
      const up = await a.storage.from(BUCKET).upload(media_path, cleaned, { contentType: 'image/jpeg', upsert: false })
      if (up.error) return NextResponse.json({ error: 'Could not process the photo.' }, { status: 500 })
    } catch { return NextResponse.json({ error: 'That image couldn’t be read.' }, { status: 400 }) }
  }

  const ins = await a.from('tasting_notes')
    .insert({ author: actor.id, whisky_id: whiskyId, note, flavour_tags: tags, visibility, media_path })
    .select('id').single()
  if (ins.error) {
    if (media_path) await a.storage.from(BUCKET).remove([media_path])   // don't orphan the upload
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }
  await socialEmit(actor.sb, 'note.logged', 'tasting_note', ins.data.id, { whisky_id: whiskyId, visibility, has_photo: !!media_path })
  // The flywheel: the note's flavour data enriches the member's palate on the spot.
  try { await rederiveAndPersist(a, actor.memberNo) } catch { /* best-effort; the note still saved */ }
  return NextResponse.json({ id: ins.data.id })
}
