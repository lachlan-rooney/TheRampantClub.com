import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// THE BUYER'S LOGO.
//
// It arrives as a data URL from the sleeve studio, because the preview needs it
// in the browser anyway, and goes straight into a PRIVATE bucket. A customer's
// logo is their property and is often unreleased — it is never given a public
// URL, and the enquiry records only the path.
//
// WHAT IS REFUSED, and why each one:
//   · anything but png, jpeg or webp — an SVG is a document that can carry
//     script, and this one would be opened later by a member of staff
//   · over 2MB — the bucket refuses it too, but saying so here is kinder than
//     a storage error
//   · anyone without a pass — the same door as the rest of the page
//
// The file is never decoded, resized or inspected beyond its header: it is
// handed to the customer's own designer eventually, and re-encoding someone's
// logo is how a brand team ends up with a blurry one.

export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024
const KIND: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 20
const hits = new Map<string, { n: number; until: number }>()
function tooMany(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || rec.until < now) { hits.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  rec.n += 1
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  return rec.n > MAX_PER_HOUR
}

export async function POST(req: Request) {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return NextResponse.json({ error: 'not_open' }, { status: 403 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) return NextResponse.json({ error: 'too_many', message: 'Too many uploads. Try again later.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const dataUrl = typeof body?.data_url === 'string' ? body.data_url : ''
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) {
    return NextResponse.json({ error: 'bad_file', message: 'Please use a PNG, JPEG or WebP.' }, { status: 400 })
  }

  const [, mime, b64] = m
  const bytes = Buffer.from(b64, 'base64')
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({
      error: 'too_big',
      message: `That file is ${(bytes.byteLength / 1048576).toFixed(1)}MB. The limit is 2MB.`,
    }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const path = `logos/${randomUUID()}.${KIND[mime]}`
  const { error } = await sb.storage.from('tet-artwork').upload(path, bytes, { contentType: mime, upsert: false })
  if (error) {
    const missing = /not found|does not exist/i.test(error.message)
    return NextResponse.json({
      error: 'upload_failed',
      message: missing ? 'Artwork storage is not set up yet.' : 'That did not upload.',
    }, { status: 503 })
  }

  // Only the path travels on. The image comes back through an admin route when
  // somebody is actually preparing the sleeve.
  return NextResponse.json({ ok: true, path, bytes: bytes.byteLength })
}
