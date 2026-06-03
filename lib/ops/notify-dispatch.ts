import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { describeNotification, notificationLink, type OpsNotification } from './notifications'

// TRC Operations Hub — Phase 6 Layer 2: notification DISPATCH (email channel).
//
// Pluggable: channels register in CHANNELS; today only email (via Resend). A
// future Zalo channel slots in here without touching the flush loop.
//
// dispatchPendingEmails() is the flush. email_status starts 'pending' (Layer-1
// trigger, for email-worthy types); the flush sends it and stamps 'sent'/'failed'
// /'skipped', logging every attempt to notification_deliveries.
//
// No-email-stuck-forever guarantee: during QUIET HOURS the flush leaves rows
// pending (returns early — nothing sent, nothing dropped). It is invoked from
// (1) the ops gateway after notifying writes, (2) the materialiser cron, and
// (3) the dedicated daily flush cron at 09:00 VN (just after quiet hours end) —
// so worst case an email is delayed to that morning sweep, never lost, never
// sent during quiet hours.

const FROM = 'The Rampant Club <ops@therampantclub.com>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
const QUIET_START_VN = 21   // 21:00 — emails suppressed from here…
const QUIET_END_VN = 8      // …until 08:00 VN (in-app still shows; only email waits)

function vnHour(): number {
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }).format(new Date())
  return parseInt(s, 10) % 24
}
export function inQuietHours(): boolean {
  const h = vnHour()
  return h >= QUIET_START_VN || h < QUIET_END_VN
}

function renderEmail(n: OpsNotification): { subject: string; html: string } {
  const line = describeNotification(n)
  const url = SITE + notificationLink(n)
  const subject = line
  const html = `
    <div style="background:#052E20;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#E5D4C2">
      <div style="max-width:480px;margin:0 auto;background:#0A3526;border:1px solid rgba(229,212,194,0.18);border-radius:12px;padding:28px 26px">
        <div style="font-size:11px;letter-spacing:0.18em;color:#7E7864;text-transform:uppercase;margin-bottom:14px">The Rampant Club · Operations</div>
        <div style="font-size:16px;line-height:1.5;color:#E5D4C2;margin-bottom:22px">${line}</div>
        <a href="${url}" style="display:inline-block;background:#D4B85A;color:#052E20;text-decoration:none;font-size:13px;font-weight:bold;padding:10px 18px;border-radius:8px">Open in the Hub →</a>
        <div style="margin-top:24px;font-size:10px;color:#7E7864">You're receiving this because it concerns you directly. Manage notifications in the Hub.</div>
      </div>
    </div>`
  return { subject, html }
}

type FlushResult = { sent: number; failed: number; skipped: number; deferred: boolean }

export async function dispatchPendingEmails(sb: SupabaseClient): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, skipped: 0, deferred: false }

  // Quiet hours → leave everything pending for the next post-quiet sweep.
  if (inQuietHours()) { result.deferred = true; return result }

  const { data } = await sb
    .from('notifications')
    .select('*')
    .eq('email_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)
  const pending = (data ?? []) as OpsNotification[]
  if (pending.length === 0) return result

  const apiKey = process.env.RESEND_API_KEY
  const resend = apiKey ? new Resend(apiKey) : null

  for (const n of pending) {
    // Recipient email lives in auth.users — service-role admin API (same source
    // as /api/admin/members). profiles without a login/email → cannot email.
    let email: string | null = null
    try {
      const { data: u } = await sb.auth.admin.getUserById(n.recipient)
      email = u?.user?.email ?? null
    } catch { email = null }

    if (!email || !resend) {
      const detail = !resend ? 'RESEND_API_KEY not set' : 'no email address for recipient'
      await sb.from('notifications').update({ email_status: 'skipped' }).eq('id', n.id)
      await sb.from('notification_deliveries').insert({ notification_id: n.id, channel: 'email', status: 'skipped', detail })
      result.skipped++
      continue
    }

    const { subject, html } = renderEmail(n)
    try {
      const { error } = await resend.emails.send({ from: FROM, to: email, subject, html })
      if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error))
      await sb.from('notifications').update({ email_status: 'sent' }).eq('id', n.id)
      await sb.from('notification_deliveries').insert({ notification_id: n.id, channel: 'email', status: 'sent', detail: email })
      result.sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Terminal 'failed' (not retried by future sweeps) but VISIBLE in the
      // delivery log — never silently lost; an admin can re-queue if needed.
      await sb.from('notifications').update({ email_status: 'failed' }).eq('id', n.id)
      await sb.from('notification_deliveries').insert({ notification_id: n.id, channel: 'email', status: 'failed', detail: msg.slice(0, 400) })
      result.failed++
    }
  }
  return result
}
