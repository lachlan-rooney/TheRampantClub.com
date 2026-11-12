import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { tr, timeLabel, type Lang } from '@/lib/popup/strings'
import { unsubUrl } from '@/lib/popup/ticket'
import { sendEach, shiftHtml, messageHtml, reminderHtml, followupHtml } from '@/lib/popup/mail'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// EVERY POP-UP EMAIL THE OWNER SENDS.  Items 4–7.
// ───────────────────────────────────────────────────────────────────────────
//   shift_notice   the time moved — tell exactly the people it moved for
//   message        a note to one session, or to everybody in tonight
//   reminders      "your session starts in ten minutes"
//   followup_*     the morning after: save, preview, test to the owner,
//                  approve, send
//
// ══ THE RULES ════════════════════════════════════════════════════════════
// 1 · NOTHING SENDS WITHOUT BEING ASKED. The shift itself is a separate
//     action on /api/admin/popup; this route tells people about it. A shift
//     that silently emailed would be a shift nobody dares press.
// 2 · THE FOLLOW-UP CANNOT GO OUT UNAPPROVED. followup_send refuses unless
//     followup_approved_at is set, and approving is its own deliberate step
//     after a preview and a test send to the owner.
// 3 · A TEST GOES TO THE OWNER AND NOWHERE ELSE. Never to a guest, never to
//     the other admins — DEV_ALERT_ONLY_TO or the signed-in admin, full stop.
// 4 · NOBODY IS EMAILED TWICE. reminder_sent_at / followup_sent_at are
//     stamped per booking as each send succeeds, and the SQL that picks
//     recipients excludes anything stamped. A half-failed run is finished by
//     running it again, not restarted.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } })

interface Ev {
  id: string; slug: string; title_en: string; title_vn: string | null
  venue_en: string; venue_vn: string | null; timezone: string
  reminder_lead_minutes: number
  followup_subject_en: string | null; followup_subject_vn: string | null
  followup_full_en: string | null; followup_full_vn: string | null
  followup_plain_en: string | null; followup_plain_vn: string | null
  followup_send_at: string | null; followup_approved_at: string | null
  followup_approved_by: string | null; followup_sent_at: string | null
}

const getEvent = async (a: ReturnType<typeof svc>) => {
  const { data } = await a.from('popup_events').select('*').eq('slug', SLUG).maybeSingle()
  return (data as Ev | null) ?? null
}

const venueFor = (ev: Ev, L: Lang) => (L === 'vn' ? ev.venue_vn : ev.venue_en) || ev.venue_en
const when = (ev: Ev, iso: string) => timeLabel(iso, ev.timezone)

