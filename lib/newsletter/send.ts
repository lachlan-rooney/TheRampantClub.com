import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderNewsletterEmail, type NewsletterRow } from './render'
import { resolveMemberRecipients } from './recipients'

// The ONE newsletter send entrypoint. A members-wide blast is high-stakes, so a
// LIVE send requires ALL of:
//   • newsletter_settings.send_enabled = true   (master switch)
//   • the row is status 'approved'
//   • confirm === `SEND-ALL-<recipientCount>`   (typed, count-matched)
// A TEST send goes only to settings.test_recipients and never touches status.
// dry=true renders the email HTML and sends nothing.

interface SendOpts { dry?: boolean; mode?: 'test' | 'live'; confirm?: string; actor?: string | null }
interface SendResult { ok: boolean; html?: string; error?: string; sent?: number; failed?: number; need?: string; recipientCount?: number }

export async function sendNewsletter(svc: SupabaseClient, id: string, opts: SendOpts = {}): Promise<SendResult> {
  const { data: row } = await svc.from('newsletters').select('*').eq('id', id).maybeSingle()
  if (!row) return { ok: false, error: 'Newsletter not found.' }
  const { data: settings } = await svc.from('newsletter_settings').select('*').eq('id', 1).maybeSingle()

  const nl: NewsletterRow = { subject: row.subject, sections: row.sections || {}, auto_data: row.auto_data || {}, hero_image: row.hero_image, share_token: row.share_token }
  const html = renderNewsletterEmail(nl)
  if (opts.dry) return { ok: true, html }

  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'Email is not configured (no RESEND_API_KEY).' }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = `${settings?.from_name || 'The Rampant Club'} <${settings?.from_email || 'members@therampantclub.com'}>`

  const mode = opts.mode || 'live'

  // ── TEST send — to the settings test list only, status untouched ──────────
  if (mode === 'test') {
    const test = (settings?.test_recipients || []).filter(Boolean)
    if (!test.length) return { ok: false, error: 'No test recipients set in newsletter settings.' }
    let sent = 0, failed = 0
    for (const to of test) {
      try { const r = await resend.emails.send({ from, to, subject: `[TEST] ${row.subject}`, html }); r.error ? failed++ : sent++ }
      catch { failed++ }
    }
    return { ok: sent > 0, sent, failed }
  }

  // ── LIVE send — the guarded members-wide blast ───────────────────────────
  if (!settings?.send_enabled) return { ok: false, error: 'Sending is disabled. Turn on the master switch in newsletter settings first.' }
  if (row.status !== 'approved') return { ok: false, error: `Only an approved newsletter can be sent (this one is “${row.status}”).` }

  const recipients = await resolveMemberRecipients(svc, settings.suppress || [])
  if (!recipients.length) return { ok: false, error: 'No member recipients resolved.' }

  const expected = `SEND-ALL-${recipients.length}`
  if (opts.confirm !== expected) return { ok: false, error: 'Confirmation does not match the recipient count.', need: expected, recipientCount: recipients.length }

  // Send individually so members never see each other's addresses and one bad
  // address can't fail the whole run.
  const sentEmails: string[] = []
  let failed = 0
  for (const r of recipients) {
    try {
      const res = await resend.emails.send({ from, to: r.email, subject: row.subject, html })
      if (res.error) failed++; else sentEmails.push(r.email)
    } catch { failed++ }
  }

  await svc.from('newsletters').update({
    status: 'sent', sent_at: new Date().toISOString(), sent_to: sentEmails,
    recipient_count: sentEmails.length, updated_at: new Date().toISOString(),
  }).eq('id', id)
  await svc.from('newsletter_activity').insert({
    newsletter_id: id, actor: opts.actor || null, event_type: 'sent',
    from_status: 'approved', to_status: 'sent',
    note: `Sent to ${sentEmails.length} member${sentEmails.length === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`,
  })

  return { ok: sentEmails.length > 0, sent: sentEmails.length, failed }
}
