import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Staff time off & public holidays — for the admin calendar AND the rota.
//   GET ?from=&to=                → time-off rows OVERLAPPING that window + the staff roster.
//   POST                          → create a leave row (or a club-wide public holiday).
//   DELETE ?team_member_id=&date= → take ONE day out of that person's time off.
//
// 2026-09-14: staff_time_off is the single source of truth for who is off.
// The rota used to keep its own per-day table (rota_unavailability), which the
// calendar never read and which never read the calendar — leave booked in one
// place was invisible in the other. See db/rota_unavailability_retire.sql.
export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const KINDS = ['annual_leave', 'public_holiday', 'sick', 'unpaid']
const ISO = /^\d{4}-\d{2}-\d{2}$/

// Date-only maths in UTC, so a day never slips across a timezone boundary.
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

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
    // Every ACTIVE team member, not kiosk_staff_roster(). That function lists
    // only people with a PIN — right for the kiosk, wrong here: 2026-09-14 the
    // cleaners (Miss Lan, Mr Van) have no PIN, so their leave couldn't be booked.
    a.from('team_members').select('id, display_name, role_title').eq('active', true).order('display_name'),
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
  if (!ISO.test(start_date)) return NextResponse.json({ error: 'start_date required (YYYY-MM-DD)' }, { status: 400 })
  if (!ISO.test(end_date)) return NextResponse.json({ error: 'bad end_date' }, { status: 400 })
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

// Clear ONE day for one person — the rota's weekly grid, where a manager
// un-ticks Thursday. Leave is stored as ranges, so a day in the middle of a
// ten-day booking can't just be deleted: the range SHRINKS (day at either end)
// or SPLITS in two (day in the middle). Every range of that person covering the
// day is cut, so overlapping bookings can't leave them still "off".
// Public holidays have no team_member_id, so they are never touched here.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const team_member_id = searchParams.get('team_member_id') || ''
  const date = searchParams.get('date') || ''
  if (!team_member_id) return NextResponse.json({ error: 'team_member_id required' }, { status: 400 })
  if (!ISO.test(date)) return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })

  const a = svc()
  const { data: rows, error } = await a.from('staff_time_off').select('*')
    .eq('team_member_id', team_member_id).lte('start_date', date).gte('end_date', date)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const r of rows || []) {
    let res
    if (r.start_date === date && r.end_date === date) {
      res = await a.from('staff_time_off').delete().eq('id', r.id)
    } else if (r.start_date === date) {
      res = await a.from('staff_time_off').update({ start_date: addDays(date, 1) }).eq('id', r.id)
    } else if (r.end_date === date) {
      res = await a.from('staff_time_off').update({ end_date: addDays(date, -1) }).eq('id', r.id)
    } else {
      // Split. The tail is written FIRST: if the second write then fails, the
      // worst case is two overlapping rows (still off, nothing lost) — the other
      // order could drop the back half of someone's leave.
      const tail = await a.from('staff_time_off').insert({
        team_member_id: r.team_member_id, member_name: r.member_name, kind: r.kind, note: r.note,
        created_by: r.created_by, start_date: addDays(date, 1), end_date: r.end_date,
      })
      if (tail.error) return NextResponse.json({ error: tail.error.message }, { status: 500 })
      res = await a.from('staff_time_off').update({ end_date: addDays(date, -1) }).eq('id', r.id)
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, changed: (rows || []).length })
}
