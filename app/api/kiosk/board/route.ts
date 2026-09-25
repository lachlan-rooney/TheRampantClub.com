import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { doorClock } from '@/lib/guests'

// The idle board. BOARD mode has NO identity by design, so it cannot read through
// RLS. The event half is kiosk_board(), which returns a fixed set of non-PII columns.
//
// The device token resolves the ROOM. No device → nothing, not an error page.
//
// TONIGHT'S BOOKINGS, WITH NAMES (owner's decision, 2026-09-15). The Phase 2 design
// kept bookings off this screen as PII facing the room. The owner overruled that:
// the floor tablets are internal and staff need to see who is booked into the room
// ("a person's booking not coming up on floor 4"). So the route adds the room's
// bookings for the service date — name, time, party size, arrived — and nothing
// else: no notes, no phone, no member number. kiosk_board() itself still never
// reads bookings; this list rides beside it, and only once that function has
// proved the device is enrolled and told us which room it stands in.

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return NextResponse.json({ board: null }, { status: 403 })
  const a = svc()
  const { data } = await a.rpc('kiosk_board', { p_device_token: token })
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.room) return NextResponse.json({ board: row || null })

  // The same service date as the door: the small hours belong to the evening before.
  const { serviceDate } = doorClock()
  const { data: rows } = await a.from('bookings')
    .select('booking_id, member_no, start_time, party_size, status, arrived_at')
    .eq('space', row.room).eq('booking_date', serviceDate)
    .in('status', ['pending', 'confirmed', 'arrived'])
    .order('start_time', { ascending: true, nullsFirst: false })

  const list = rows || []
  const names = new Map<string, { full_name: string | null; nickname: string | null }>()
  const nos = [...new Set(list.map(b => b.member_no).filter(Boolean))] as string[]
  if (nos.length) {
    const { data: ms } = await a.from('members').select('member_no, full_name, nickname').in('member_no', nos)
    for (const m of ms || []) names.set(m.member_no, { full_name: m.full_name, nickname: m.nickname })
  }

  // ── WHAT'S ON AT THE CLUB ───────────────────────────────────────────────
  // Owner, 2026-09-25: "Why is the home screen on the kiosk so shit? Can it
  // pull through what's on or something at least?" A room with nothing booked
  // in it said "The room is yours" and stopped, which is true and empty. The
  // club always has something coming; the tablet just never knew about it.
  //
  // Fixtures the members can sign up to, and house entries staff have ticked
  // "show on the room tablets" — the same flag the boards already honour, so
  // nothing private appears by accident. Four at most: it is a glance, not a
  // list, and it shares the screen with the way in.
  const today = serviceDate
  const [fx, ce] = await Promise.all([
    a.from('fixtures').select('id, title, date, type, max_signups, is_full')
      .gte('date', today).order('date').limit(6),
    a.from('calendar_entries').select('title, title_vn, entry_date, start_time, space, kind')
      .eq('show_on_board', true).eq('visibility', 'member')
      .gte('entry_date', today).order('entry_date').limit(6),
  ])
  const counts = await a.rpc('fixture_signup_counts')
  const signups = new Map(((counts.data || []) as { fixture_id: string; signups?: number }[])
    .map(c => [c.fixture_id, Number(c.signups ?? 0)]))
  const whatsOn = [
    ...((fx.data || []) as { id: string; title: string; date: string; type: string; max_signups: number | null; is_full: boolean | null }[])
      .map(f => ({
        kind: 'fixture' as const,
        title: f.title.trim(),
        title_vn: null as string | null,
        at: f.date,
        // A fixture staff have marked full is full, however many names are in.
        taken: f.is_full && f.max_signups != null
          ? Math.max(signups.get(f.id) || 0, f.max_signups)
          : (signups.get(f.id) || 0),
        seats: f.max_signups,
      })),
    ...((ce.data || []) as { title: string; title_vn: string | null; entry_date: string; start_time: string | null; space: string | null }[])
      .map(e => ({
        kind: 'house' as const,
        title: e.title,
        title_vn: e.title_vn,
        at: e.start_time ? `${e.entry_date}T${e.start_time}` : e.entry_date,
        taken: null as number | null,
        seats: null as number | null,
      })),
  ].sort((x, y) => x.at.localeCompare(y.at)).slice(0, 4)

  return NextResponse.json({
    board: {
      ...row,
      whats_on: whatsOn,
      bookings: list.map(b => {
        const m = names.get(b.member_no)
        return {
          id: b.booking_id,
          time: b.start_time ? String(b.start_time).slice(0, 5) : null,
          name: m?.full_name || m?.nickname || 'Member',
          nickname: m?.full_name && m?.nickname ? m.nickname : null,
          party: b.party_size ?? null,
          arrived: b.status === 'arrived' || !!b.arrived_at,
        }
      }),
    },
  })
}
