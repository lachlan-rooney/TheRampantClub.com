import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { dispatchPendingEmails } from '@/lib/ops/notify-dispatch'

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const a = svc()

  const { data: row } = await a.from('newsletters').select('status, subject').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.status !== 'draft') return NextResponse.json({ error: 'Only a draft can be submitted.' }, { status: 400 })

  await a.from('newsletters').update({ status: 'pending_approval', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
  await a.from('newsletter_activity').insert({ newsletter_id: id, actor: user?.id || null, event_type: 'submitted', from_status: 'draft', to_status: 'pending_approval' })

  // Nudge the approver (in-app + email), unless they submitted it themselves.
  const { data: settings } = await a.from('newsletter_settings').select('approver_profile').eq('id', 1).maybeSingle()
  const approver = settings?.approver_profile
  if (approver && approver !== user?.id) {
    try {
      await a.rpc('ops_make_notification', { p_recipient: approver, p_actor: user?.id || null, p_type: 'newsletter_awaiting_approval', p_event_id: null, p_metadata: { title: row.subject, link: `/admin/newsletters/${id}` } })
      await dispatchPendingEmails(a)
    } catch { /* nudge is best-effort */ }
  }
  return NextResponse.json({ ok: true })
}
