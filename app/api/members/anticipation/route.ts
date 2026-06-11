import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// The Anticipation Card's data — the LOGGED-IN member's next upcoming booking,
// composed from real rows only: date/time, space, named table(s), party size, and
// any member-visible event that day. Member-own (session → member_no). No booking
// → null → no card. Never a claim the system can't back.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET() {
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ booking: null })

  // "Today" in the club's timezone (VN, UTC+7) so a late-evening visit still counts as today.
  const vnToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

  const { data: bk } = await sb.from('bookings')
    .select('booking_id, booking_date, start_time, session_label, space, party_size')
    .eq('member_no', prof.member_no)
    .gte('booking_date', vnToday)
    .in('status', ['pending', 'confirmed', 'arrived'])
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (!bk) return NextResponse.json({ booking: null })

  // Named table(s) on this booking.
  const { data: bts } = await sb.from('booking_tables').select('space_tables(name)').eq('booking_id', bk.booking_id)
  const tables = (bts || [])
    .map(r => (Array.isArray(r.space_tables) ? r.space_tables[0]?.name : (r.space_tables as { name?: string } | null)?.name))
    .filter((n): n is string => !!n)

  // Any member-visible event that day (a real, club-published line — never invented).
  const { data: events } = await sb.from('calendar_entries')
    .select('title, start_time').eq('entry_date', bk.booking_date).eq('visibility', 'member')

  return NextResponse.json({
    booking: {
      date: bk.booking_date,
      start_time: bk.start_time,
      session_label: bk.session_label,
      space: bk.space,
      party_size: bk.party_size,
      tables,
    },
    events: (events || []).map(e => ({ title: e.title, start_time: e.start_time })),
  })
}
