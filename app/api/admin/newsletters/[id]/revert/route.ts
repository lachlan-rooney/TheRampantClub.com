import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Revert pending_approval → draft (also un-approves an approved-but-unsent issue).
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const a = svc()

  const { data: row } = await a.from('newsletters').select('status').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.status !== 'pending_approval' && row.status !== 'approved') return NextResponse.json({ error: 'Nothing to revert.' }, { status: 400 })

  await a.from('newsletters').update({ status: 'draft', submitted_at: null, approved_by: null, approved_at: null, updated_at: new Date().toISOString() }).eq('id', id)
  await a.from('newsletter_activity').insert({ newsletter_id: id, actor: user?.id || null, event_type: 'reverted', from_status: row.status, to_status: 'draft' })
  return NextResponse.json({ ok: true })
}
