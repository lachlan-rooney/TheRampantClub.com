import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import QRCode from 'qrcode'
import { deviceOk, actingStaff, denyDevice, denyStaff, svc } from '@/lib/kiosk/server'
import { tr, timeLabel, type Lang } from '@/lib/popup/strings'
import { ticketUrl } from '@/lib/popup/ticket'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { alertAdmins } from '@/lib/studio/alert'
import { deviceEvent } from '@/lib/popup/event'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// TAKING A PLACE, FROM THE TABLET.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ NOTHING IS PROMISED UNTIL POSTGRES HAS WRITTEN IT. A guest is standing at
// the stand being told out loud that they are in; places are limited; so this
// route never optimistically confirms, never queues, and never guesses. If the
// write does not happen, the tablet says so and staff take the name on paper.
//
// The only safe retry is the one the TABLET does inside a single interaction,
// carrying the same attempt_id — popup_book() is idempotent on it, so a
// request that timed out after succeeding returns its original answer rather
// than taking a second place.
//
// ⚠ THE EMAIL IS SENT AFTER THE PLACE IS SECURED AND CANNOT UNDO IT. A failed
// send is recorded, alerted to the owner, and reported to the tablet as
// `emailed: false` so the screen can say "you are on the list by name". A
// booking is never lost to a typo or to Resend having a bad minute.
// ═══════════════════════════════════════════════════════════════════════════

