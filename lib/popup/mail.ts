import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { tr, type Lang } from '@/lib/popup/strings'

// ═══════════════════════════════════════════════════════════════════════════
// EVERY POP-UP EMAIL EXCEPT THE TICKET, IN ONE PLACE.
// ───────────────────────────────────────────────────────────────────────────
// The ticket stays where it is, inside the booking route, because it is sent
// inside the transaction-shaped moment that takes a place and must not be
// pulled away from it. These four are all sent AFTER the fact, by the owner
// or by a timer, and they share everything: the shell, the sender, the
// unsubscribe rule, and what happens when Resend has a bad minute.
//
// ══ THE RULES ════════════════════════════════════════════════════════════
// 1 · NOBODY IS EMAILED TWICE FOR THE SAME REASON. Each sender stamps its own
//     column (reminder_sent_at, followup_sent_at) and the queries that pick
//     recipients exclude anything already stamped. A send that half-fails
//     leaves the unsent half unstamped, so running it again finishes the job
//     instead of starting it over.
// 2 · AN UNSUBSCRIBE IS HONOURED EVERYWHERE. popup_due_reminders and
//     popup_followup_due both exclude unsubscribed addresses in SQL, so it is
//     not a check a new caller can forget to make.
// 3 · A FAILURE IS A RECORD, NOT AN EXCEPTION. send() returns what happened
//     per address. The caller reports it; nothing is retried silently.
// ═══════════════════════════════════════════════════════════════════════════

export const FROM = 'The Rampant Club <events@therampantclub.com>'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A guest's own words, kept as written but never as markup. Newlines become
 *  paragraphs; everything else is escaped. The club writes the body of a
 *  message in a textarea, and a stray `<` must not become a tag. */
