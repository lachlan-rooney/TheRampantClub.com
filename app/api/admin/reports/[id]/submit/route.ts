import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { dispatchPendingEmails } from '@/lib/ops/notify-dispatch'

// POST /api/admin/reports/:id/submit → draft → pending_approval + nudge the owner
// (in-app + email) to review and approve.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = svc()
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()

  const { data: r } = await sb.from('weekly_reports').select('status, period_end').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (r.status !== 'draft') return NextResponse.json({ error: `Can't submit from ${r.status}.` }, { status: 400 })

  await sb.from('weekly_reports').update({ status: 'pending_approval', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'submitted', from_status: 'draft', to_status: 'pending_approval' })

  // Nudge the configured approver (skips if approver === submitter).
  const { data: settings } = await sb.from('report_settings').select('approver_profile').eq('id', 1).maybeSingle()
  if (settings?.approver_profile) {
    await sb.rpc('ops_make_notification', {
      p_recipient: settings.approver_profile,
      p_actor: user?.id || null,
      p_type: 'report_awaiting_approval',
      p_event_id: null,
      p_metadata: { title: 'Weekly report ready for approval', link: `/admin/reports/${id}`, period_end: r.period_end },
    })
    try { await dispatchPendingEmails(sb) } catch { /* quiet-hours/backstop */ }
  }
  return NextResponse.json({ ok: true })
}