const FROM = 'The Rampant Club <events@therampantclub.com>'
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const staff = await actingStaff()
  if (!staff) return denyStaff()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sessionId = String(body.session_id || '')
  const name = String(body.name || '').trim()
  const emailRaw = String(body.email || '').trim()
  const party = Number(body.party_size ?? 1)
  const lang: Lang = body.lang === 'vn' ? 'vn' : 'en'
  const consent = !!body.consent
  const termsText = String(body.terms_text || '')
  const attempt = String(body.attempt_id || '')
  const source = body.source === 'staff' ? 'staff' : 'kiosk'
  // ⚠ FALSE UNLESS THE GUEST ASKED. Three tablets reaching for the last place
  // is the case this evening is most likely to produce, and the two who lose
  // must be TOLD, not quietly moved onto a waiting list for a time they can no
  // longer have. The tablet shows "that place has just gone", refreshes the
  // list, and offers the waiting list as its own deliberate button — which
  // calls back with this set.
  const allowWaiting = body.allow_waiting === true

  if (!sessionId || !attempt) return NextResponse.json({ error: 'session_id and attempt_id are required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: tr(lang, 'k_err_name'), field: 'name' }, { status: 400 })
  // ⚠ A BAD ADDRESS IS REFUSED AT THE FORM, NOT AT THE BOOKING. The tablet
  // offers to leave it blank; what it must never do is turn a typo into a
  // guest with no place.
  if (emailRaw && !LOOKS_LIKE_EMAIL.test(emailRaw)) {
    return NextResponse.json({ error: tr(lang, 'k_err_email'), field: 'email' }, { status: 400 })
  }

  const a = svc()
  const ev = await deviceEvent()
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  // ── THE LOCKED WRITE ────────────────────────────────────────────────────
  const { data: res, error: rpcErr } = await a.rpc('popup_book', {
    p_event_id: ev.id,
    p_session_id: sessionId,
    p_name: name,
    p_email: emailRaw || null,
    p_party: party,
    p_lang: lang,
    p_consent: consent,
    p_terms: termsText,
    p_source: source,
    p_attempt: attempt,
    p_allow_waiting: allowWaiting,
    // ── WHO TOOK IT ───────────────────────────────────────────────────────
    // ⚠ staff.name, NOT anything from the body. actingStaff() is the signed
    // kiosk cookie checked against team_members — the same proof the PIN
    // screen rests on — so this is the server's answer to "who was holding
    // the phone", and a name posted in a request cannot become it.
    //
    // The door has recorded admitted_by since it was built; a booking recorded
    // only a device hash, which names a HANDSET and says nothing once a phone
    // has been passed between two people during an evening.
    p_taken_by: staff.name,
  })
  const out = Array.isArray(res) ? res[0] : res

  if (rpcErr || !out) {
    await alertAdmins(a, 'A pop-up booking could not be written', {
      session_id: sessionId, name, detail: rpcErr?.message,
    }, '/admin/popup')
    // The tablet shows "we can't take bookings for a moment" — never a
    // confirmation we cannot stand behind.
    return NextResponse.json({ error: tr(lang, 'k_err_offline'), detail: rpcErr?.message }, { status: 503 })
  }

  if (!out.ok) {
    const reason = String(out.reason || '')
    const when = out.starts_at ? timeLabel(out.starts_at, ev.timezone) : ''
    const map: Record<string, { msg: string; extra?: string }> = {
      duplicate: { msg: tr(lang, 'k_err_dup', { time: when }), extra: tr(lang, 'k_err_dup_ask') },
      started:   { msg: tr(lang, 'k_err_started') },
      closed:    { msg: tr(lang, 'k_err_started') },
      too_big:   { msg: tr(lang, 'k_err_toobig', { n: ev.party_max }) },
      full:      { msg: tr(lang, 'k_err_full') },
      paused:    { msg: tr(lang, 'k_paused') },
    }
    const m = map[reason] || { msg: tr(lang, 'k_err_offline') }
    return NextResponse.json({ error: m.msg, extra: m.extra, reason, refresh: true }, { status: 409 })
  }

  // ═══ FROM HERE THE PLACE EXISTS. Nothing below may discard it. ═════════
  const waiting = out.status === 'waiting'
  const when = timeLabel(out.starts_at, ev.timezone)
  const title = (lang === 'vn' ? ev.title_vn : ev.title_en) || ev.title_en
  const venue = (lang === 'vn' ? ev.venue_vn : ev.venue_en) || ev.venue_en

  let emailed = false
  let emailError: string | null = null
  if (emailRaw) {
    try {
      if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing')
      const resend = new Resend(process.env.RESEND_API_KEY)

      let html: string
      let subject: string
      if (waiting) {
        subject = tr(lang, 'mail_wait_subject', { title })
        html = emailShell(`
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 18px;">
            ${esc(tr(lang, 'mail_wait_lead', { time: when }))}
          </h1>
          <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.gold};margin:0 0 18px;">
            <strong>${esc(tr(lang, 'mail_wait_not'))}</strong>
          </p>
          <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
            ${esc(venue)}
          </p>
        `, { title: subject, preheader: tr(lang, 'mail_wait_not') })
      } else {
        // THE QR, drawn as a data URI so it survives an email client that
        // blocks remote images... and the CODE is printed underneath, because
        // some clients block data URIs too. Two ways in, plus the guest's name
        // on the door list, which is the third.
        const url = ticketUrl(ev.slug, out.ticket_code)
        const png = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 440 })
        subject = tr(lang, 'mail_ticket_subject', { time: when, title })
        html = emailShell(`
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 10px;">
            ${esc(tr(lang, 'mail_ticket_lead'))}
          </h1>
          <p style="font-family:Georgia,serif;font-size:40px;line-height:1.1;color:${EMAIL.gold};margin:0 0 6px;">${esc(when)}</p>
          <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.ink};margin:0 0 20px;">
            ${esc(tr(lang, 'mail_ticket_when', { time: when }))}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
            <tr><td style="background:#ffffff;padding:12px;border-radius:8px;">
              <img src="${png}" width="220" height="220" alt="${esc(tr(lang, 'mail_ticket_show'))}" style="display:block;" />
            </td></tr>
          </table>
          <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0 0 4px;">
            ${esc(tr(lang, 'mail_ticket_code'))}
          </p>
          <p style="font-family:'Courier New',monospace;font-size:22px;letter-spacing:.18em;color:${EMAIL.ink};margin:0 0 20px;">
            ${esc(out.ticket_code)}
          </p>
          <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
            <strong style="color:${EMAIL.ink};">${esc(tr(lang, 'mail_ticket_where'))}</strong><br>${esc(venue)}
          </p>
        `, { title: subject, preheader: `${when} — ${venue}` })
      }

      const r = await resend.emails.send({ from: FROM, to: emailRaw, subject, html })
      if (r.error) throw new Error(r.error.message)
      emailed = true
      await a.from('popup_bookings').update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', out.booking_id)
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e)
    }
  }

  if (emailRaw && !emailed) {
    // ⚠ FLAGGED, NEVER SILENT — and the booking still stands. The tablet is
    // told so it can say "you are on the list by name" instead of promising
    // an email that is not coming.
    await alertAdmins(a, 'A pop-up ticket email failed', {
      booking_id: out.booking_id, email: emailRaw, detail: emailError,
    }, '/admin/popup')
  }

  return NextResponse.json({
    ok: true,
    booking_id: out.booking_id,
    status: out.status,
    waiting,
    ticket_code: out.ticket_code,
    name,
    starts_at: out.starts_at,
    time: when,
    places_left: out.places_left,
    emailed,
    had_email: !!emailRaw,
  })
}
