import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getActor, svc } from '@/lib/social/server'
import { sniff, MAX_BYTES, REFUSAL } from '@/lib/attachments/verify'
import { getSharp, imagePipelineDownMember } from '@/lib/attachments/image'

// POST /api/members/events/[id]/media/upload   (multipart: file)
//
// ═══ WHY THIS ROUTE EXISTS ═════════════════════════════════════════════════
// The gallery used to upload STRAIGHT FROM THE BROWSER to storage:
//
//   supabase.storage.from('event-media').upload(path, file, { contentType: file.type })
//
// Three problems in one line. `contentType` was whatever the browser declared.
// Nothing looked at the bytes. And nothing stripped EXIF — so a member posting a
// photo taken at home published their GPS coordinates and a timestamp to anyone
// who downloaded it. In a 99-member club where discretion is the product, that
// is not a hypothetical harm.
//
// The file now goes through the server, which re-encodes it with sharp. That one
// step strips ALL metadata and simultaneously proves the bytes really are an
// image — an HTML file renamed .jpg cannot survive a decode.
//
// The bucket stays PUBLIC and that is deliberate: gallery photos are members
// sharing with each other, and a signed URL per thumbnail would be miserable.
// Public was never the problem; unchecked content and retained EXIF were.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'This account is not linked to a membership, so it cannot post as a member. Staff accounts need a member number linked in the admin.' }, { status: 403 })
  const { id } = await params
  const a = svc()

  const { data: event } = await a.from('events').select('id, status').eq('id', id).maybeSingle()
  if (!event || event.status !== 'visible') return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: REFUSAL.tooBig(file.size) }, { status: 400 })

  const original = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(original)
  // Images only here — a PDF in the photo gallery is not what this is for.
  if (!kind || kind === 'pdf') return NextResponse.json({ error: REFUSAL.wrongKind }, { status: 400 })

  let bytes: Buffer
  try {
    // .rotate() applies the orientation tag and then discards it; sharp drops all
    // other metadata unless explicitly told to keep it. Everything lands as JPEG,
    // so there is one output type rather than three.
    const { sharp } = await getSharp()
    if (!sharp) return NextResponse.json({ error: imagePipelineDownMember }, { status: 503 })
    bytes = await sharp(Buffer.from(original)).rotate().jpeg({ quality: 82 }).toBuffer()
  } catch {
    return NextResponse.json({ error: REFUSAL.unreadable }, { status: 400 })
  }

  // The path still binds the object to THIS member inside THIS event, so the
  // registration route's ownership check is unchanged.
  const path = `${id}/${actor.id}/${randomUUID()}.jpg`
  const up = await a.storage.from('event-media').upload(path, bytes, {
    contentType: 'image/jpeg',   // from what the bytes ARE, never from the upload
    upsert: false,
  })
  if (up.error) return NextResponse.json({ error: 'Upload failed — try again.' }, { status: 500 })

  const url = a.storage.from('event-media').getPublicUrl(path).data.publicUrl
  return NextResponse.json({ storage_path: path, url })
}
