import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { loadBookingGuests } from '@/lib/guests-server'
import { isMissingColumn } from '@/lib/fixtures'

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
  const FX_COLS = 'id, sport, title, date, location, max_signups, signup_deadline'
  // fixtures.date is timestamptz — anchor BOTH bounds to VN (+07:00) so an
  // early-morning fixture on the first/last VN day isn't dropped by a UTC
  // interpretation of the bare date.
  const fixturesIn = (cols: string) => a.from('fixtures').select(cols)
    .gte('date', from + 'T00:00:00+07:00').lte('date', to + 'T23:59:59+07:00').order('date', { ascending: true })
  // A place staff added carries the member_no, and may have no login on it yet
  // (added from the Zalo list before the account was linked) — it is still theirs.
  // Scoped to the caller's OWN member_no, so this can match no one else's row.
  const mySignups = () => actor.memberNo
    ? a.from('fixture_signups').select('fixture_id').or(`user_id.eq.${actor.id},member_no.eq."${actor.memberNo.replace(/"/g, '')}"`)
    : a.from('fixture_signups').select('fixture_id').eq('user_id', actor.id)
  let [fxRes, suRes, { data: entries }] = await Promise.all([
    fixturesIn(`${FX_COLS}, is_full`),
    mySignups(),
    a.from('calendar_entries').select('id, title, title_vn, entry_date, start_time, end_time, session_label, space, kind')
      .eq('visibility', 'member').gte('entry_date', from).lte('entry_date', to),
  ])
  // Before db/fixture_attendees.sql: no is_full, no member_no — the calendar as it was.
  if (fxRes.error && isMissingColumn(fxRes.error)) fxRes = await fixturesIn(FX_COLS)
  if (suRes.error && isMissingColumn(suRes.error)) suRes = await a.from('fixture_signups').select('fixture_id').eq('user_id', actor.id)
  const fixtures = fxRes.data as unknown as { id: string }[] | null
  const signups = suRes.data as { fixture_id: string }[] | null

  // The guest names on the member's OWN bookings (2026-09-14) — the ids above are
  // already scoped to their member_no, so this cannot reach anyone else's list.
  // Member-safe fields only.
  const { ready: guests_ready, byBooking } = await loadBookingGuests(a, (bookings as { booking_id: string }[]).map(b => b.booking_id))

  const signedUp = new Set((signups || []).map(s => s.fixture_id))
  return NextResponse.json({
    guests_ready,
    bookings: (bookings as { booking_id: string }[]).map(b => ({
      ...b,
      guests: (byBooking.get(b.booking_id) || []).map(g => ({ id: g.id, guest_name: g.guest_name, signed_in: g.signed_in })),
    })),
    fixtures: (fixtures || []).map(f => ({ ...f, signed_up: signedUp.has(f.id) })),
    entries: entries || [],
  })
}
