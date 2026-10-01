import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaff, denyDevice, denyStaff } from '@/lib/kiosk/server'
import { loadBookingGuests } from '@/lib/guests-server'
import { doorClock } from '@/lib/guests'

// TONIGHT — THE WHOLE BUILDING, AND WHO IS COMING WITH THEM.
//
// Two things the floor could not see, and one of them had been asked for since
// September.
//
// ── 1. THE GUEST NAMES ────────────────────────────────────────────────────
// Members and the desk have been able to name a booking's guests in advance
// since db/guest_signin.sql, and the door tablet checks arrivals against that
// list. The FLOOR never saw it. So a server who met four people at the top of
// the stairs could see "party of 5" and not one of the four names the club
// already held — and the guest standing in front of them had, in many cases,
// already signed in downstairs.
//
// Each name carries whether they have signed in, and who put them on the list
// (the member or us), because "Mr Hoang's guest, already signed in" and "a name
// the desk typed and nobody has seen" are different situations on the floor.
//
// ── 2. THE WHOLE BUILDING, NOT THIS ROOM ──────────────────────────────────
// /api/kiosk/board deliberately returns only the bookings for the room the
// tablet stands in — it is the idle board, facing the room, with no identity
// behind it. This is the opposite case: somebody has entered a PIN, and the
// question they have is "who is in the club tonight", which they currently
// answer by walking up two floors.
//
// ── WHAT IS NOT HERE ──────────────────────────────────────────────────────
// No notes, no phone numbers, no member numbers, no guest NOTES. A name, a
// time, a room, a party size and whether they are in. The dossier is its own
// screen behind the same PIN and asks for a member by name; it is not folded
// into a list that sits open on a tablet.
//
// The service date comes from doorClock(), so the small hours still belong to
// the evening that is still going on — the same clock the door uses, because
// "tonight" must mean one thing in the building.

export const dynamic = 'force-dynamic'

type Guest = { name: string; signed_in: boolean; by: 'member' | 'staff' }

export async function GET() {
  if (!(await deviceOk())) return denyDevice()
  const me = await actingStaff()
  if (!me) return denyStaff()

  const a = svc()
  const { serviceDate } = doorClock()

  const [bookingsRes, diaryRes, fixturesRes, countsRes, entriesRes] = await Promise.all([
    a.from('bookings')
      .select('booking_id, member_no, start_time, party_size, space, status, arrived_at, members(full_name, nickname)')
      .eq('booking_date', serviceDate).neq('status', 'cancelled')
      .order('start_time', { ascending: true, nullsFirst: false }),
    // Staff-booked parties: a calendar entry with covers and no member behind
    // it. On the floor these are indistinguishable from a booking, so they are
    // on the same list rather than in a section somebody has to remember.
    a.from('calendar_entries')
      .select('id, title, title_vn, start_time, space, covers, arrived_at, arrived_covers, kind')
      .eq('entry_date', serviceDate).not('covers', 'is', null)
      .then(r => r, () => ({ data: null } as never)),
    // WHAT'S ON. Today only: the hub asks "what is on tonight", and a fixture
    // three weeks out is a different question, answered on the member screens.
    a.from('fixtures').select('id, title, date, type, max_signups, is_full')
      .eq('date', serviceDate),
    a.rpc('fixture_signup_counts').then(r => r, () => ({ data: null } as never)),
    a.from('calendar_entries').select('title, title_vn, start_time, space, kind')
      .eq('entry_date', serviceDate).eq('show_on_board', true).eq('visibility', 'member')
      .order('start_time', { ascending: true, nullsFirst: false }),
  ])

  const bookings = (bookingsRes.data || []) as unknown as {
    booking_id: string; member_no: string | null; start_time: string | null
    party_size: number | null; space: string | null; status: string; arrived_at: string | null
    members: { full_name: string | null; nickname: string | null } | null
  }[]

  // The guest lists, in one query for the whole evening. `ready` is false where
  // db/guest_signin.sql has not run, and the tablet says "guest names are not
  // set up yet" rather than drawing an empty list that looks like the truth.
  const { ready, byBooking } = await loadBookingGuests(a, bookings.map(b => b.booking_id))

  const rows = bookings.map(b => {
    const guests: Guest[] = (byBooking.get(b.booking_id) || [])
      .map(g => ({ name: g.guest_name, signed_in: g.signed_in, by: g.added_by_kind }))
    return {
      kind: 'booking' as const,
      id: b.booking_id,
      time: b.start_time ? String(b.start_time).slice(0, 5) : null,
      name: b.members?.full_name || b.members?.nickname || 'Member',
      nickname: b.members?.full_name && b.members?.nickname ? b.members.nickname : null,
      space: b.space,
      party: b.party_size ?? null,
      arrived: b.status === 'arrived' || !!b.arrived_at,
      guests,
      // Named in advance but not yet seen. This is the number worth a glance:
      // it is how many people are expected who nobody has met.
      awaited: guests.filter(g => !g.signed_in).length,
    }
  })

  const diary = ((diaryRes.data || []) as {
    id: string; title: string; title_vn: string | null; start_time: string | null
    space: string | null; covers: number | null; arrived_at: string | null; arrived_covers: number | null
  }[]).map(e => ({
    kind: 'party' as const,
    id: e.id,
    time: e.start_time ? String(e.start_time).slice(0, 5) : null,
    name: e.title,
    name_vn: e.title_vn,
    space: e.space,
    party: e.covers ?? null,
    arrived: !!e.arrived_at,
    arrived_covers: e.arrived_covers ?? null,
  }))

  const signups = new Map(((countsRes.data || []) as { fixture_id: string; signups?: number }[])
    .map(c => [c.fixture_id, Number(c.signups ?? 0)]))

  const whatsOn = [
    ...((fixturesRes.data || []) as { id: string; title: string; type: string; max_signups: number | null; is_full: boolean | null }[])
      .map(f => ({
        kind: 'fixture' as const, title: f.title.trim(), title_vn: null as string | null,
        type: f.type, time: null as string | null, space: null as string | null,
        // A fixture staff marked full is full, whatever the sign-up rows say.
        taken: f.is_full && f.max_signups != null
          ? Math.max(signups.get(f.id) || 0, f.max_signups) : (signups.get(f.id) || 0),
        seats: f.max_signups,
      })),
    ...((entriesRes.data || []) as { title: string; title_vn: string | null; start_time: string | null; space: string | null; kind: string }[])
      .map(e => ({
        kind: 'house' as const, title: e.title, title_vn: e.title_vn, type: e.kind,
        time: e.start_time ? String(e.start_time).slice(0, 5) : null, space: e.space,
        taken: null as number | null, seats: null as number | null,
      })),
  ]

  return NextResponse.json({
    date: serviceDate,
    guest_names_ready: ready,
    rows: [...rows, ...diary].sort((x, y) => (x.time || '99').localeCompare(y.time || '99')),
    whats_on: whatsOn,
    totals: {
      booked: rows.length + diary.length,
      covers: [...rows, ...diary].reduce((n, r) => n + (r.party || 0), 0),
      guests_named: rows.reduce((n, r) => n + r.guests.length, 0),
      guests_awaited: rows.reduce((n, r) => n + r.awaited, 0),
    },
  })
}
