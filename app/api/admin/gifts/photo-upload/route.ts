import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/gifts/photo-upload
// Body: { member_no, filename }
//
// Returns a signed upload URL the client uses to PUT the file directly
// into the gift-photos bucket, plus the resolved storage path the client
// should save into gifts.photo_url. We don't proxy the bytes through the
// server — Supabase Storage's signed-URL flow lets the browser upload
// directly.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { member_no?: unknown; filename?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const member_no = typeof body.member_no === 'string' ? body.member_no.trim() : ''
  const filename  = typeof body.filename  === 'string' ? body.filename.trim()  : ''
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  if (!filename)  return NextResponse.json({ error: 'filename required' }, { status: 400 })

  // Sanitize filename — strip path separators, clamp length, keep the extension.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${member_no}/${Date.now()}_${safeName}`

  const sb = svc()
  // createSignedUploadUrl returns { signedUrl, token, path } — the client
  // PUTs the file to signedUrl with the bucket header set automatically by
  // the supabase-js client when it uses uploadToSignedUrl.
  const { data, error } = await sb.storage.from('gift-photos').createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    path,
    token: data.token,
    signed_url: data.signedUrl,
  })
}

export async function GET(req: NextRequest) {
  // Sibling helper: given a storage path, return a short-lived signed read
  // URL so the ledger UI can display the photo without making the bucket
  // public.
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const sb = svc()
  const { data, error } = await sb.storage.from('gift-photos').createSignedUrl(path, 3600)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
