import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/reports/:id/revert { note? } → pending_approval → draft
// (owner wants changes). Re-opens the narrative for editing.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const note = (await req.json().catch(() => ({}))).note
  const sb = svc()
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()

  const { data: r } = await sb.from('weekly_reports').select('status').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (r.status !== 'pending_approval') return NextResponse.json({ error: `Can't revert from ${r.status}.` }, { status: 400 })

  await sb.from('weekly_reports').update({ status: 'draft', submitted_at: null, updated_at: new Date().toISOString() }).eq('id', id)
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'reverted', from_status: 'pending_approval', to_status: 'draft', note: note ? String(note).slice(0, 300) : null })
  return NextResponse.json({ ok: true })
}