// ⚠ WHERE A TEST GOES. The owner, and only the owner. This exists because a
// fixture once reached every admin including the GM, who gets a weekly update
// and nothing else.
const ownerAddress = () =>
  (process.env.DEV_ALERT_ONLY_TO || process.env.AUCTION_ALERT_TO || '').split(',')[0].trim()

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  const ev = await getEvent(a)
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const action = String(body.action || '')

  // ═══ ITEM 4 · THE TIME MOVED ═══════════════════════════════════════════
  // Takes the list popup_shift handed back. It is passed in rather than
  // re-derived, deliberately: by the time the owner presses send, the shift
  // has happened and the old times are gone from the database. Only the
  // answer to that call still knows what each guest was told before.
  if (action === 'shift_notice') {
    const people = (body.affected || []) as { booking_id: string; name: string; email: string | null
      lang: string | null; was: string; now: string; ticket_code: string }[]
    if (!Array.isArray(people) || !people.length) {
      return NextResponse.json({ error: 'Nobody to tell.' }, { status: 400 })
    }
    const rows = people.filter(p => p.email).map(p => {
      const L = (p.lang === 'vn' ? 'vn' : 'en') as Lang
      const m = shiftHtml(L, {
        was: when(ev, p.was), now: when(ev, p.now),
        venue: venueFor(ev, L), code: p.ticket_code,
      })
      return { email: p.email, subject: m.subject, html: m.html }
    })
    const sent = await sendEach(rows)
    await a.from('popup_messages').insert({
      event_id: ev.id, scope: 'evening',
      body_en: `Time change: ${people.length} guests moved.`,
      sent_count: sent.filter(s => s.ok).length,
      failed_count: sent.filter(s => !s.ok).length,
    })
    return NextResponse.json({
      ok: true, told: sent.filter(s => s.ok).length,
      no_email: people.length - rows.length,
      failed: sent.filter(s => !s.ok),
    })
  }

  // ═══ ITEM 5 · A MESSAGE ════════════════════════════════════════════════
  if (action === 'message') {
    const text = String(body.body || '').trim()
    if (text.length < 4) return NextResponse.json({ error: 'Write something to send.' }, { status: 400 })
    const sessionId = body.session_id ? String(body.session_id) : null

    // ⚠ CONFIRMED PLACES ONLY, PLUS THE WAITING LIST ONLY IF ASKED FOR. A note
    // about tonight's running order is not for somebody who has no place.
    let q = a.from('popup_bookings')
      .select('id, name, email, email_key, lang, status, session_id, popup_sessions!inner(starts_at)')
      .eq('event_id', ev.id).not('email', 'is', null)
      .in('status', body.include_waiting === true ? ['confirmed', 'waiting'] : ['confirmed'])
    if (sessionId) q = q.eq('session_id', sessionId)
    const { data: people, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: offList } = await a.from('popup_unsubscribes').select('email_key')
    const off = new Set((offList || []).map(r => r.email_key))

    const rows = (people || []).filter(p => !off.has(p.email_key || '')).map(p => {
      const L = (p.lang === 'vn' ? 'vn' : 'en') as Lang
      const starts = (p as unknown as { popup_sessions?: { starts_at: string } }).popup_sessions?.starts_at
      const m = messageHtml(L, {
        body: text, venue: venueFor(ev, L),
        time: sessionId && starts ? when(ev, starts) : undefined,
      })
      return { email: p.email, subject: m.subject, html: m.html }
    })
    if (body.dry_run === true) {
      return NextResponse.json({ ok: true, dry_run: true, would_send: rows.length,
        unsubscribed: (people || []).length - rows.length })
    }
    const sent = await sendEach(rows)
    await a.from('popup_messages').insert({
      event_id: ev.id, session_id: sessionId, scope: sessionId ? 'session' : 'evening',
      body_en: text, sent_count: sent.filter(s => s.ok).length,
      failed_count: sent.filter(s => !s.ok).length,
    })
    return NextResponse.json({ ok: true, sent: sent.filter(s => s.ok).length, failed: sent.filter(s => !s.ok) })
  }

  // ═══ ITEM 6 · TEN MINUTES TO GO ════════════════════════════════════════
  // Safe to call as often as you like: popup_due_reminders never returns a
  // session that has started, a cancelled booking, a waiting-list place,
  // somebody with no address, somebody unsubscribed, or anybody already sent
  // one. Running it twice in a minute sends nothing the second time.
  if (action === 'reminders') {
    return NextResponse.json(await runReminders(a, ev, body.dry_run === true))
  }

  // ═══ ITEM 7 · THE MORNING AFTER ════════════════════════════════════════
  if (action === 'followup_save') {
    const f = (body.fields || {}) as Record<string, string>
    const allow = ['followup_subject_en', 'followup_subject_vn', 'followup_full_en', 'followup_full_vn',
                   'followup_plain_en', 'followup_plain_vn', 'followup_send_at', 'membership_contact']
    const patch: Record<string, string | null> = {}
    for (const k of allow) if (k in f) patch[k] = f[k] === '' ? null : f[k]
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
    // ⚠ ANY EDIT UNAPPROVES IT. Approval is of a specific text; letting an
    // edit keep an old approval is how unapproved words get sent.
    patch.followup_approved_at = null
    patch.followup_approved_by = null
    const { error } = await a.from('popup_events').update(patch).eq('id', ev.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, unapproved: true })
  }

  if (action === 'followup_approve') {
    const missing = followupGaps(ev, body.fields as Record<string, string> | undefined)
    if (missing.length) {
      return NextResponse.json({ error: `Write these first: ${missing.join(', ')}.` }, { status: 400 })
    }
    const { error } = await a.from('popup_events')
      .update({ followup_approved_at: new Date().toISOString() }).eq('id', ev.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'followup_test') {
    const to = ownerAddress()
    if (!to) {
      return NextResponse.json({
        error: 'No owner address is set. Set DEV_ALERT_ONLY_TO so a test cannot reach anybody else.',
      }, { status: 400 })
    }
    const L = (body.lang === 'vn' ? 'vn' : 'en') as Lang
    const wants = body.variant !== 'plain'
    const copy = followupCopy(ev, L, wants)
    if (!copy.subject || !copy.body) {
      return NextResponse.json({ error: 'That version has not been written yet.' }, { status: 400 })
    }
    const m = followupHtml(L, {
      name: 'Nguyễn Thu Hà', subject: copy.subject, body: copy.body,
      venue: venueFor(ev, L), unsubscribeUrl: unsubUrl(to), isTest: true,
    })
    const sent = await sendEach([{ email: to, subject: m.subject, html: m.html }], { gapMs: 0 })
    return NextResponse.json({ ok: sent[0]?.ok, to, error: sent[0]?.error })
  }

  if (action === 'followup_send') {
    if (!ev.followup_approved_at) {
      return NextResponse.json({ error: 'Approve the wording first. Nothing sends unapproved.' }, { status: 400 })
    }
    const expect = `SEND-FOLLOWUP`
    if (String(body.confirm || '') !== expect) {
      return NextResponse.json({ error: `Type ${expect} to send.` }, { status: 400 })
    }
    const { data: due, error } = await a.rpc('popup_followup_due', { p_event_id: ev.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const people = (due || []) as { booking_id: string; name: string; email: string
      lang: string; wants_more: boolean }[]
    if (body.dry_run === true) {
      return NextResponse.json({ ok: true, dry_run: true, would_send: people.length,
        full: people.filter(p => p.wants_more).length,
        plain: people.filter(p => !p.wants_more).length })
    }

    let ok = 0; const failed: { email: string; error?: string }[] = []; const skipped: string[] = []
    for (const p of people) {
      const L = (p.lang === 'vn' ? 'vn' : 'en') as Lang
      const copy = followupCopy(ev, L, p.wants_more)
      if (!copy.subject || !copy.body) { skipped.push(p.email); continue }
      const m = followupHtml(L, {
        name: p.name, subject: copy.subject, body: copy.body,
        venue: venueFor(ev, L), unsubscribeUrl: unsubUrl(p.email),
      })
      const [r] = await sendEach([{ email: p.email, subject: m.subject, html: m.html }])
      if (r.ok) {
        // ⚠ STAMPED ONE AT A TIME, as each one lands. Stamping the whole set
        // afterwards means a run that dies half-way has either told the
        // database about messages it never sent, or nothing at all.
        await a.from('popup_bookings').update({ followup_sent_at: new Date().toISOString() })
          .eq('id', p.booking_id)
        ok++
      } else failed.push({ email: r.email, error: r.error })
    }
    await a.from('popup_events').update({ followup_sent_at: new Date().toISOString() }).eq('id', ev.id)
    return NextResponse.json({ ok: true, sent: ok, failed, skipped })
  }

  return NextResponse.json({ error: 'Nothing addressed.' }, { status: 400 })
}

// ── WHICH OF THE TWO LETTERS, IN WHICH LANGUAGE ──────────────────────────
// The consent tick decides WHICH letter, never whether there is one.
function followupCopy(ev: Ev, L: Lang, wantsMore: boolean) {
  const pick = (en: string | null, vn: string | null) => (L === 'vn' ? vn || en : en) || null
  return {
    subject: pick(ev.followup_subject_en, ev.followup_subject_vn),
    body: wantsMore
      ? pick(ev.followup_full_en, ev.followup_full_vn)
      : pick(ev.followup_plain_en, ev.followup_plain_vn),
  }
}

function followupGaps(ev: Ev, draft?: Record<string, string>) {
  const v = (k: keyof Ev) => (draft?.[k as string] ?? ev[k] ?? '') as string
  const gaps: string[] = []
  if (!v('followup_subject_en')?.trim()) gaps.push('the subject')
  if (!v('followup_full_en')?.trim()) gaps.push('the version for people who ticked the box')
  if (!v('followup_plain_en')?.trim()) gaps.push('the version for people who did not')
  return gaps
}

// ── THE TEN-MINUTE SEND, shared with the cron ────────────────────────────
export async function runReminders(a: ReturnType<typeof svc>, ev: Ev, dryRun = false) {
  const { data: due, error } = await a.rpc('popup_due_reminders', { p_event_id: ev.id })
  if (error) return { error: error.message }
  const people = (due || []) as { booking_id: string; name: string; email: string
    lang: string; ticket_code: string; starts_at: string; minutes_away: number }[]
  if (dryRun) return { ok: true, dry_run: true, would_send: people.length,
    who: people.map(p => ({ name: p.name, in: p.minutes_away })) }

  let ok = 0; const failed: { email: string; error?: string }[] = []
  for (const p of people) {
    const L = (p.lang === 'vn' ? 'vn' : 'en') as Lang
    const m = reminderHtml(L, {
      time: timeLabel(p.starts_at, ev.timezone),
      minutes: Math.max(1, p.minutes_away),
      venue: (L === 'vn' ? ev.venue_vn : ev.venue_en) || ev.venue_en,
      code: p.ticket_code,
    })
    const [r] = await sendEach([{ email: p.email, subject: m.subject, html: m.html }])
    if (r.ok) {
      await a.from('popup_bookings').update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', p.booking_id)
      ok++
    } else failed.push({ email: r.email, error: r.error })
  }
  return { ok: true, sent: ok, failed }
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  const ev = await getEvent(a)
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })
  const { data: due } = await a.rpc('popup_due_reminders', { p_event_id: ev.id })
  const { data: fu } = await a.rpc('popup_followup_due', { p_event_id: ev.id })
  const { data: msgs } = await a.from('popup_messages').select('*')
    .eq('event_id', ev.id).order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({
    followup: {
      subject_en: ev.followup_subject_en, subject_vn: ev.followup_subject_vn,
      full_en: ev.followup_full_en, full_vn: ev.followup_full_vn,
      plain_en: ev.followup_plain_en, plain_vn: ev.followup_plain_vn,
      send_at: ev.followup_send_at, approved_at: ev.followup_approved_at,
      sent_at: ev.followup_sent_at,
      gaps: followupGaps(ev),
    },
    reminders_due: (due || []).length,
    followup_due: (fu || []).length,
    owner_address_set: !!ownerAddress(),
    messages: msgs || [],
  })
}
