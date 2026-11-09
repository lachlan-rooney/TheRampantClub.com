import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { isAdmin } from '@/lib/admin'
import { sniff, looksHeic, MAX_BYTES, REFUSAL } from '@/lib/attachments/verify'
import { getSharp, imagePipelineDown } from '@/lib/attachments/image'

// THE PIECES ON THE WALL — the gallery guide's content, editable.
//
// A separate route from /api/admin/studio because the two upload DIFFERENT
// things to the same bucket: that one adds a photograph to the show's gallery
// strip, this one attaches an image to one piece. Folding them together would
// mean a `kind` flag on every call deciding which table a file lands in, which
// is how an image ends up in the wrong one.
//
// Same discipline as every other upload in the building: the BYTES decide what
// the file is, never the filename, and sharp re-encodes so a phone photo's EXIF
// — which carries GPS — does not travel to a public bucket.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'event-media'   // public: a gallery guide is read by guests

const FIELDS = ['sort','title_en','title_vn','artist_name','year','medium_en','medium_vn',
  'dimensions','description_en','description_vn','provenance'] as const

// Long enough for a real wall label and a paragraph of story; short enough that
// a paste accident cannot put a novel on a phone.
const LIMIT: Record<string, number> = {
  title_en: 200, title_vn: 200, artist_name: 160, year: 40,
  medium_en: 200, medium_vn: 200, dimensions: 120,
  description_en: 4000, description_vn: 4000, provenance: 1000,
}
// ⚠ TWO KINDS OF FIELD, AND ONLY ONE OF THEM IS A LINE.
// A title, a medium and a dimension are single lines: collapsing their
// whitespace is right, because a stray newline pasted into a label is a
// mistake. A DESCRIPTION is prose in paragraphs, and `\s+ → ' '` would run an
// artist's four-paragraph statement into one wall of text — silently, on the
// way in, with no way back. So the long fields keep their paragraph breaks
// (the page sets white-space: pre-line for exactly this), and only runs of
// spaces and tabs within a line are collapsed.
const PROSE = new Set(['description_en', 'description_vn', 'provenance'])
const tidy = (v: unknown, cap: number, prose = false) => {
  if (typeof v !== 'string') return null
  const cleaned = prose
    ? v.replace(/\r\n?/g, '\n')          // one newline convention
       .replace(/[ \t]+/g, ' ')           // runs of spaces WITHIN a line
       .replace(/ *\n */g, '\n')          // no trailing spaces on a line
       .replace(/\n{3,}/g, '\n\n')        // at most one blank line between paragraphs
       .trim()
    : v.replace(/\s+/g, ' ').trim()
  return cleaned.slice(0, cap) || null
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const collaboration_id = req.nextUrl.searchParams.get('collaboration')
  const sb = svc()
  let q = sb.from('collaboration_pieces').select('*').order('sort')
  if (collaboration_id) q = q.eq('collaboration_id', collaboration_id)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // ── THE TRANSLATION REVIEW FLAG, IN A QUERY OF ITS OWN ──────────────────
  // db/collaboration_vn_review.sql may not have been run. Selecting the column
  // alongside anything else would fail the WHOLE request and black out the
  // pieces editor over an advisory notice. Asked separately, and a failure
  // means "not reviewed" — the safe answer, since unreviewed is the state that
  // needs saying.
  let vn_reviewed_at: string | null = null
  if (collaboration_id) {
    const { data: flag } = await sb.from('collaborations')
      .select('vn_reviewed_at').eq('id', collaboration_id).maybeSingle()
    vn_reviewed_at = (flag as { vn_reviewed_at?: string } | null)?.vn_reviewed_at ?? null
  }
  return NextResponse.json({ pieces: data || [], vn_reviewed_at })
}

