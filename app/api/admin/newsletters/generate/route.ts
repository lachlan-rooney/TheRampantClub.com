import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { gatherRecap } from '@/lib/newsletter/gather'

// Create (or refresh) this month's newsletter draft with a frozen recap snapshot.
// Idempotent on the VN month (period_start, period_end).
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function vnMonth() {
  const vnNow = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) // YYYY-MM-DD
  const [y, m] = vnNow.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { start, end, now: vnNow }
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const a = svc()
  const { start, end, now } = vnMonth()

  const auto = await gatherRecap(a, start, end, now)

  // Existing draft/pending for this month → refresh its snapshot; else insert.
  const { data: existing } = await a.from('newsletters').select('id, status').eq('period_start', start).eq('period_end', end).maybeSingle()
  if (existing) {
    if (existing.status === 'draft' || existing.status === 'pending_approval') {
      await a.from('newsletters').update({ auto_data: auto, updated_at: new Date().toISOString() }).eq('id', existing.id)
      await a.from('newsletter_activity').insert({ newsletter_id: existing.id, actor: user?.id || null, event_type: 'data_refreshed', note: 'Recap re-pulled at generate.' })
    }
    return NextResponse.json({ id: existing.id, existing: true })
  }

  const ins = await a.from('newsletters').insert({
    period_start: start, period_end: end,
    subject: `The Rampant Club — ${auto.period.label}`,
    status: 'draft', auto_data: auto, sections: {}, created_by: user?.id || null,
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
  await a.from('newsletter_activity').insert({ newsletter_id: ins.data.id, actor: user?.id || null, event_type: 'generated', to_status: 'draft' })
  return NextResponse.json({ id: ins.data.id })
}
