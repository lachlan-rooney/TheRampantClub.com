import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/reports/:id/approve → pending_approval → approved.
// Owner-only: the actor must be the configured approver_profile.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = svc()
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()

  const { data: settings } = await sb.from('report_settings').select('approver_profile').eq('id', 1).maybeSingle()
  if (settings?.approver_profile && user?.id !== settings.approver_profile) {
    return NextResponse.json({ error: 'Only the designated approver can approve this report.' }, { status: 403 })
  }

  const { data: r } = await sb.from('weekly_reports').select('status').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (r.status !== 'pending_approval') return NextResponse.json({ error: `Can't approve from ${r.status}.` }, { status: 400 })

  await sb.from('weekly_reports').update({ status: 'approved', approved_by: user?.id || null, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'approved', from_status: 'pending_approval', to_status: 'approved' })
  return NextResponse.json({ ok: true })
}
