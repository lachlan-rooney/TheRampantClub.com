import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Staff time off & public holidays for the admin calendar.
//   GET ?from=&to=  → time-off rows OVERLAPPING that window + the staff roster.
//   POST            → create a leave row (or a club-wide public holiday).
export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const KINDS = ['annual_leave', 'public_holiday', 'sick', 'unpaid']

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from'), to = searchParams.get('to')
  const a = svc()
  let q = a.from('staff_time_off').select('*').order('start_date', { ascending: true })
  // Overlap: starts on/before the window end AND ends on/after the window start.
  if (to) q = q.lte('start_date', to)
  if (from) q = q.gte('end_date', from)
  const [{ data: rows, error }, { data: roster }] = await Promise.all([
    q,
    a.rpc('kiosk_staff_roster'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ time_off: rows || [], roster: roster || [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : null
  if (!kind) return NextResponse.json({ error: 'kind required' }, { status: 400 })
  const start_date = String(body.start_date || '')
  const end_date = String(body.end_date || start_date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) return NextResponse.json({ error: 'start_date required (YYYY-MM-DD)' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) return NextResponse.json({ error: 'bad end_date' }, { status: 400 })
  if (end_date < start_date) return NextResponse.json({ error: 'end date is before start date' }, { status: 400 })

  const a = svc()
  let team_member_id: string | null = null
  let member_name: string | null = null
  if (kind === 'public_holiday') {
    // Club-wide — no person.
  } else {
    team_member_id = typeof body.team_member_id === 'string' && body.team_member_id ? body.team_member_id : null
    if (!team_member_id) return NextResponse.json({ error: 'Pick a staff member.' }, { status: 400 })
    const { data: tm } = await a.from('team_members').select('display_name').eq('id', team_member_id).maybeSingle()
    member_name = tm?.display_name || null
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null

  const ins = await a.from('staff_time_off').insert({
    team_member_id, member_name, kind, start_date, end_date, note, created_by: actor,
  }).select('*').single()
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
  return NextResponse.json({ time_off: ins.data })
}
