import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { tr, timeLabel, type Lang } from '@/lib/popup/strings'
import { qrImageUrl } from '@/lib/popup/ticket'

// ═══════════════════════════════════════════════════════════════════════════
// SENDING A TICKET AGAIN — after a correction, or because they asked.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ THE SAME EMAIL, NOT A SECOND ONE. A "here is your corrected ticket"
// written separately would be a second place the club's wording lives, and the
// two would part company. This builds the ticket the booking route builds,
// from the booking as it stands now.
//
// ⚠ AND THE CODES DO NOT CHANGE. A guest who screenshotted their ticket at
// 18:30 must still get in at 20:00 after their time was corrected — so the QR
// and the four digits are whatever the booking already had.
// ═══════════════════════════════════════════════════════════════════════════

const FROM = 'The Rampant Club <events@therampantclub.com>'
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface TicketSend {
  slug: string; timezone: string
  title: string; venue: string
  name: string; email: string; lang: Lang
  party: number; startsAt: string
  ticketCode: string; doorCode: string | null
}

export async function sendTicket(o: TicketSend): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY missing' }
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const L = o.lang
  const when = timeLabel(o.startsAt, o.timezone)
  const dateLine = new Date(o.startsAt).toLocaleDateString(L === 'vn' ? 'vi-VN' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: o.timezone })
  const people = o.party === 1 ? tr(L, 'mail_ticket_people_one') : tr(L, 'mail_ticket_people', { n: o.party })
  const subject = tr(L, 'mail_ticket_subject', { time: when, title: o.title })
  const img = qrImageUrl(o.slug, o.ticketCode)

  const html = emailShell(`
    <img src="${site}/images/lion-signature-opt.png" width="62" height="62" alt=""
         style="display:block;margin:0 0 18px;border:0;outline:none;" />
    <p style="font-family:Georgia,serif;font-size:30px;line-height:1.08;color:${EMAIL.ink};margin:0 0 6px;">${esc(tr(L, 'mail_ticket_booked'))}</p>
    <p style="font-family:Arial,sans-serif;font-size:19px;line-height:1.3;color:${EMAIL.ink};margin:0 0 22px;">${esc(o.name)}</p>
    <p style="font-family:Georgia,serif;font-size:64px;line-height:1.08;color:${EMAIL.gold};margin:0 0 2px;letter-spacing:-.01em;">${esc(when)}</p>
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:${EMAIL.muted};margin:0 0 4px;">${esc(dateLine)}</p>
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:${EMAIL.ink};margin:0 0 18px;">${esc(people)}</p>
    <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.3;color:${EMAIL.muted};margin:0 0 3px;letter-spacing:.1em;text-transform:uppercase;">${esc(tr(L, 'mail_ticket_where'))}</p>
    <p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:${EMAIL.ink};margin:0 0 20px;">${esc(o.title)}<br>${esc(o.venue)}</p>
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.ink};margin:0 0 24px;">${esc(tr(L, 'mail_ticket_arrive'))}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
      <tr><td style="background:#ffffff;padding:14px;border-radius:10px;" bgcolor="#ffffff">
        <img src="${img}" width="260" height="260"
             alt="${esc(tr(L, 'mail_ticket_doorcode_lead'))}: ${esc(o.doorCode || o.ticketCode)}"
             style="display:block;max-width:100%;height:auto;border:0;" />
      </td></tr>
    </table>
    ${o.doorCode ? `
    <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.4;color:${EMAIL.muted};margin:0 0 4px;">${esc(tr(L, 'mail_ticket_doorcode_lead'))}</p>
    <p style="font-family:'Courier New',monospace;font-size:44px;letter-spacing:.22em;line-height:1.1;color:${EMAIL.gold};margin:0 0 6px;font-weight:bold;">${esc(o.doorCode)}</p>` : ''}
    <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:${EMAIL.muted};margin:0 0 22px;">${esc(tr(L, 'mail_ticket_code'))}</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:${EMAIL.ink};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
      <strong>${esc(tr(L, 'mail_ticket_shot'))}</strong>
    </p>
  `, { title: subject, preheader: `${when} · ${dateLine} · ${people}` })

  try {
    const r = await new Resend(key).emails.send({ from: FROM, to: o.email, subject, html })
    if (r.error) return { ok: false, error: r.error.message }
    return { ok: true }
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}
