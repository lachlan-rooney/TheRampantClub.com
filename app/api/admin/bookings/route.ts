import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/bookings[?from=YYYY-MM-DD&to=YYYY-MM-DD&space=…&status=…]
// POST /api/admin/bookings   — create a booking

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['pending', 'confirmed', 'arrived', 'cancelled', 'no_show']
const ALLOWED_SESSIONS = ['early', 'evening', 'late']

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  const space = searchParams.get('space')
  const status = searchParams.get('status')

  const sb = svc()
  let q = sb.from('bookings_with_member').select('*').order('booking_date').order('start_time', { ascending: true, nullsFirst: false })
  if (from)   q = q.gte('booking_date', from)
  if (to)     q = q.lte('booking_date', to)
  if (space)  q = q.eq('space', space)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data || [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const member_no = String(body.member_no || '').trim()
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const booking_date = String(body.booking_date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return NextResponse.json({ error: 'booking_date must be YYYY-MM-DD' }, { status: 400 })

  const space = String(body.space || '').trim()
  if (!space) return NextResponse.json({ error: 'space required' }, { status: 400 })

  const session_label = typeof body.session_label === 'string' && ALLOWED_SESSIONS.includes(body.session_label)
    ? body.session_label : null
  const start_time = typeof body.start_time === 'string' && /^\d{2}:\d{2}/.test(body.start_time)
    ? body.start_time : null
  const end_time = typeof body.end_time === 'string' && /^\d{2}:\d{2}/.test(body.end_time)
    ? body.end_time : null

  if (!session_label && !start_time) {
    return NextResponse.json({ error: 'either start_time or session_label is required' }, { status: 400 })
  }

  const partyRaw = Number(body.party_size)
  const party_size = Number.isInteger(partyRaw) && partyRaw >= 1 && partyRaw <= 50 ? partyRaw : 1

  const status = typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status) ? body.status : 'confirmed'

  const sb = svc()
  // Quick member existence check for a cleaner error than FK violation.
  const { data: member } = await sb.from('members').select('member_no').eq('member_no', member_no).maybeSingle()
  if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })

  const { data, error } = await sb.from('bookings').insert({
    member_no, booking_date, space, party_size, status,
    session_label,
    start_time,
    end_time,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    created_by: actor,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ booking: data })
}
