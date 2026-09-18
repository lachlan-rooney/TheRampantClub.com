import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { sniff, looksHeic, MAX_BYTES, REFUSAL } from '@/lib/attachments/verify'
import { getSharp, imagePipelineDown } from '@/lib/attachments/image'

// LOGOS AND PLATES.
//
// Same discipline as every other upload in this app: the BYTES decide what the
// file is, never the filename, and sharp re-encodes so a phone photo of a dish
// does not carry the GPS of the kitchen it was taken in.
//
// Two shapes, because a logo and a photograph are not the same picture:
//   logo  — PNG, transparency preserved, 600px wide. A restaurant's mark on a
//           dark menu has to keep its alpha or it arrives in a white box.
//   dish  — JPEG, 1400px, q82. Nobody needs a lossless photograph of a plate.
//
// `sharp` is imported through getSharp() and NOT at module scope: a native
// module that fails to load at module scope takes down every export in the
// file, which is a 500 on the whole route rather than one failed upload.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'menu-media'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const shape = String(form?.get('shape') || 'dish')   // 'logo' | 'dish'
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: REFUSAL.tooBig(file.size) }, { status: 400 })

  const original = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(original)
  if (!kind || kind === 'pdf') {
    return NextResponse.json(
      { error: looksHeic(original) ? REFUSAL.heic : REFUSAL.wrongKind },
      { status: 400 })
  }

  const { sharp, error: sharpErr } = await getSharp()
  if (!sharp) return NextResponse.json({ error: imagePipelineDown(sharpErr) }, { status: 503 })

  const isLogo = shape === 'logo'
  let bytes: Uint8Array
  try {
    const img = sharp(Buffer.from(original)).rotate()
    bytes = isLogo
      ? new Uint8Array(await img.resize({ width: 600, withoutEnlargement: true }).png().toBuffer())
      : new Uint8Array(await img.resize({ width: 1400, withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true }).toBuffer())
  } catch {
    return NextResponse.json({ error: REFUSAL.unreadable }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const path = `${isLogo ? 'logos' : 'dishes'}/${randomUUID()}.${isLogo ? 'png' : 'jpg'}`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: isLogo ? 'image/png' : 'image/jpeg', upsert: false,
  })
  if (upErr) return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 })

  // The bare path is returned, not a full URL: mediaUrl() builds the URL at
  // render time, so the stored value survives the project moving.
  return NextResponse.json({ ok: true, path })
}
