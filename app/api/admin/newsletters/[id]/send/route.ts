import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { sendNewsletter } from '@/lib/newsletter/send'

// Send the newsletter.
//   ?dry=1        → returns the rendered email HTML (preview), sends nothing.
//   ?mode=test    → sends to the settings test recipients only, status untouched.
//   (default)     → LIVE members-wide blast; requires the master switch on, the
//                   row approved, and confirm === `SEND-ALL-<count>` in the body.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const dry = searchParams.get('dry') === '1'
  const mode = searchParams.get('mode') === 'test' ? 'test' : 'live'
  const body = await req.json().catch(() => ({}))

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  const res = await sendNewsletter(svc(), id, { dry, mode, confirm: body?.confirm, actor: user?.id || null })

  if (dry && res.ok && res.html) return new NextResponse(res.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  const status = res.ok ? 200 : (res.need ? 409 : 400)
  return NextResponse.json(res, { status })
}
