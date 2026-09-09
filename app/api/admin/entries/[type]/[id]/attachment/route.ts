import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'
import { randomUUID } from 'crypto'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sniff, looksHeic, MIME_OF, EXT_OF, MAX_BYTES, REFUSAL } from '@/lib/attachments/verify'
import { getSharp, imagePipelineDown } from '@/lib/attachments/image'

// POST   /api/admin/entries/[type]/[id]/attachment   — replace the entry's file
// DELETE /api/admin/entries/[type]/[id]/attachment   — remove it
//
// ADMIN ONLY. Members never upload here — the gallery is the one place members
// post content, and it is a separate, moderated path.
//
// Reuses the SERVER-SIDE pattern (service role, validated, re-encoded), not the
// gallery's client-direct upload which takes Content-Type from the browser and
// strips no EXIF.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'entry-attachments'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TYPES = ['fixture', 'calendar_entry'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ type: string; id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { type, id } = await ctx.params
  const { data } = await svc().from('entry_attachments')
    .select('id, mime, filename, bytes, verified_kind, created_at')
    .eq('entity_type', type).eq('entity_id', id).maybeSingle()
  return NextResponse.json({ attachment: data ?? null })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ type: string; id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { type, id } = await ctx.params
  if (!(TYPES as readonly string[]).includes(type)) return NextResponse.json({ error: 'Unknown entry type.' }, { status: 400 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: REFUSAL.tooBig(file.size) }, { status: 400 })

  const original = new Uint8Array(await file.arrayBuffer())

  // ── THE CONTENT CHECK. Extension and declared Content-Type are both ignored.
  const kind = sniff(original)
  if (!kind) {
    return NextResponse.json({ error: looksHeic(original) ? REFUSAL.heic : REFUSAL.wrongKind }, { status: 400 })
  }

  let bytes: Uint8Array = original
  if (kind === 'pdf') {
    // Cannot re-encode a PDF without risking the layout, so PARSE it to prove it
    // is really a PDF and not merely something starting with %PDF-, then store
    // the ORIGINAL bytes untouched.
    try { await PDFDocument.load(original, { ignoreEncryption: false }) }
    catch { return NextResponse.json({ error: REFUSAL.badPdf }, { status: 400 }) }
  } else {
    // Re-encode through sharp. Two jobs at once: it STRIPS EXIF (a phone photo
    // carries GPS and a timestamp — sharp drops all metadata unless told to keep
    // it) and it proves the bytes really decode as an image.
    const { sharp, error: sharpErr } = await getSharp()
    if (!sharp) return NextResponse.json({ error: imagePipelineDown(sharpErr) }, { status: 503 })
    try {
      const img = sharp(Buffer.from(original)).rotate()
      bytes = new Uint8Array(
        kind === 'png' ? await img.png().toBuffer()
        : kind === 'webp' ? await img.webp({ quality: 88 }).toBuffer()
        : await img.jpeg({ quality: 88 }).toBuffer()
      )
    } catch { return NextResponse.json({ error: REFUSAL.unreadable }, { status: 400 }) }
  }

  const sb = svc()
  const path = `${type}/${id}/${randomUUID()}.${EXT_OF[kind]}`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
    // Set EXPLICITLY from what the bytes proved to be, never from the upload.
    contentType: MIME_OF[kind],
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 })

  // One per entry: clear the old row AND its object, so replacing a file does
  // not leave the previous one sitting in the bucket unreferenced.
  const { data: prev } = await sb.from('entry_attachments')
    .select('id, storage_path').eq('entity_type', type).eq('entity_id', id).maybeSingle()
  if (prev?.storage_path) await sb.storage.from(BUCKET).remove([prev.storage_path])
  if (prev?.id) await sb.from('entry_attachments').delete().eq('id', prev.id)

  const cookieSb = await createServerSupabaseClient()
  const { data: { user } } = await cookieSb.auth.getUser()

  const { data: row, error: insErr } = await sb.from('entry_attachments').insert({
    entity_type: type, entity_id: id, storage_path: path,
    mime: MIME_OF[kind], bytes: bytes.length,
    filename: (file.name || `attachment.${EXT_OF[kind]}`).slice(0, 200),
    verified_kind: kind, uploaded_by: user?.id ?? null,
  }).select('id, mime, filename, bytes, verified_kind').single()

  if (insErr) {
    await sb.storage.from(BUCKET).remove([path])   // don't orphan the object
    return NextResponse.json({ error: 'Could not record the file.' }, { status: 500 })
  }
  return NextResponse.json({ attachment: row })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ type: string; id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { type, id } = await ctx.params
  const sb = svc()
  const { data: row } = await sb.from('entry_attachments')
    .select('id, storage_path').eq('entity_type', type).eq('entity_id', id).maybeSingle()
  if (!row) return NextResponse.json({ ok: true, nothing_to_remove: true })
  await sb.storage.from(BUCKET).remove([row.storage_path])
  await sb.from('entry_attachments').delete().eq('id', row.id)
  return NextResponse.json({ ok: true })
}
