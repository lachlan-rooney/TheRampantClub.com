import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { sendReport } from '@/lib/reports/send'

// POST /api/admin/reports/:id/send        → send the approved report.
// POST /api/admin/reports/:id/send?dry=1  → render the email HTML, send nothing.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const sb = svc()
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()

  const res = await sendReport(sb, id, { dry, actor: user?.id })
  if (dry) return new NextResponse(res.html || res.error || '', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json(res)
}
