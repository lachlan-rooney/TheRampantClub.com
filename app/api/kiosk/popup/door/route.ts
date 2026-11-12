import { NextRequest, NextResponse } from 'next/server'
import { deviceOk, actingStaff, denyDevice, denyStaff, svc } from '@/lib/kiosk/server'
import { deviceEvent } from '@/lib/popup/event'

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

// The evening this handset is on. Practice or real — the same code either way.
const eventRow = () => deviceEvent()

// ⚠ RATE-LIMITED, PER MEMBER OF STAFF. Four digits is ten thousand codes
// against about a hundred guests: left open, a phone could walk the whole
// space in a few minutes and read back a stranger's name and time. Twelve
// lookups a minute is far more than a real door needs and far less than a
// search. It is a SECOND line of defence, not the first — the first is that a
// code shows a booking and never admits one.
const LOOKUPS = new Map<string, number[]>()
function lookupLimited(key: string): boolean {
  const now = Date.now()
  const arr = (LOOKUPS.get(key) || []).filter(t => now - t < 60_000)
  arr.push(now); LOOKUPS.set(key, arr)
  if (LOOKUPS.size > 2000) for (const [k, v] of LOOKUPS) if (!v.some(t => now - t < 60_000)) LOOKUPS.delete(k)
  return arr.length > 12
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
      practice: ev.is_practice,
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

  // ── LOOKING UP FOUR DIGITS ──────────────────────────────────────────────
  // ⚠ IT SHOWS, IT DOES NOT ADMIT. popup_find_by_code has no UPDATE in it, so
  // there is no path from a guessed code to an admitted guest. The screen asks
  // staff to check the name, and admitting is a second, deliberate action that
  // goes through popup_scan with the full ticket code like any other.
  if (action === 'find_code') {
    const code = String(body.code || '').replace(/\D/g, '')
    if (code.length !== 4) return NextResponse.json({ found: false, reason: 'short' })
    if (lookupLimited(by)) {
      return NextResponse.json({ found: false, reason: 'rate' }, { status: 429 })
    }
    const { data, error } = await a.rpc('popup_find_by_code', { p_event_id: ev.id, p_code: code })
    if (error) {
      return NextResponse.json({
        error: /popup_find_by_code/.test(error.message)
          ? 'The 4-digit code needs db/popup_door_code.sql to be run first.' : error.message,
      }, { status: 500 })
    }
    const row = one(data)
    if (!row) return NextResponse.json({ found: false, reason: 'unknown' })
    return NextResponse.json({ found: true, ...(row as object) })
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
