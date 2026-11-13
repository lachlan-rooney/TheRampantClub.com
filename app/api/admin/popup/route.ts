import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { tr, timeLabel, type Lang } from '@/lib/popup/strings'
import { qrImageUrl } from '@/lib/popup/ticket'
import { sendEach, promotedHtml } from '@/lib/popup/mail'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// THE RUN SHEET — what the owner watches the evening by.
// ───────────────────────────────────────────────────────────────────────────
// Counts, the cap, the two switches, and the three tablets' heartbeat. It is
// admin-only: it carries guest names, which the tablet's own API never does.
//
// ⚠ RAISING THE CAP PROMOTES IMMEDIATELY. Not on a timer, not on the next
// page load — in the same request, under the same lock, and the promoted ids
// come back so the caller can email each of them their ticket. A waiting list
// that fills "soon" is a waiting list nobody trusts.
//
// ⚠ LOWERING THE CAP CANCELS NOBODY. It marks the session over capacity and
// hands back who is last in. The decision is the owner's: move, waitlist or
// keep. The DOOR never consults the cap at all.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// A whitelist, not a spread: every one of these is a field a person is meant
// to change from the screen.
interface ShiftRow {
  ok: boolean; reason: string | null; sessions_moved: number
  booking_id: string | null; name: string | null; email: string | null; lang: string | null
  old_starts_at: string | null; new_starts_at: string | null; ticket_code: string | null
}

const EVENT_FIELDS = new Set([
  'default_cap', 'party_max', 'published', 'public_bookings', 'bookings_paused',
  'admit_early_minutes', 'admit_late_minutes', 'allow_late_move',
  'reminder_lead_minutes', 'membership_contact',
])

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()

  const { data: ev } = await a.from('popup_events').select('*').eq('slug', SLUG).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.', hint: 'Has db/popup_timed_entry.sql been run?' }, { status: 500 })

  const [{ data: sheet }, { data: bookings }, { data: devices }] = await Promise.all([
    a.rpc('popup_runsheet', { p_event_id: ev.id }),
    a.from('popup_bookings')
      .select('id,name,email,party_size,status,ticket_code,door_code,session_id,admitted_at,admitted_by,created_at,waiting_since,source,consent_marketing,confirmation_sent_at')
      .eq('event_id', ev.id).order('created_at', { ascending: false }),
    // ⚠ WHAT IS LISTED IS WHATEVER IS PAIRED, not a hardcoded roll call.
    // This was three named room tablets until 12 Nov, when the plan changed and
    // sign-up moved onto staff phones. A fixed list in the code would then have
    // shown three tablets that are not at the Palace and none of the phones
    // that are — and worse, a phone paired during the rehearsal would have been
    // invisible on the run sheet all evening. The pairing IS the list.
    a.from('kiosk_devices')
      .select('id, label, purpose, enrolled_at, last_seen_at, revoked_at, popup_slug')
      .eq('purpose', 'popup').is('revoked_at', null)
      .order('label'),
  ])

  // ── THE HEARTBEAT ─────────────────────────────────────────────────────
  // kiosk_device_purpose stamps last_seen on EVERY request a paired device
  // makes, so this needs no new plumbing — but that also means "online" here
  // means "asked us something recently", not "is switched on". A phone left on
  // a finished screen goes quiet. Ninety seconds is the window because the
  // sign-up polls its session list every twelve.
  //
  // A phone is labelled with the staff member's name at pairing, so this reads
  // as a roll call of who is actually holding a working phone.
  const now = Date.now()
  const phones = (devices || []).map(d => {
    const seen = d.last_seen_at ? new Date(d.last_seen_at).getTime() : null
    return {
      id: d.id,
      label: d.label,
      paired: !!d.enrolled_at,
      last_seen_at: d.last_seen_at ?? null,
      seconds_ago: seen ? Math.round((now - seen) / 1000) : null,
      online: seen ? now - seen < 90_000 : false,
      practice: (d as { popup_slug?: string | null }).popup_slug === 'palace-practice',
    }
  })

  // ⚠ WHAT WAS CHANGED, AND BY WHOM. A correction made on a phone at a door
  // is invisible to the person running the evening unless it is shown here.
  const { data: edits } = await a.from('popup_booking_edits')
    .select('booking_id, field, was, now_, by, at')
    .eq('event_id', ev.id).order('at', { ascending: false }).limit(60)

  // The practice evening, if it exists — so the run sheet can say whether
  // there is anything to switch a phone to.
  const { data: prac } = await a.from('popup_events')
    .select('slug, published, is_practice').eq('slug', 'palace-practice').maybeSingle()
  const { count: pracBookings } = prac
    ? await a.from('popup_bookings').select('id', { count: 'exact', head: true })
        .eq('event_id', (await a.from('popup_events').select('id').eq('slug', 'palace-practice').single()).data!.id)
    : { count: 0 }

  // ── WHO HAS TAKEN A COPY OF THE GUEST LIST ───────────────────────────
  // ⚠ ABSENT UNTIL db/popup_exports.sql IS RUN, and the run sheet says so
  //   under the buttons rather than showing an empty register that reads like
  //   "nobody has ever downloaded this".
  const log = await a.rpc('popup_export_log', { p_event_id: ev.id, p_limit: 12 })

  return NextResponse.json({
    event: ev,
    sessions: sheet ?? [],
    bookings: bookings ?? [],
    phones,
    practice: prac ? { exists: true, bookings: pracBookings ?? 0 } : { exists: false, bookings: 0 },
    edits: edits ?? [],
    exports: log.error ? [] : (log.data ?? []),
    exports_ready: !log.error,
    now: new Date().toISOString(),
  })
}

