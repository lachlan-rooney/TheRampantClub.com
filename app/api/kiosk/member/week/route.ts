import { NextResponse } from 'next/server'
import { memberSession, memberClient } from '@/lib/kiosk/server'
import { vnDateString } from '@/lib/datetime'

// WHAT'S ON — the next seven days, across every room, read AS THE MEMBER.
//
// WHY THIS ROUTE EXISTS AT ALL, since /members/events already does this:
// that page reads client-side under the browser's own Supabase session. The kiosk
// has no such session and never will — the member identity is an opaque cookie
// exchanged server-side for a 60-second JWT that never reaches the browser. So the
// PRESENTATION is reused wholesale and the FETCH cannot be. RLS still does the
// enforcing here; the filters below are for scope, not for safety.
//
// COLUMN DISCIPLINE. Everything selected is readable over the member's shoulder by
// whoever is standing behind them, so:
//   · NOT calendar_entries.description — an internal operational note
//   · NOT calendar_entries.attendee    — names who an entry is with
//   · NOT fixtures.description / results / max_signups / signup_deadline
//   · fixture_signups is NEVER queried. Who is playing is the same
//     shoulder-height problem as `attendee`, so the table is simply not touched.

export const dynamic = 'force-dynamic'

// SEVEN days INCLUSIVE — today plus six. That is exactly one of each weekday, so
// the day labels can never show the same weekday twice. An eighth day would
// reintroduce the duplicate the labels would then have to disambiguate.
const DAYS = 7

export async function GET() {
  const session = await memberSession()
  if (!session) return NextResponse.json({ week: null }, { status: 401 })

  const mc = memberClient(session.profileId)
  const from = vnDateString()
  const to = new Date(new Date(`${from}T00:00:00+07:00`).getTime() + (DAYS - 1) * 864e5)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

  const [entries, fixtures] = await Promise.all([
    mc.from('calendar_entries')
      .select('id, title, title_vn, entry_date, start_time, end_time, space, kind')
      .gte('entry_date', from).lte('entry_date', to)
      .order('entry_date').order('start_time', { ascending: true, nullsFirst: true }),
    mc.from('fixtures')
      .select('id, sport, title, date, location')
      .gte('date', `${from}T00:00:00+07:00`).lte('date', `${to}T23:59:59+07:00`)
      .order('date'),
  ])

  return NextResponse.json({
    week: {
      from, to,
      // A private hire is titled by whoever booked it, and that title is often a
      // person or a group. `kind` is shown instead so a name is not left standing
      // on a screen in a public room. See the note in the report: the corpus is
      // two rows, so this guards the obvious case and no more — the real control
      // is how staff title member-visible entries, not code.
      entries: (entries.data || []).map(e => ({
        ...e,
        title: e.kind === 'private_hire' ? 'Private hire' : e.title,
        title_vn: e.kind === 'private_hire' ? null : e.title_vn,
      })),
      fixtures: fixtures.data || [],
    },
  })
}
