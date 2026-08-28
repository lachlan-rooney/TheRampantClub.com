import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Edit newsletter settings: approver, the MASTER send switch, from name/email,
// test recipients, suppression list.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean)
  : typeof v === 'string' ? v.split(/[\n,]/).map(s => s.trim()).filter(Boolean) : []

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user?.id || null }
  // 'me' claims the approver role for the current owner (there's no admin-picker UI).
  if ('approver_profile' in body) patch.approver_profile = body.approver_profile === 'me' ? (user?.id || null) : (body.approver_profile || null)
  if ('send_enabled' in body) patch.send_enabled = !!body.send_enabled
  if (typeof body.from_name === 'string' && body.from_name.trim()) patch.from_name = body.from_name.trim().slice(0, 80)
  if (typeof body.from_email === 'string' && body.from_email.trim()) patch.from_email = body.from_email.trim().slice(0, 120)
  if ('test_recipients' in body) patch.test_recipients = asArray(body.test_recipients)
  if ('suppress' in body) patch.suppress = asArray(body.suppress)

  const { error } = await svc().from('newsletter_settings').update(patch).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
