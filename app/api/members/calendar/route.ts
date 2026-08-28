import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// A member's personal calendar for a date window: everything that concerns THEM
// — their own bookings, the fixtures they can join (with their signed-up flag),
// and member-visible house happenings. bookings are admin-only under RLS, so we
// read here under service-role and scope strictly to the caller's member_no /
// auth id — a member only ever sees their own bookings.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from/to required (YYYY-MM-DD)' }, { status: 400 })
  }
  const a = svc()

  // The member's own bookings (scoped by member_no; never anyone else's).
  const bookings = actor.memberNo
    ? (await a.from('bookings')
        .select('booking_id, booking_date, start_time, end_time, session_label, space, party_size, status')
        .eq('member_no', actor.memberNo)
        .neq('status', 'cancelled')
        .gte('booking_date', from).lte('booking_date', to)).data || []
    : []

  // Fixtures in the window + the member's own signups (to flag "you're in").
  const [{ data: fixtures }, { data: signups }, { data: entries }] = await Promise.all([
    a.from('fixtures').select('id, sport, title, date, location, max_signups, signup_deadline')
      // fixtures.date is timestamptz — anchor BOTH bounds to VN (+07:00) so an
      // early-morning fixture on the first/last VN day isn't dropped by a UTC
      // interpretation of the bare date.
      .gte('date', from + 'T00:00:00+07:00').lte('date', to + 'T23:59:59+07:00').order('date', { ascending: true }),
    a.from('fixture_signups').select('fixture_id').eq('user_id', actor.id),
    a.from('calendar_entries').select('id, title, entry_date, start_time, end_time, session_label, space, kind')
      .eq('visibility', 'member').gte('entry_date', from).lte('entry_date', to),
  ])

  const signedUp = new Set((signups || []).map(s => s.fixture_id))
  return NextResponse.json({
    bookings,
    fixtures: (fixtures || []).map(f => ({ ...f, signed_up: signedUp.has(f.id) })),
    entries: entries || [],
  })
}
