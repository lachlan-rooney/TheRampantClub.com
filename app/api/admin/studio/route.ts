import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { isAdmin } from '@/lib/admin'
import { sniff, looksHeic, MIME_OF, EXT_OF, MAX_BYTES, REFUSAL } from '@/lib/attachments/verify'
import { getSharp, imagePipelineDown } from '@/lib/attachments/image'

// The Studio, editable. The table existed with no way to edit it, which made
// every wording change a hand-written migration — a database with no front door.
// Everything the page renders is editable here: sections, dates, status,
// images, captions and their order.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'event-media'   // public: these are published gallery images

const FIELDS = ['artist_name','artist_name_vn','title_en','title_vn','status','opens_on','closes_on',
  'opening_from','opening_to','auction_on','accent','hero_path','sort',
  'bio_en','bio_vn','collaboration_en','collaboration_vn','inspiration_en','inspiration_vn',
  'event_en','event_vn','food_en','food_vn','drinks_en','drinks_vn'] as const

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const sb = svc()
  // Drafts included — this is the admin view, unlike the public page.
  const [{ data: collaborations }, { data: images }] = await Promise.all([
    sb.from('collaborations').select('*').order('sort'),
    sb.from('collaboration_images').select('*').order('sort'),
  ])
  return NextResponse.json({ collaborations: collaborations || [], images: images || [] })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const sb = svc()

  if (b.kind === 'collaboration') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const f of FIELDS) if (f in b) patch[f] = b[f] === '' ? null : b[f]
    // A run that ends before it opens reads fine in a form and is nonsense on a
    // page — the same check the migration makes, enforced at the door too.
    if (patch.opens_on && patch.closes_on && String(patch.closes_on) < String(patch.opens_on)) {
      return NextResponse.json({ error: 'It cannot close before it opens.' }, { status: 400 })
    }
    const { error } = await sb.from('collaborations').update(patch).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (b.kind === 'image') {
    const patch: Record<string, unknown> = {}
    for (const f of ['caption_en','caption_vn','orientation','sort'] as const)
      if (f in b) patch[f] = b[f] === '' ? null : b[f]
    const { error } = await sb.from('collaboration_images').update(patch).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (b.kind === 'new') {
    const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    if (!slug || !b.artist_name) return NextResponse.json({ error: 'A name and a slug, please.' }, { status: 400 })
    const { data, error } = await sb.from('collaborations')
      .insert({ slug, artist_name: b.artist_name, status: 'draft', sort: 99 }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data.id })
  }
  return NextResponse.json({ error: 'Unknown change.' }, { status: 400 })
}

// Upload an image. Same discipline as every other upload here: the bytes decide
// what it is, never the filename, and sharp re-encodes so EXIF (a phone photo
// carries GPS) does not travel with it.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const collaboration_id = String(form?.get('collaboration_id') || '')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  if (!collaboration_id) return NextResponse.json({ error: 'Which collaboration?' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: REFUSAL.tooBig(file.size) }, { status: 400 })

  const original = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(original)
  if (!kind || kind === 'pdf') {
    return NextResponse.json({ error: looksHeic(original) ? REFUSAL.heic : REFUSAL.wrongKind }, { status: 400 })
  }
  const { sharp, error: sharpErr } = await getSharp()
  if (!sharp) return NextResponse.json({ error: imagePipelineDown(sharpErr) }, { status: 503 })

  let bytes: Uint8Array, width = 0, height = 0
  try {
    const img = sharp(Buffer.from(original)).rotate()
    const meta = await img.metadata()
    width = meta.width || 0; height = meta.height || 0
    // 1600px is plenty for a full-bleed on a 2x phone and keeps the page quick.
    bytes = new Uint8Array(await img.resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true }).toBuffer())
  } catch { return NextResponse.json({ error: REFUSAL.unreadable }, { status: 400 }) }

  const sb = svc()
  const path = `studio/${collaboration_id}/${randomUUID()}.jpg`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (upErr) return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 })
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)

  // Orientation is STORED, not guessed at render — the layout gives a portrait
  // and a landscape different room, and a painting is never cropped to fit.
  const orientation = width && height
    ? (width > height * 1.15 ? 'landscape' : height > width * 1.15 ? 'portrait' : 'square')
    : 'portrait'
  const { data: maxRow } = await sb.from('collaboration_images')
    .select('sort').eq('collaboration_id', collaboration_id).order('sort', { ascending: false }).limit(1)
  const { data: row, error: insErr } = await sb.from('collaboration_images').insert({
    collaboration_id, storage_path: pub.publicUrl, orientation, sort: (maxRow?.[0]?.sort ?? 0) + 1,
  }).select('*').single()
  if (insErr) {
    await sb.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: 'Could not record the image.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, image: row })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('image')
  if (!id) return NextResponse.json({ error: 'Which image?' }, { status: 400 })
  const sb = svc()
  const { data: row } = await sb.from('collaboration_images').select('storage_path').eq('id', id).maybeSingle()
  // Only remove the object when WE stored it. A path into public/images is a
  // repo asset and deleting the row must not try to unlink a file on disk.
  if (row?.storage_path?.includes(`/${BUCKET}/`)) {
    const key = row.storage_path.split(`/${BUCKET}/`)[1]
    if (key) await sb.storage.from(BUCKET).remove([key])
  }
  await sb.from('collaboration_images').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
