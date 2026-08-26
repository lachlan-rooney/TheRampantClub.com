import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/reports/:id/postpone { hours } → hold the auto-send until
// 17:00 VN + hours (capped at 21:00 VN). hours <= 0 clears the hold. The
// send-window cron (hourly 17:00–21:00 VN Mon) dispatches once it lapses.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const vnDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const hours = Math.round(Number((await req.json().catch(() => ({}))).hours))
  const sb = svc()
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()

  const { data: r } = await sb.from('weekly_reports').select('status').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!Number.isFinite(hours) || hours <= 0) {
    await sb.from('weekly_reports').update({ send_postponed_to: null, updated_at: new Date().toISOString() }).eq('id', id)
    await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'postpone_cleared', note: 'send hold cleared' })
    return NextResponse.json({ ok: true, send_postponed_to: null })
  }

  const day = vnDate()
  const base = new Date(`${day}T17:00:00+07:00`).getTime()   // scheduled send
  const cap = new Date(`${day}T21:00:00+07:00`).getTime()    // 9pm VN hard cap
  const target = new Date(Math.min(base + hours * 3600000, cap)).toISOString()

  await sb.from('weekly_reports').update({ send_postponed_to: target, updated_at: new Date().toISOString() }).eq('id', id)
  await sb.from('report_activity').insert({ report_id: id, actor: user?.id || null, event_type: 'postponed', note: `send held until ${new Date(target).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} VN` })
  return NextResponse.json({ ok: true, send_postponed_to: target, capped: base + hours * 3600000 > cap })
}
