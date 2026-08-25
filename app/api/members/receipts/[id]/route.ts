import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/members/receipts/:id → download the member's own receipt PDF.
// The 'membership_receipts' bucket is PRIVATE; the browser client has no
// storage access. This is an auth-checked proxy: resolve session → member_no,
// verify the payment belongs to that member, then hand back a short-lived
// signed URL (60s). Never expose the bucket directly.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'membership_receipts'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ error: 'No membership on file.' }, { status: 403 })

  const { data: pay } = await sb.from('membership_payments')
    .select('member_no, pdf_path').eq('id', id).maybeSingle()
  if (!pay || pay.member_no !== prof.member_no) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (!pay.pdf_path) return NextResponse.json({ error: 'Receipt not available yet.' }, { status: 404 })

  const { data: signed, error } = await sb.storage.from(BUCKET).createSignedUrl(pay.pdf_path, 60)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: 'Could not open receipt.' }, { status: 500 })
  return NextResponse.redirect(signed.signedUrl)
}