// ── TELLING THE PEOPLE WHO JUST GOT A PLACE ──────────────────────────────
// ⚠ PROMOTION WITHOUT THIS IS WORSE THAN NO PROMOTION. The guest's last word
// from us was "you are on the waiting list, this is not a ticket". If the
// place that opens never reaches them, they are standing in the room believing
// they have none — and the seat goes empty with somebody beside it who wanted
// it. The run sheet said they had been emailed before this existed.
//
// It returns what happened per address so the screen can say so honestly
// rather than claim a send it did not watch.
async function tellPromoted(
  a: ReturnType<typeof svc>, slug: string, bookingIds: string[],
): Promise<{ emailed: number; no_email: number; failed: { email: string; error?: string }[] }> {
  if (!bookingIds.length) return { emailed: 0, no_email: 0, failed: [] }
  const { data: rows } = await a.from('popup_bookings')
    .select('id, name, email, lang, ticket_code, door_code, popup_sessions!inner(starts_at)')
    .in('id', bookingIds)
  const people = (rows || []) as unknown as {
    id: string; name: string; email: string | null; lang: string
    ticket_code: string; door_code: string | null; popup_sessions: { starts_at: string }
  }[]
  const withEmail = people.filter(p => p.email)

  const { data: ev } = await a.from('popup_events')
    .select('venue_en, venue_vn, timezone').eq('slug', slug).maybeSingle()

  const msgs = []
  for (const p of withEmail) {
    const L = (p.lang === 'vn' ? 'vn' : 'en') as Lang
    const m = promotedHtml(L, {
      time: timeLabel(p.popup_sessions.starts_at, ev?.timezone || 'Asia/Ho_Chi_Minh'),
      venue: (L === 'vn' ? ev?.venue_vn : ev?.venue_en) || ev?.venue_en || '',
      code: p.ticket_code, doorCode: p.door_code, qrUrl: qrImageUrl(slug, p.ticket_code),
    })
    msgs.push({ email: p.email, subject: m.subject, html: m.html })
  }
  const sent = await sendEach(msgs)
  const ok = sent.filter(s => s.ok)
  // The ticket they now hold is the one that counts.
  for (const p of withEmail) {
    if (ok.some(s => s.email === p.email)) {
      await a.from('popup_bookings')
        .update({ confirmation_sent_at: new Date().toISOString() }).eq('id', p.id)
    }
  }
  return { emailed: ok.length, no_email: people.length - withEmail.length,
           failed: sent.filter(s => !s.ok) }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { data: ev } = await a.from('popup_events').select('id, default_cap').eq('slug', SLUG).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  const action = String(body.action || '')

  // ── THE EVENT-WIDE CAP ────────────────────────────────────────────────
  if (action === 'cap') {
    const cap = Number(body.cap)
    if (!Number.isInteger(cap) || cap < 1 || cap > 200) {
      return NextResponse.json({ error: 'The cap must be a whole number between 1 and 200.' }, { status: 400 })
    }
    const raising = cap > ev.default_cap
    const { error } = await a.from('popup_events').update({ default_cap: cap }).eq('id', ev.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Promote every session, not only the full ones: a cap raise can open room
    // anywhere, and asking is cheaper than deciding which to ask about.
    const promoted: string[] = []
    const skipped: string[] = []
    if (raising) {
      const { data: ss } = await a.from('popup_sessions').select('id').eq('event_id', ev.id)
      for (const s of ss || []) {
        const { data } = await a.rpc('popup_promote', { p_session_id: s.id })
        const row = Array.isArray(data) ? data[0] : data
        promoted.push(...(row?.promoted || []))
        skipped.push(...(row?.skipped || []))
      }
    }
    const told = await tellPromoted(a, SLUG, promoted)
    return NextResponse.json({ ok: true, cap, raising, promoted, skipped, ...told })
  }

  // ── ONE SESSION'S OVERRIDE ────────────────────────────────────────────
  if (action === 'session_cap') {
    const id = String(body.session_id || '')
    const raw = body.cap
    const cap = raw === null || raw === '' ? null : Number(raw)
    if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 200)) {
      return NextResponse.json({ error: 'The cap must be a whole number between 1 and 200, or blank.' }, { status: 400 })
    }
    const { error } = await a.from('popup_sessions').update({ cap_override: cap }).eq('id', id).eq('event_id', ev.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data } = await a.rpc('popup_promote', { p_session_id: id })
    const row = Array.isArray(data) ? data[0] : data
    const told = await tellPromoted(a, SLUG, row?.promoted || [])
    return NextResponse.json({ ok: true, promoted: row?.promoted || [], skipped: row?.skipped || [], ...told })
  }

  // ── MOVE A GUEST, or cancel them ──────────────────────────────────────
  // ⚠ BOTH GO THROUGH popup_fix_booking NOW. This used to write the new
  // session_id straight in with NO CAPACITY CHECK, so a guest could be moved
  // into a full session and the run sheet would simply show it over. One
  // function holds the rules for the phone and the laptop alike.
  if (action === 'move' || action === 'cancel') {
    const id = String(body.booking_id || '')
    const { data, error } = await a.rpc('popup_fix_booking', {
      p_event_id: ev.id, p_booking_id: id,
      p_name: null, p_email: null, p_party: null,
      p_session_id: action === 'move' ? String(body.session_id || '') : null,
      p_by: 'the run sheet',
      p_cancel: action === 'cancel',
    })
    if (error) {
      return NextResponse.json({
        error: /popup_fix_booking/.test(error.message)
          ? 'This needs db/popup_fix_booking.sql to be run first.' : error.message,
      }, { status: 500 })
    }
    const r = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason?: string; places_left?: number } | null
    if (!r?.ok) {
      const why = r?.reason === 'full' ? `That session has only ${r.places_left ?? 0} place(s) left.`
        : r?.reason === 'already_in' ? 'They are already in — they cannot be moved or cancelled.'
        : r?.reason === 'closed' ? 'That session is closed.'
        : 'That could not be done.'
      return NextResponse.json({ error: why, reason: r?.reason }, { status: 400 })
    }
    return NextResponse.json({ ...r, ok: true })
  }

  // ═══ THE PRACTICE EVENING ═════════════════════════════════════════════
  // ⚠ A PHONE IS SWITCHED ONE AT A TIME, by device. One handset can be
  // rehearsing in the back office while another takes real sign-ups, and
  // putting it back is one tap rather than a deploy.
  if (action === 'practice_device') {
    const id = String(body.device_id || '')
    const on = body.practice === true
    const { error } = await a.from('kiosk_devices')
      .update({ popup_slug: on ? 'palace-practice' : null })
      .eq('id', id).eq('purpose', 'popup')
    if (error) {
      return NextResponse.json({
        error: /popup_slug/.test(error.message)
          ? 'The practice switch needs db/popup_practice.sql to be run first.' : error.message,
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, practice: on })
  }

  // ── ALL OF THEM AT ONCE ───────────────────────────────────────────────
  // ⚠ AND IT REPORTS WHICH PHONES MOVED, by name. "Done" is not an answer
  // when the next thing somebody does is hand five handsets to five people.
  if (action === 'practice_all') {
    const on = body.practice === true
    const { data: moved, error } = await a.from('kiosk_devices')
      .update({ popup_slug: on ? 'palace-practice' : null })
      .eq('purpose', 'popup').is('revoked_at', null)
      .select('label')
    if (error) {
      return NextResponse.json({
        error: /popup_slug/.test(error.message)
          ? 'The practice switch needs db/popup_practice.sql to be run first.' : error.message,
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, practice: on, moved: (moved || []).map(m => m.label) })
  }

  // ⚠ ONE CONTROL, AND IT CANNOT TOUCH FRIDAY. popup_practice_reset() refuses
  // any event not marked is_practice, in Postgres, so a mis-click here cannot
  // empty the real evening.
  if (action === 'practice_reset') {
    const { data, error } = await a.rpc('popup_practice_reset')
    if (error) {
      return NextResponse.json({
        error: /popup_practice_reset/.test(error.message)
          ? 'Run db/popup_practice.sql first.' : error.message,
      }, { status: 500 })
    }
    const row = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ ok: true, ...row })
  }

  // ── THE SWITCHES AND THE SETTINGS ─────────────────────────────────────
  if (action === 'event') {
    const patch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body.fields as Record<string, unknown> || {})) {
      if (EVENT_FIELDS.has(k)) patch[k] = v
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    const { error } = await a.from('popup_events').update(patch).eq('id', ev.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, patch })
  }

  return NextResponse.json({ error: 'Nothing addressed.' }, { status: 400 })
}
