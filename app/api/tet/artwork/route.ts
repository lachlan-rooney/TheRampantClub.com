import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// THE BUYER'S LOGO.
//
// It goes into a PRIVATE bucket. A customer's logo is their property and is
// often unreleased — it is never given a public URL, and the enquiry records
// only the path.
//
// ── THE BYTES NO LONGER COME THROUGH HERE (2026-09-21) ────────────────────
// The limit went from 2MB to 5MB, and raising the number alone would not have
// worked. The file used to arrive as a base64 data URL in the JSON body, and
// base64 is 4/3 the size: a 5MB logo is ~6.7MB on the wire. A serverless
// function on Vercel rejects a request body over 4.5MB before any of this code
// runs, so the upload would have failed with a platform 413 that no message
// here could soften — and it would have failed in production only, because
// `next dev` has no such limit.
//
// So this route hands out a SIGNED UPLOAD URL and the browser PUTs the file
// straight to storage. Nothing large crosses the function at all, which also
// means the 5MB ceiling is no longer the largest thing we can carry — it is
// just the number we chose.
//
// WHAT STILL GUARDS IT:
//   · the pass — the same door as the rest of the page
//   · the rate limit — 20 an hour per IP, unchanged
//   · the mime type — png, jpeg or webp. An SVG is a document that can carry
//     script, and this one is opened later by a member of staff
//   · the SIZE, at the bucket. file_size_limit is 5MB and Supabase enforces it
//     on the real upload, so a client that lies about `size` is refused by
//     storage rather than trusted. The check below is only there to say so
//     politely before the file is sent.
//   · the path — minted here, never supplied by the caller, so nobody can
//     aim an upload at somebody else's object
//
// The file is never decoded, resized or inspected: it is handed to the
// customer's own designer eventually, and re-encoding someone's logo is how a
// brand team ends up with a blurry one.

export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024
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
  const mime = typeof body?.content_type === 'string' ? body.content_type : ''
  const size = Number(body?.size)

  if (!KIND[mime]) {
    return NextResponse.json({ error: 'bad_file', message: 'Please use a PNG, JPEG or WebP.' }, { status: 400 })
  }
  if (Number.isFinite(size) && size > MAX_BYTES) {
    return NextResponse.json({
      error: 'too_big',
      message: `That file is ${(size / 1048576).toFixed(1)}MB. The limit is 5MB.`,
    }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const path = `logos/${randomUUID()}.${KIND[mime]}`
  const { data, error } = await sb.storage.from('tet-artwork').createSignedUploadUrl(path)
  if (error || !data) {
    const missing = /not found|does not exist/i.test(error?.message ?? '')
    return NextResponse.json({
      error: 'upload_failed',
      message: missing ? 'Artwork storage is not set up yet.' : 'That did not upload.',
    }, { status: 503 })
  }

  // The browser gets a one-shot URL for this path and nothing else. Only the
  // path travels on to the enquiry; the image comes back through an admin
  // route when somebody is actually preparing the sleeve.
  return NextResponse.json({ ok: true, path, signed_url: data.signedUrl, max_bytes: MAX_BYTES })
}
