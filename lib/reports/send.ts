import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderReportEmail, type ReportRow } from './render'
import { printReportPdf } from './pdf-print'

// Shared report-send logic — used by the manual send route and the Monday
// auto-send cron. Renders the email, prints the PDF from the report's own
// hosted page, and sends to the configured recipients.
//
// ── THE BETA GUARD IS GONE, 2026-09-25 ────────────────────────────────────
// Owner: "Ok, i'm taking the training wheels off. Send that report to Shawn
// please." Until this commit there were TWO locks and both had to be opened:
// a hard-coded block on shawnbsmith@gmail.com here, which filtered him out of
// any recipient list whatever the settings said, and report_settings.
// final_recipients, which held only the owner's own address.
//
// The code lock is removed. THE LIST IS NOW THE WHOLE TRUTH: whoever is in
// report_settings.final_recipients receives the weekly report, including on
// Monday morning when the cron sends it with nobody watching. To stop someone
// receiving it, take them out of that list — there is no longer a second
// answer hidden in the source.

export interface SendResult { ok: boolean; recipients?: string[]; html?: string; error?: string
  /** Whether the printed PDF went with it. A send that quietly lost its
   *  attachment used to look identical to one that carried it. */
  attached?: boolean }

export async function sendReport(
  sb: SupabaseClient,
  reportId: string,
  /** requirePdf: refuse to send rather than send without the attachment. The
   *  MANUAL send sets it — somebody is standing there and can try again, and
   *  the owner asked for the email and the PDF together (2026-09-25). The
   *  Monday cron does NOT: at 17:00 with nobody watching, a report in the body
   *  of an email beats no report at all. */
  opts: { dry?: boolean; actor?: string | null; requirePdf?: boolean } = {},
): Promise<SendResult> {
  const { data: r } = await sb.from('weekly_reports').select('*').eq('id', reportId).maybeSingle()
  if (!r) return { ok: false, error: 'Not found' }
  if (!opts.dry && r.status !== 'approved') return { ok: false, error: `Can only send an approved report (this is ${r.status}).` }

  // Charts render as email-safe HTML bars (no image dependency) + SVG on the
  // hosted page — no rasterisation needed.
  const report = { ...r } as ReportRow
  const html = renderReportEmail(report)
  if (opts.dry) return { ok: true, html }

  // Recipients — the configured list, as configured.
  const { data: settings } = await sb.from('report_settings').select('final_recipients, cc_recipients').eq('id', 1).maybeSingle()
  const recipients = [...(settings?.final_recipients || [])]
  const cc = [...(settings?.cc_recipients || [])]
  if (!recipients.length) return { ok: false, error: 'No recipients configured.' }
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'Email not configured.' }

  // ── THE ATTACHMENT IS THE PAGE ──────────────────────────────────────────
  // Printed from the report's own hosted URL — the one the owner previews —
  // rather than drawn a second time (owner, 2026-09-25: "The attached PDF ...
  // doesn't look like it does when i preview on the site"). See pdf-print.ts.
  //
  // NO FALLBACK TO A DRAWN DOCUMENT, deliberately: the old one was the thing
  // being complained about, and a silent fallback would send it on exactly the
  // days nobody was watching. If the browser cannot run, the email goes with
  // the full report in its body and the link at the top, which is what it
  // would have been anyway.
  let attachments: { filename: string; content: Buffer }[] = []
  if (r.share_token) {
    try {
      const pdf = await printReportPdf(r.share_token)
      attachments = [{ filename: `Rampant_Weekly_Report_${r.period_end}.pdf`, content: Buffer.from(pdf) }]
    } catch (e) {
      console.error('report pdf print failed:', e)
      if (opts.requirePdf) {
        return { ok: false, error: `The PDF could not be printed, so nothing was sent: ${e instanceof Error ? e.message : 'print failed'}` }
      }
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    await resend.emails.send({
      from: 'The Rampant Club <weekly@therampantclub.com>',
      to: recipients,
      cc: cc.length ? cc : undefined,
      subject: `The Rampant Club — Weekly Report, ${r.auto_data?.period?.label || r.period_end}`,
      html, attachments,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' }
  }

  await sb.from('weekly_reports').update({ status: 'sent', sent_at: new Date().toISOString(), sent_to: recipients, updated_at: new Date().toISOString() }).eq('id', r.id)
  await sb.from('report_activity').insert({ report_id: r.id, actor: opts.actor || null, event_type: 'sent', from_status: 'approved', to_status: 'sent', note: `to: ${recipients.join(', ')}${attachments.length ? ' · with the printed PDF' : ' · NO attachment (the print failed)'}` })
  return { ok: true, recipients, attached: attachments.length > 0 }
}