// A new piece, empty. It arrives at the END of the walk, because a piece is
// hung somewhere and then described — not the other way round.
export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const collaboration_id = String(b.collaboration_id || '')
  if (!collaboration_id) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })
  const sb = svc()
  const { data: last } = await sb.from('collaboration_pieces')
    .select('sort').eq('collaboration_id', collaboration_id).order('sort', { ascending: false }).limit(1)
  const { data, error } = await sb.from('collaboration_pieces')
    .insert({ collaboration_id, sort: (last?.[0]?.sort ?? 0) + 1 }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, piece: data })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))

  // Marking the Vietnamese as checked. Records WHO, because "reviewed" with no
  // name is a claim nobody can question later. Reversible: send reviewed:false.
  if (b.kind === 'vn-review') {
    if (!b.collaboration_id) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })
    const who = typeof b.by === 'string' ? b.by.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    if (b.reviewed !== false && !who) return NextResponse.json({ error: 'Who reviewed it?' }, { status: 400 })
    const { error } = await svc().from('collaborations').update(
      b.reviewed === false
        ? { vn_reviewed_at: null, vn_reviewed_by: null }
        : { vn_reviewed_at: new Date().toISOString(), vn_reviewed_by: who },
    ).eq('id', b.collaboration_id)
    if (error) return NextResponse.json({ error: `${error.message} — has db/collaboration_vn_review.sql been run?` }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (!b.id) return NextResponse.json({ error: 'Which piece?' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (!(f in b)) continue
    // sort is a number; everything else is text that gets trimmed and capped.
    patch[f] = f === 'sort' ? Number(b[f]) || 0 : tidy(b[f], LIMIT[f] ?? 400, PROSE.has(f))
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  // REFUSE RATHER THAN TRUNCATE. slice() quietly losing the last paragraph of
  // a statement is worse than an error: the save appears to succeed and nobody
  // reads to the end of a label to check.
  for (const f of FIELDS) {
    if (f === 'sort' || !(f in b) || typeof b[f] !== 'string') continue
    const cap = LIMIT[f] ?? 400
    if (String(b[f]).trim().length > cap) {
      return NextResponse.json({
        error: `${f} is ${String(b[f]).trim().length} characters; the limit is ${cap}. Shorten it rather than let it be cut.`,
      }, { status: 400 })
    }
  }
  const sb = svc()
  const { error } = await sb.from('collaboration_pieces').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Somebody who reads Vietnamese has been through it. Records WHO, because
// "reviewed" with no name is a claim nobody can question later.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const id = String(form?.get('id') || '')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  if (!id) return NextResponse.json({ error: 'Which piece?' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: REFUSAL.tooBig(file.size) }, { status: 400 })

  const original = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(original)
  if (!kind || kind === 'pdf') {
    return NextResponse.json({ error: looksHeic(original) ? REFUSAL.heic : REFUSAL.wrongKind }, { status: 400 })
  }
  const { sharp, error: sharpErr } = await getSharp()
  if (!sharp) return NextResponse.json({ error: imagePipelineDown(sharpErr) }, { status: 503 })

  let bytes: Uint8Array
  try {
    // 1600px wide. The guide is read on a phone over mobile data in a room
    // with no wifi worth having; a 4000px original is six seconds of nothing.
    bytes = new Uint8Array(await sharp(Buffer.from(original)).rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true }).toBuffer())
  } catch { return NextResponse.json({ error: REFUSAL.unreadable }, { status: 400 }) }

  const sb = svc()
  const { data: piece } = await sb.from('collaboration_pieces')
    .select('collaboration_id, image_path').eq('id', id).maybeSingle()
  if (!piece) return NextResponse.json({ error: 'No such piece.' }, { status: 404 })

  const path = `studio/pieces/${piece.collaboration_id}/${randomUUID()}.jpg`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (upErr) return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 })
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)

  const { error: insErr } = await sb.from('collaboration_pieces')
    .update({ image_path: pub.publicUrl }).eq('id', id)
  if (insErr) {
    await sb.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: 'Could not record the image.' }, { status: 500 })
  }
  // REPLACING an image leaves the old object orphaned in the bucket unless it
  // is removed here, and a bucket of orphans is how storage bills grow quietly.
  if (piece.image_path?.includes(`/${BUCKET}/`)) {
    const key = piece.image_path.split(`/${BUCKET}/`)[1]
    if (key) await sb.storage.from(BUCKET).remove([key])
  }
  return NextResponse.json({ ok: true, image_path: pub.publicUrl })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('piece')
  if (!id) return NextResponse.json({ error: 'Which piece?' }, { status: 400 })
  const sb = svc()
  const { data: row } = await sb.from('collaboration_pieces').select('image_path').eq('id', id).maybeSingle()
  // Only unlink what WE stored. A path into public/images is a repo asset.
  if (row?.image_path?.includes(`/${BUCKET}/`)) {
    const key = row.image_path.split(`/${BUCKET}/`)[1]
    if (key) await sb.storage.from(BUCKET).remove([key])
  }
  await sb.from('collaboration_pieces').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
