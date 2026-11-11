import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { tr, money, closeLabel, dateLabel, type Lang } from '@/lib/studio/auction'
import { alertAdmins } from '@/lib/studio/alert'

// ═══════════════════════════════════════════════════════════════════════════
// "SOMEONE HAS BID HIGHER" — the only message the auction sends unprompted.
// ───────────────────────────────────────────────────────────────────────────
// A silent auction where you only discover you lost at 4pm is a silent auction
// nobody bids twice in. This is the loop: you are told, at once, that you are
// no longer leading, and given one press back to the work.
//
// ══ WHAT IT MUST NEVER DO ═════════════════════════════════════════════════
// Name the new bidder, or hint at them. The email carries the WORK, the NEW
// HIGHEST FIGURE, the closing time and a link — and that is the whole of it.
// buildOutbidEmail() below is a pure function and its parameters are the
// proof: there is no argument through which a bidder's identity could reach
// the page, so it cannot leak one by accident later.
//
// ══ AND WHAT IT MUST NOT DO EITHER ════════════════════════════════════════
// Flood. Four bids in ninety seconds on a popular work would otherwise be four
// emails to the same person. At most one per work per bidder per hour, held by
// studio_bids.outbid_notified_at.
//
// ⚠ THE FIGURE IS READ AT SEND TIME, not at trigger time. So when the hour is
// up and the next bid lands, the email that goes out carries the CURRENT
// highest, not the one that first displaced them.
//
// ⚠ A KNOWN EDGE, STATED RATHER THAN HIDDEN: if someone is outbid, emailed,
// outbid again inside the hour, and then bidding on that work stops entirely,
// they are never told about that last raise. They do know they are no longer
// leading, which is what the message is for. Closing it properly needs a
// sweep on a timer, which is a different thing from this.
// ═══════════════════════════════════════════════════════════════════════════

const FROM = 'The Rampant Club <studio@therampantclub.com>'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The email itself. PURE, and deliberately given nothing it should not have:
 * no name, no address, no bid id, nothing about who did the outbidding.
 */
export function buildOutbidEmail(a: {
  lang: Lang
  title: string      // the work
  amount: number     // the NEW highest, read at send time
  link: string       // straight to that work on the guide
  closesAt: string
  announceAt: string
}): { subject: string; html: string } {
  const { lang, title, amount, link, closesAt, announceAt } = a
  const subject = tr(lang, 'mail_outbid_subject', { title })

  const html = emailShell(`
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 18px;">
      ${esc(tr(lang, 'mail_outbid_lead'))}
    </h1>

    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.gold};margin:0 0 4px;">
      <strong>${esc(title)}</strong>
    </p>
    <p style="font-family:Georgia,serif;font-size:34px;line-height:1.1;color:${EMAIL.ink};margin:0 0 22px;">
      ${esc(money(amount))}
    </p>

    <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0 0 24px;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
      ${esc(tr(lang, 'mail_confirm_when', { time: closeLabel(lang, closesAt), date: dateLabel(lang, announceAt) }))}
    </p>

    <!-- ONE CLEAR BUTTON. Table-wrapped and inline-styled because that is what
         survives Outlook; the gold fill is the same control the club uses to
         agree to an agreement. -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
      <tr><td align="center" bgcolor="${EMAIL.gold}" style="border-radius:6px;">
        <a href="${esc(link)}"
           style="display:inline-block;padding:15px 26px;font-family:Arial,sans-serif;font-size:13px;
                  font-weight:bold;letter-spacing:.12em;text-transform:uppercase;
                  color:#052E20;text-decoration:none;border-radius:6px;">
          ${esc(tr(lang, 'mail_outbid_cta'))} &rarr;
        </a>
      </td></tr>
    </table>
  `, { title: subject, preheader: `${title} — ${money(amount)}` })

  return { subject, html }
}

/**
 * Tell whoever was leading this lot that they no longer are.
 *
 * BEST EFFORT, ALWAYS. Called after the bid is already written; nothing here
 * may undo it, so every failure is caught and reported to staff instead.
 *
 * @param excludeBidId the bid just placed — its owner is the one doing the
 *        outbidding and must never be the recipient.
 */
export async function notifyOutbid(
  a: SupabaseClient,
  opts: { lotId: string; excludeBidId: string; title: string; link: string; closesAt: string; announceAt: string },
): Promise<void> {
  try {
    const { lotId, excludeBidId, title, link, closesAt, announceAt } = opts

    // ── WHO WAS LEADING ───────────────────────────────────────────────────
    // The highest LIVE bid that is not the one just placed. `void = false`
    // matters twice over: a voided bid never made anyone a leader, and
    // voiding one is not an event that sends anything.
    const { data: prev } = await a.from('studio_bids')
      .select('id, amount_usd, bidder_email, bidder_email_key, lang')
      .eq('lot_id', lotId).eq('void', false).neq('id', excludeBidId)
      .order('amount_usd', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1).maybeSingle()
    if (!prev) return

    // ── THE SAME PERSON RAISING THEMSELVES ────────────────────────────────
    // Nobody is outbid when they improve their own bid.
    const { data: now } = await a.from('studio_bids')
      .select('bidder_email_key').eq('id', excludeBidId).maybeSingle()
    if (now?.bidder_email_key === prev.bidder_email_key) return

    // ── THE HOURLY CEILING, per work per bidder ───────────────────────────
    const hourAgo = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await a.from('studio_bids')
      .select('id', { count: 'exact', head: true })
      .eq('lot_id', lotId).eq('bidder_email_key', prev.bidder_email_key)
      .gte('outbid_notified_at', hourAgo)
    if ((count ?? 0) > 0) return

    // ── THE FIGURE, READ NOW ──────────────────────────────────────────────
    const { data: top } = await a.from('studio_bids')
      .select('amount_usd').eq('lot_id', lotId).eq('void', false)
      .order('amount_usd', { ascending: false }).limit(1).maybeSingle()
    const amount = top?.amount_usd
    if (amount == null || amount <= prev.amount_usd) return

    const lang: Lang = prev.lang === 'vn' ? 'vn' : 'en'
    const { subject, html } = buildOutbidEmail({ lang, title, amount, link, closesAt, announceAt })

    // ⚠ STAMPED BEFORE SENDING. If the send throws after the row is stamped,
    // one person misses one email. If it is stamped after, a send that times
    // out and is retried floods them. The ceiling is the thing being
    // protected, so the stamp goes first.
    await a.from('studio_bids').update({ outbid_notified_at: new Date().toISOString() }).eq('id', prev.id)

    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const r = await resend.emails.send({ from: FROM, to: prev.bidder_email, subject, html })
    if (r.error) throw new Error(r.error.message)
  } catch (e) {
    // NEVER THE BID'S PROBLEM. The bid is already written and stands.
    await alertAdmins(a, 'An outbid email could not be sent', {
      lot_id: opts.lotId, detail: e instanceof Error ? e.message : String(e),
    })
  }
}
