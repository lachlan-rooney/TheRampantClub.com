import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { gatherRecap } from '@/lib/newsletter/gather'

// Re-pull the frozen recap snapshot (draft/pending only).
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const a = svc()

  const { data: row } = await a.from('newsletters').select('status, period_start, period_end').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.status !== 'draft' && row.status !== 'pending_approval') return NextResponse.json({ error: 'Locked — cannot refresh an approved/sent issue.' }, { status: 400 })

  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const auto = await gatherRecap(a, row.period_start, row.period_end, now)
  await a.from('newsletters').update({ auto_data: auto, updated_at: new Date().toISOString() }).eq('id', id)
  await a.from('newsletter_activity').insert({ newsletter_id: id, actor: user?.id || null, event_type: 'data_refreshed', note: 'Recap re-pulled.' })
  return NextResponse.json({ ok: true, auto_data: auto })
}
