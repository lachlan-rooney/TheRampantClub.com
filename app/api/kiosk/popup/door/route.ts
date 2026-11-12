import { NextRequest, NextResponse } from 'next/server'
import { deviceOk, actingStaff, denyDevice, denyStaff, svc } from '@/lib/kiosk/server'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// THE DOOR.  Everything a phone on the door asks for, and everything it does.
// ───────────────────────────────────────────────────────────────────────────
// ONE GET and one POST, because a door phone with a queue in front of it
// should be making one request, not four.
//
// ══ THE RULES THIS ROUTE EXISTS TO HOLD ══════════════════════════════════
// 1 · ONE GUEST IS ADMITTED ONCE. Every admit goes through popup_scan, whose
//     `update … where admitted_at is null` + row_count is what makes four
//     phones in the same instant resolve to one winner and three "already
//     admitted by Ni at 19:04". This route adds no locking of its own and
//     must not: a second mechanism here would be a second answer.
// 2 · AN OFFLINE TICK KEEPS THE TIME IT HAPPENED. A phone with no signal
//     queues {code, party, at} and replays it later; `at` is passed through
//     to popup_scan, so a guest admitted at 19:04 and synced at 19:21 is
//     recorded at 19:04. Replay is safe for exactly the same reason as (1).
// 3 · WHO DID IT IS THE SERVER'S ANSWER, NEVER THE BODY'S. `by` comes from
//     actingStaff() — the signed cookie checked against team_members — so a
//     name cannot be typed into a request.
//
// ⚠ THE LIST IT SERVES CARRIES GUEST EMAILS, which no other pop-up surface
// does: the door has to find a booking from a half-remembered name or the
// address somebody signed up with. That is why this sits behind BOTH a popup
// pairing and a staff PIN, and why the sign-up screen on the same phone is
// never sent this shape.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

interface Ev {
  id: string; title_en: string; venue_en: string; published: boolean
  party_max: number; admit_early_minutes: number; admit_late_minutes: number
}

// ⚠ THE COLUMN LIST IS ONE STRING LITERAL. Built with `+` it stops being a
// literal, Supabase's generated types give up, and every field below becomes
// an error about GenericStringError — which reads like a database fault and
// is only ever a formatting one.
const eventRow = async (): Promise<Ev | null> => {
  const { data } = await svc().from('popup_events')
    .select('id, title_en, venue_en, published, party_max, admit_early_minutes, admit_late_minutes')
    .eq('slug', SLUG).maybeSingle()
  return (data as Ev | null) ?? null
}

export async function GET() {
  if (!(await deviceOk())) return denyDevice()
  const staff = await actingStaff()
  if (!staff) return denyStaff()

  const ev = await eventRow()
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  const a = svc()
  const [{ data: list, error: listErr }, { data: sheet }] = await Promise.all([
    a.rpc('popup_doorlist', { p_event_id: ev.id }),
    a.rpc('popup_runsheet', { p_event_id: ev.id }),
  ])
  // ⚠ A FAILED READ IS SAID OUT LOUD, not served as an empty door. A phone
  // showing "no bookings" because a function is missing looks exactly like a
  // quiet evening, and the door would turn people away on it.
  if (listErr) {
    return NextResponse.json({
      error: 'The door list could not be read.',
      detail: listErr.message,
      hint: 'Has db/popup_tonight.sql been run?',
    }, { status: 500 })
  }

  return NextResponse.json({
    event: {
      title: ev.title_en, venue: ev.venue_en, published: ev.published,
      party_max: ev.party_max,
      admit_early_minutes: ev.admit_early_minutes,
      admit_late_minutes: ev.admit_late_minutes,
    },
    sessions: sheet ?? [],
    list: list ?? [],
    staff: staff.name,
    now: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const staff = await actingStaff()
  if (!staff) return denyStaff()

  const ev = await eventRow()
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const a = svc()
  const action = String(body.action || '')
  const by = staff.name                       // ← the server's answer, not the body's

  const one = <T,>(d: T | T[] | null) => (Array.isArray(d) ? d[0] : d) ?? null

  // ── A SCAN, OR A TICK ON THE LIST ───────────────────────────────────────
  // Both go through here, deliberately. A tick is a scan whose code came from
  // the list instead of a camera, and giving the two separate paths is how a
  // door ends up with two different ideas of what "admitted" means.
  if (action === 'scan') {
    const code = String(body.code || '').trim().toUpperCase()
    if (!/^[0-9A-F]{8}$/.test(code)) {
      return NextResponse.json({ state: 'malformed', code }, { status: 200 })
    }
    const admit = body.admit === true
    const party = body.party == null ? null : Number(body.party)
    // `at` is only honoured for a QUEUED admit. A live scan is now, whatever
    // the phone's clock says — phones drift and a door should not inherit it.
    const offline = body.offline === true
    const at = offline && typeof body.at === 'string' ? body.at : null

    const { data, error } = await a.rpc('popup_scan', {
      p_event_id: ev.id, p_code: code, p_admit: admit, p_by: by,
      p_party: Number.isFinite(party as number) ? party : null,
      p_at: at, p_offline: offline,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...(one(data) as object), by })
  }

  // ── UNDO ────────────────────────────────────────────────────────────────
  if (action === 'unadmit') {
    const { data, error } = await a.rpc('popup_unadmit', {
      p_booking_id: String(body.booking_id || ''), p_by: by })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(one(data))
  }

  // ── HOW MANY OF THEM ACTUALLY CAME IN ───────────────────────────────────
  if (action === 'set_party') {
    const { data, error } = await a.rpc('popup_set_party', {
      p_booking_id: String(body.booking_id || ''),
      p_party: Number(body.party), p_by: by })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(one(data))
  }

  // ── A WALK-UP ───────────────────────────────────────────────────────────
  if (action === 'walkup') {
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Enter a name.' }, { status: 400 })
    const { data, error } = await a.rpc('popup_walkup', {
      p_event_id: ev.id, p_session_id: String(body.session_id || ''),
      p_name: name, p_party: Math.max(1, Number(body.party) || 1),
      p_by: by, p_force: body.force === true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(one(data))
  }

  return NextResponse.json({ error: 'Nothing addressed.' }, { status: 400 })
}
