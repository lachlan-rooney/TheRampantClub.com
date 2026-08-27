import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Approve — OWNER ONLY: the actor must equal newsletter_settings.approver_profile.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const a = svc()

  const { data: settings } = await a.from('newsletter_settings').select('approver_profile').eq('id', 1).maybeSingle()
  if (settings?.approver_profile && settings.approver_profile !== user?.id) {
    return NextResponse.json({ error: 'Only the designated approver can approve the newsletter.' }, { status: 403 })
  }

  const { data: row } = await a.from('newsletters').select('status').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.status !== 'pending_approval') return NextResponse.json({ error: 'Only a submitted newsletter can be approved.' }, { status: 400 })

  await a.from('newsletters').update({ status: 'approved', approved_by: user?.id || null, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
  await a.from('newsletter_activity').insert({ newsletter_id: id, actor: user?.id || null, event_type: 'approved', from_status: 'pending_approval', to_status: 'approved' })
  return NextResponse.json({ ok: true })
}
