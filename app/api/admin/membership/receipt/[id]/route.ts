import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/membership/receipt/:id → admin download of any receipt PDF
// (short-lived signed URL from the private bucket). Admin-gated.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'membership_receipts'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = svc()
  const { data: pay } = await sb.from('membership_payments').select('pdf_path').eq('id', id).maybeSingle()
  if (!pay?.pdf_path) return NextResponse.json({ error: 'Receipt not available.' }, { status: 404 })
  const { data: signed, error } = await sb.storage.from(BUCKET).createSignedUrl(pay.pdf_path, 60)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: 'Could not open receipt.' }, { status: 500 })
  return NextResponse.redirect(signed.signedUrl)
}
