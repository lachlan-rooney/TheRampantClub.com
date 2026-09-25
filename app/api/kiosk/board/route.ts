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

// ── WHY THIS IS CACHED FOR A MINUTE ───────────────────────────────────────
// Owner, 2026-09-25: "the kiosk takes forever to load" — this route was taking
// 3.5–5.2s in production, and the board shows nothing of the club until it
// answers. Nearly all of that was waiting in single file: a dozen round trips
// to Supabase one after another, six of them signing an image URL each.
//
// WHAT'S ON is identical on every tablet in the building — fixtures, the diary
// entries staff ticked for the boards, and the sign-up counts. Four tablets
// polling every minute asked for the same rows four times a minute each. It is
// held for 60 seconds instead, which is the board's own refresh interval: the
// screen cannot show anything fresher than that anyway.
//
// NOTHING MEMBER-SHAPED IS IN HERE. The room, its bookings and the names on
// them are fetched per request, every request, because they belong to one
// tablet and one service date. A cache that held those would be the same
// mistake as caching the kiosk in the service worker.
//
// The signed image URLs live an hour, so a minute-old one has 59 left.
type WhatsOn = { kind: 'fixture' | 'house'; title: string; image: string | null
                 title_vn: string | null; at: string; taken: number | null; seats: number | null }
type BoardBookingRow = { booking_id: string; member_no: string; start_time: string | null
                         party_size: number | null; status: string; arrived_at: string | null }
let cached: { date: string; at: number; rows: WhatsOn[] } | null = null
const WHATS_ON_TTL = 60_000

export async function GET() {
  // WHERE THE TIME WENT. Server-Timing, not a log: the numbers are useless in a
  // log nobody opens, and this way a slow board can be measured with curl from
  // the room it is slow in. Durations only — no identity, nothing about who is
  // booked in — so it is safe on a response the tablet already receives.
  const t0 = Date.now()
  const marks: string[] = []
  const mark = (name: string, from: number) => marks.push(`${name};dur=${Date.now() - from}`)

  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return NextResponse.json({ board: null }, { status: 403 })
  const a = svc()

  // The same service date as the door: the small hours belong to the evening before.
  const { serviceDate } = doorClock()

  // WHAT'S ON STARTS NOW, not after the device has been resolved. It does not
  // depend on which room this tablet stands in — it is the same club — so
  // waiting for kiosk_board first only added its latency to everything below.
  // Caught here, not awaited here: an unenrolled tablet returns before this
  // settles, and a floating rejection would take the process's logs with it.
  // A board with no "what's on" is a board; a board that 500s is a dark screen.
  const whatsOnPromise = whatsOn(a, serviceDate).catch(() => [] as WhatsOn[])

  const tBoard = Date.now()
  const { data } = await a.rpc('kiosk_board', { p_device_token: token })
  mark('rpc', tBoard)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.room) return NextResponse.json({ board: row || null })

  // ONE QUERY, NOT TWO. The names used to be a second round trip keyed on the
  // member numbers the first one returned — which meant the board could not
  // start drawing until two trips to Virginia had finished, in order. The
  // foreign key is already there, so PostgREST fetches the name with the
  // booking. Still exactly the two fields the board shows, and no others.
  const tBook = Date.now()
  const { data: rows } = await a.from('bookings')
    .select('booking_id, member_no, start_time, party_size, status, arrived_at, members(full_name, nickname)')
    .eq('space', row.room).eq('booking_date', serviceDate)
    .in('status', ['pending', 'confirmed', 'arrived'])
    .order('start_time', { ascending: true, nullsFirst: false })

  mark('bookings', tBook)
  const list = (rows || []) as unknown as (BoardBookingRow & { members: { full_name: string | null; nickname: string | null } | null })[]

  const tWhats = Date.now()
  const whatsOnRows = await whatsOnPromise
  mark('whatson', tWhats)
  mark('total', t0)

  const res = NextResponse.json({
    board: {
      ...row,
      whats_on: whatsOnRows,
      bookings: list.map(b => {
        const m = b.members
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
  res.headers.set('Server-Timing', marks.join(', '))
  return res
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
async function whatsOn(a: ReturnType<typeof svc>, today: string): Promise<WhatsOn[]> {
  if (cached && cached.date === today && Date.now() - cached.at < WHATS_ON_TTL) return cached.rows

  // All three at once. They know nothing about each other, and run one after
  // another they were three quarters of a second of pure waiting.
  const [fx, ce, counted] = await Promise.all([
    a.from('fixtures').select('id, title, date, type, max_signups, is_full')
      .gte('date', today).order('date').limit(6),
    a.from('calendar_entries').select('title, title_vn, entry_date, start_time, space, kind')
      .eq('show_on_board', true).eq('visibility', 'member')
      .gte('entry_date', today).order('entry_date').limit(6),
    a.rpc('fixture_signup_counts'),
  ])
  const signups = new Map(((counted.data || []) as { fixture_id: string; signups?: number }[])
    .map(c => [c.fixture_id, Number(c.signups ?? 0)]))

  // ── THE PICTURES (owner, 2026-09-25: "pull through images for events on
  // the kiosk home page that looks garbage") ──────────────────────────────
  // Every event on the books has art. The member-facing route that serves it
  // requires a SIGNED-IN USER and a tablet has a device token instead, so
  // rather than widen that guard — it is the one place that decides who may
  // see a file, and a second answer would drift from it — this route mints
  // its own short-lived signed URLs, for FIXTURE art only, having already
  // checked the device. A staff-only calendar entry's file is never touched.
  //
  // SIGNED TOGETHER, not one after another: six images signed in single file
  // was 1.2 seconds of the board's wait, and they have nothing to say to each
  // other. Promise.all makes it one round trip's worth.
  const fixtureIds = ((fx.data || []) as { id: string }[]).map(f => f.id)
  const art = new Map<string, string>()
  if (fixtureIds.length) {
    const { data: atts } = await a.from('entry_attachments')
      .select('entity_id, storage_path, verified_kind')
      .eq('entity_type', 'fixture').in('entity_id', fixtureIds)
    const first = new Map<string, string>()
    for (const at of (atts || []) as { entity_id: string; storage_path: string; verified_kind: string }[]) {
      if (at.verified_kind === 'pdf' || first.has(at.entity_id)) continue
      first.set(at.entity_id, at.storage_path)
    }
    const signed = await Promise.all([...first].map(async ([id, path]) => {
      const { data } = await a.storage.from('entry-attachments').createSignedUrl(path, 60 * 60)
      return [id, data?.signedUrl ?? null] as const
    }))
    for (const [id, url] of signed) if (url) art.set(id, url)
  }

  const rows: WhatsOn[] = [
    ...((fx.data || []) as { id: string; title: string; date: string; type: string; max_signups: number | null; is_full: boolean | null }[])
      .map(f => ({
        kind: 'fixture' as const,
        title: f.title.trim(),
        image: art.get(f.id) ?? null,
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
        image: null as string | null,
        title_vn: e.title_vn,
        at: e.start_time ? `${e.entry_date}T${e.start_time}` : e.entry_date,
        taken: null as number | null,
        seats: null as number | null,
      })),
  ].sort((x, y) => x.at.localeCompare(y.at)).slice(0, 4)

  cached = { date: today, at: Date.now(), rows }
  return rows
}
