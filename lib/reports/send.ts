import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderReportEmail, type ReportRow } from './render'
import { printReportPdf } from './pdf-print'

// Shared report-send logic — used by the manual send route and the Monday
// auto-send cron. Generates chart PNGs, renders the email, attaches the PDF, and
// sends to the configured recipients.
//
// ⚠ BETA GUARD: Shawn must receive NOTHING until the owner declares the system
// live. His address is hard-blocked here regardless of report_settings. When
// going live: remove BLOCKED_BETA and set report_settings.final_recipients.
const BLOCKED_BETA = ['shawnbsmith@gmail.com']

export interface SendResult { ok: boolean; recipients?: string[]; html?: string; error?: string; skipped?: string[] }

export async function sendReport(sb: SupabaseClient, reportId: string, opts: { dry?: boolean; actor?: string | null } = {}): Promise<SendResult> {
  const { data: r } = await sb.from('weekly_reports').select('*').eq('id', reportId).maybeSingle()
  if (!r) return { ok: false, error: 'Not found' }
  if (!opts.dry && r.status !== 'approved') return { ok: false, error: `Can only send an approved report (this is ${r.status}).` }

  // Charts render as email-safe HTML bars (no image dependency) + SVG on the
  // hosted page — no rasterisation needed.
  const report = { ...r } as ReportRow
  const html = renderReportEmail(report)
  if (opts.dry) return { ok: true, html }

  // Recipients — settings minus the beta block.
  const { data: settings } = await sb.from('report_settings').select('final_recipients, cc_recipients').eq('id', 1).maybeSingle()
  const raw = [...(settings?.final_recipients || [])]
  const cc = (settings?.cc_recipients || []).filter((e: string) => !BLOCKED_BETA.includes(e.toLowerCase()))
  const recipients = raw.filter(e => !BLOCKED_BETA.includes(e.toLowerCase()))
  const skipped = raw.filter(e => BLOCKED_BETA.includes(e.toLowerCase()))
  if (!recipients.length) return { ok: false, error: 'No permitted recipients configured.', skipped }
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
    } catch (e) { console.error('report pdf print failed — sending without it:', e) }
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
  await sb.from('report_activity').insert({ report_id: r.id, actor: opts.actor || null, event_type: 'sent', from_status: 'approved', to_status: 'sent', note: skipped.length ? `beta-blocked: ${skipped.join(', ')}` : null })
  return { ok: true, recipients, skipped }
}
