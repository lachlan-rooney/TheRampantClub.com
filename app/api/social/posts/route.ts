import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Create a Snug post. Members post as author_kind='member'; staff (admins) post
// as 'house' — the member side renders house posts as "The Club", never a staff
// name. Route-only (no member INSERT policy). Multipart for the optional photo
// (private bucket, EXIF/GPS stripped, signed-URL reads — the S2a pattern).

export const dynamic = 'force-dynamic'
const BUCKET = 'member-media'

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const isMember = !!actor.memberNo
  if (!isMember && !actor.isAdmin) return NextResponse.json({ error: 'Members or staff only.' }, { status: 403 })
  const author_kind = actor.isAdmin ? 'house' : 'member'   // staff → The Club

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Nothing to post.' }, { status: 400 })
  const raw = form.get('body')
  const kindIn = form.get('kind')
  const photo = form.get('photo')
  if (typeof raw !== 'string') return NextResponse.json({ error: 'Nothing to post.' }, { status: 400 })
  const body = raw.trim()
  if (body.length < 1 || body.length > 8000) return NextResponse.json({ error: 'Keep it between 1 and 8000 characters.' }, { status: 400 })
  const kind = typeof kindIn === 'string' && ['note', 'announcement', 'question', 'other'].includes(kindIn) ? kindIn : 'note'

  const a = svc()
  // Rate-limit (count-rows): posts by this author in the last hour.
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('posts').select('id', { count: 'exact', head: true }).eq('author', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 20) return NextResponse.json({ error: 'Easy does it — give the room a moment.' }, { status: 429 })

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

  const ins = await a.from('posts')
    .insert({ author: actor.id, author_kind, kind, body, media_path, published: true })
    .select('id').single()
  if (ins.error) {
    if (media_path) await a.storage.from(BUCKET).remove([media_path])
    return NextResponse.json({ error: 'Could not post.' }, { status: 500 })
  }
  await socialEmit(actor.sb, 'post.published', 'post', ins.data.id, { author_kind, kind })
  return NextResponse.json({ id: ins.data.id })
}
