import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'

// SOMEBODY IS TOLD WHEN AN ENQUIRY ARRIVES.
//
// The Tết page has been live behind its gate for three days with no way for
// anybody to learn that somebody used it. An enquiry landed in tet_enquiries
// and sat there. Against a cask window that shuts on 31 October, a buyer who
// waits a week for an answer is a buyer who has bought somewhere else.
//
// ── IT CANNOT LOSE AN ENQUIRY ─────────────────────────────────────────────
// Every failure here is swallowed and reported, never thrown. The enquiry is
// already committed by the time this runs; a mail outage must not turn a saved
// enquiry into a 500 and a buyer who thinks the form is broken and gives up.
// The caller logs what happened and returns the reference regardless.
//
// ── IT DOES NOT SAY WHAT THINGS COST US ───────────────────────────────────
// The email carries what the buyer told us and nothing the club knows: no
// margin, no cost, no cask economics. It is read on a phone, possibly forwarded
// to a colleague, and the Tết cost model has never been allowed near a client.

// ── WHO IS TOLD ───────────────────────────────────────────────────────────
// The club AND Duncan Taylor Vietnam. The owner gave the DT address on
// 2026-09-23 ("tet email is truongminhquy@duncantaylorvn.com"); membership@
// stays on it so the club keeps a copy of its own enquiries rather than
// hearing about them second-hand.
//
// It is a DEFAULT IN THE CODE, not only an environment variable, because
// TET_ENQUIRY_TO is not set in production and an unset variable would have
// meant Duncan Taylor never being told at all. Setting TET_ENQUIRY_TO (a
// comma-separated list) still overrides this completely.
const DEFAULT_TO = 'membership@therampantclub.com,truongminhquy@duncantaylorvn.com'
const TO = (process.env.TET_ENQUIRY_TO || DEFAULT_TO)
  .split(',').map(s => s.trim()).filter(Boolean)

export interface EnquiryNote {
  reference: string
  mode: 'enquiry' | 'reservation'
  company: string
  name: string
  email: string
  phone?: string | null
  kind: string
  caskRef?: string | null
  bottles?: number | null
  message?: string | null
  locale?: string
  personalised?: boolean
}

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The email's body, separated from the sending so it can be inspected without
 *  putting anything in anybody's inbox. */
export function enquiryEmailHtml(e: EnquiryNote): { subject: string; html: string; what: string } {
  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:7px 0;color:${EMAIL.muted};font-size:12px;letter-spacing:.08em;
                 text-transform:uppercase;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
      <td style="padding:7px 0 7px 20px;color:${EMAIL.ink};font-size:15px;line-height:1.6;">${v}</td>
    </tr>`

  const what = e.kind === 'cask'
    ? `A cask${e.caskRef ? ` — ${esc(e.caskRef)}` : ''}`
    : `Blends${e.bottles ? ` — ${e.bottles} bottles` : ''}`

  const inner = `
    <p style="margin:0 0 6px;color:${EMAIL.gold};font-size:12px;letter-spacing:.2em;text-transform:uppercase;">
      Tết Đinh Mùi ${e.mode === 'reservation' ? '· Reserved' : '· Enquiry'}
    </p>
    <h1 style="margin:0 0 4px;color:${EMAIL.ink};font-size:27px;font-weight:500;">${esc(e.company)}</h1>
    <p style="margin:0 0 26px;color:${EMAIL.muted};font-size:14px;">${esc(e.reference)}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('Wants', what)}
      ${row('Contact', `${esc(e.name)}<br><a href="mailto:${esc(e.email)}" style="color:${EMAIL.gold};">${esc(e.email)}</a>${e.phone ? `<br>${esc(e.phone)}` : ''}`)}
      ${e.message ? row('They said', esc(e.message)) : ''}
      ${e.personalised ? row('Sleeve', 'They designed one — it is on the enquiry') : ''}
      ${row('Reading', e.locale === 'vn' ? 'Tiếng Việt' : 'English')}
    </table>

    <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid ${EMAIL.rule};
              color:${EMAIL.muted};font-size:13px;line-height:1.8;">
      ${e.mode === 'reservation'
        ? 'The cask is held. Prepare the invoice.'
        : 'Prices are still provisional, so nothing is promised. Reply with the cask list and pricing when it is confirmed.'}
      <br><br>
      Casks must be ordered from Scotland by <strong style="color:${EMAIL.ink};">31 October</strong>.
    </p>`

  return {
    what,
    subject: `Tết ${e.mode === 'reservation' ? 'reservation' : 'enquiry'} — ${e.company} (${e.reference})`,
    // Escaped here too. The body was escaped and these were not, which is the
    // usual shape of this bug: the obvious field gets guarded and the title and
    // the preheader — both of which end up inside markup — do not.
    html: emailShell(inner, {
      title: `Tết — ${esc(e.company)}`,
      preheader: `${esc(what)}. ${esc(e.name)}, ${esc(e.email)}`,
    }),
  }
}

export async function notifyTetEnquiry(e: EnquiryNote): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'no RESEND_API_KEY' }
  if (!TO.length) return { sent: false, error: 'no recipient configured' }

  const { subject, html } = enquiryEmailHtml(e)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Reply-To is the buyer, so hitting reply answers them rather than the club.
    const { error } = await resend.emails.send({
      from: 'The Rampant Club <tet@therampantclub.com>',
      to: TO,
      replyTo: e.email,
      subject,
      html,
    })
    return error ? { sent: false, error: String(error.message || error) } : { sent: true }
  } catch (err) {
    return { sent: false, error: String((err as Error)?.message || err) }
  }
}