export const paras = (text: string, color = EMAIL.ink) =>
  text.split(/\n{2,}/).map(p =>
    `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:${color};margin:0 0 16px;">${
      esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')

export interface Sent { email: string; ok: boolean; error?: string; id?: string }

/** Send one message to many people, one at a time, and say what happened to
 *  each. ⚠ NOT A BATCH: a batch that half-fails tells you a count and not a
 *  list, and the list is the only thing that lets a second run finish the job.
 *
 *  ⚠ IT PACES ITSELF. Resend's default allowance is two a second; nine
 *  sessions of twelve is a hundred-odd messages, and firing them together is
 *  how a send turns into a wall of 429s that each look like a different fault.
 */
export async function sendEach(
  rows: { email: string | null; html: string; subject: string }[],
  opts: { gapMs?: number } = {},
): Promise<Sent[]> {
  const key = process.env.RESEND_API_KEY
  if (!key) return rows.map(r => ({ email: r.email || '', ok: false, error: 'RESEND_API_KEY missing' }))
  const resend = new Resend(key)
  const gap = opts.gapMs ?? 600
  const out: Sent[] = []
  for (const r of rows) {
    if (!r.email) { out.push({ email: '', ok: false, error: 'no address' }); continue }
    try {
      const res = await resend.emails.send({ from: FROM, to: r.email, subject: r.subject, html: r.html })
      if (res.error) throw new Error(res.error.message)
      out.push({ email: r.email, ok: true, id: res.data?.id })
    } catch (e) {
      out.push({ email: r.email, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
    if (gap) await new Promise(s => setTimeout(s, gap))
  }
  return out
}

// ── THE TIME MOVED ────────────────────────────────────────────────────────
export function shiftHtml(L: Lang, o: { was: string; now: string; venue: string; code: string }) {
  const subject = tr(L, 'mail_shift_subject', { time: o.now })
  return {
    subject,
    html: emailShell(`
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 14px;">
        ${esc(tr(L, 'mail_shift_lead'))}
      </h1>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.muted};margin:0 0 4px;text-decoration:line-through;">
        ${esc(tr(L, 'mail_shift_was', { was: o.was }))}
      </p>
      <p style="font-family:Georgia,serif;font-size:40px;line-height:1.1;color:${EMAIL.gold};margin:6px 0 10px;">${esc(o.now)}</p>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.ink};margin:0 0 18px;">
        ${esc(tr(L, 'mail_shift_now', { time: o.now }))}
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0 0 4px;">
        ${esc(tr(L, 'mail_shift_same'))}
      </p>
      <p style="font-family:'Courier New',monospace;font-size:20px;letter-spacing:.18em;color:${EMAIL.ink};margin:0 0 18px;">${esc(o.code)}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        ${esc(o.venue)}
      </p>
    `, { title: subject, preheader: tr(L, 'mail_shift_now', { time: o.now }) }),
  }
}

// ── A MESSAGE FROM THE CLUB ───────────────────────────────────────────────
export function messageHtml(L: Lang, o: { body: string; venue: string; time?: string }) {
  const subject = tr(L, 'mail_msg_subject')
  return {
    subject,
    html: emailShell(`
      ${o.time ? `<p style="font-family:Georgia,serif;font-size:32px;line-height:1.1;color:${EMAIL.gold};margin:0 0 14px;">${esc(o.time)}</p>` : ''}
      ${paras(o.body)}
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        ${esc(o.venue)}
      </p>
    `, { title: subject, preheader: o.body.slice(0, 120) }),
  }
}

// ── TEN MINUTES TO GO ─────────────────────────────────────────────────────
export function reminderHtml(L: Lang, o: { time: string; minutes: number; venue: string; code: string }) {
  const subject = tr(L, 'mail_rem_subject', { time: o.time })
  return {
    subject,
    html: emailShell(`
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 10px;">
        ${esc(tr(L, 'mail_rem_lead', { n: o.minutes }))}
      </h1>
      <p style="font-family:Georgia,serif;font-size:44px;line-height:1.05;color:${EMAIL.gold};margin:0 0 12px;">${esc(o.time)}</p>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.ink};margin:0 0 18px;">
        ${esc(tr(L, 'mail_rem_where'))}
      </p>
      <p style="font-family:'Courier New',monospace;font-size:22px;letter-spacing:.18em;color:${EMAIL.ink};margin:0 0 18px;">${esc(o.code)}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        ${esc(o.venue)}
      </p>
    `, { title: subject, preheader: tr(L, 'mail_rem_lead', { n: o.minutes }) }),
  }
}

// ── THE MORNING AFTER ─────────────────────────────────────────────────────
// ⚠ THE BODY IS THE OWNER'S, VERBATIM. This wraps it and adds the one thing
// the club is obliged to add — a working unsubscribe — and nothing else. No
// invented sign-off, no invented offer.
export function followupHtml(L: Lang, o: {
  name: string; subject: string; body: string; venue: string
  unsubscribeUrl: string; isTest?: boolean
}) {
  return {
    subject: o.isTest ? `[TEST] ${o.subject}` : o.subject,
    html: emailShell(`
      ${o.isTest ? `<p style="font-family:Arial,sans-serif;font-size:12px;color:${EMAIL.gold};margin:0 0 14px;letter-spacing:.1em;">${esc(tr(L, 'mail_fu_test'))}</p>` : ''}
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:${EMAIL.ink};margin:0 0 16px;">
        ${esc(tr(L, 'mail_fu_hello', { name: o.name }))}
      </p>
      ${paras(o.body)}
      <p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        ${esc(o.venue)}<br>
        ${esc(tr(L, 'mail_fu_unsub'))}
        <a href="${o.unsubscribeUrl}" style="color:${EMAIL.gold};">${esc(tr(L, 'mail_fu_unsub_link'))}</a>
      </p>
    `, { title: o.subject, preheader: o.body.slice(0, 120) }),
  }
}

// ── A PLACE HAS OPENED ────────────────────────────────────────────────────
// ⚠ THIS EXISTS BECAUSE THE RUN SHEET WAS TELLING THE OWNER A LIE. Raising the
// cap promoted people off the waiting list and the screen said "they have been
// emailed their ticket" — and nothing sent anything. A waiting list that
// promotes silently is worse than one that does not promote at all: the guest
// is standing in the room believing they have no place.
//
// It carries the QR and the printed code, exactly as the original ticket does,
// because for the guest this IS their ticket — the first one they got said
// they were waiting.
export function promotedHtml(L: Lang, o: {
  time: string; venue: string; code: string; qrDataUri: string
}) {
  const subject = tr(L, 'mail_promoted_subject', { time: o.time })
  return {
    subject,
    html: emailShell(`
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 10px;">
        ${esc(tr(L, 'mail_promoted_lead'))}
      </h1>
      <p style="font-family:Georgia,serif;font-size:44px;line-height:1.05;color:${EMAIL.gold};margin:0 0 10px;">${esc(o.time)}</p>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.ink};margin:0 0 20px;">
        ${esc(tr(L, 'mail_ticket_when', { time: o.time }))}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
        <tr><td style="background:#ffffff;padding:12px;border-radius:8px;">
          <img src="${o.qrDataUri}" width="220" height="220" alt="${esc(tr(L, 'mail_ticket_show'))}" style="display:block;" />
        </td></tr>
      </table>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0 0 4px;">
        ${esc(tr(L, 'mail_ticket_code'))}
      </p>
      <p style="font-family:'Courier New',monospace;font-size:22px;letter-spacing:.18em;color:${EMAIL.ink};margin:0 0 20px;">${esc(o.code)}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        <strong style="color:${EMAIL.ink};">${esc(tr(L, 'mail_ticket_where'))}</strong><br>${esc(o.venue)}
      </p>
    `, { title: subject, preheader: tr(L, 'mail_promoted_lead') }),
  }
}
