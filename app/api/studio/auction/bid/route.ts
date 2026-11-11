import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { closeLabel, dateLabel, money, stampLabel, tr, type Lang } from '@/lib/studio/auction'
import { BID_COOKIE, COOKIE_OPTS, deviceFrom, hashDevice } from '@/lib/studio/device'
import { alertAdmins } from '@/lib/studio/alert'

// ═══════════════════════════════════════════════════════════════════════════
// PLACING A BID — the only way a row reaches studio_bids.
// ───────────────────────────────────────────────────────────────────────────
// Public, no sign-in, no membership check: a guest scans the QR beside the
// work on their own phone and bids. That is the whole point, and it is also
// why everything below exists.
//
// ── WHAT PROTECTS AN OPEN WRITE ENDPOINT ──────────────────────────────────
// · The browser has NO grant on studio_bids and cannot call studio_place_bid.
//   This route holds the service role; it is the only door.
// · Three ceilings — per device, per email address, and across the whole
//   auction. A page cannot rate-limit itself, so this is the only place any of
//   it can happen.
// · An absurd amount is QUESTIONED, not refused. A fat finger turning US$600
//   into US$600,000 kills the lot: nobody can outbid it and the real bidders
//   go home. But a genuinely large bid is a real thing, so above a multiple of
//   the current highest the guest is asked to press again.
// · The close is enforced in the database (studio_place_bid), not here and not
//   in the page. A phone that has had the page open since this morning still
//   shows a form; the server is what says no.
//
// ── A BID IS NEVER LOST SILENTLY ──────────────────────────────────────────
// The guest is told it is in only after the row exists. Two failure modes,
// handled differently because they are different:
//   WRITE FAILS       → nothing was recorded. Say exactly that, and alert the
//                       admins in-app. The guest can try again safely.
//   EMAIL FAILS       → the bid IS recorded and must not be thrown away. The
//                       guest is told the bid stands but the confirmation did
//                       not send, and the admins are alerted so somebody can
//                       reach them by hand.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

// Per device per ten minutes, per email per hour, and across the auction per
// hour. Generous enough for a real bidding war in the last minutes, tight
// enough that a script is noticed.
const PER_DEVICE_10MIN = 12
const PER_EMAIL_HOUR   = 25
const AUCTION_HOUR     = 400

// Deliberately permissive — the job is to catch a typo, not to adjudicate what
// a valid address is. An over-strict pattern rejects real addresses, and in a
// gallery a rejected guest is a lost bid.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export async function POST(req: Request) {
  const a = svc()
  const jar = await cookies()

  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const lang: Lang = b.lang === 'vn' ? 'vn' : 'en'
  const say = (key: Parameters<typeof tr>[1], vars: Record<string, string | number> = {}) => tr(lang, key, vars)

  const lotId = typeof b.lot_id === 'string' ? b.lot_id : ''
  const name  = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : ''
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const phone = typeof b.phone === 'string' ? b.phone.trim().slice(0, 40) : ''
  const amount = Number(b.amount)
  const sharePrice = b.share_price === true
  const news = b.news === true
  const confirmed = b.confirmed === true
  // THE EXACT WORDS THAT WERE ON THE SCREEN, sent by the client that displayed
  // them. A consent record that cannot say which sentence was agreed to is not
  // evidence of anything — and the server must not invent it, or it records
  // what it WOULD have shown rather than what it did.
  const termsText = typeof b.terms_text === 'string' ? b.terms_text.trim().slice(0, 800) : ''

  if (!lotId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (!name || name.length > 120) return NextResponse.json({ error: say('err_name') }, { status: 400 })
  if (!LOOKS_LIKE_EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: say('err_email') }, { status: 400 })
  }
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) {
    return NextResponse.json({ error: say('err_amount') }, { status: 400 })
  }
  if (!termsText) return NextResponse.json({ error: 'terms_text_missing' }, { status: 400 })

  // ── THE DEVICE HANDLE ───────────────────────────────────────────────────
  // The same cookie, hashed the same way, as the enquiry and "my bids" routes.
  const { device, fresh: freshCookie } = deviceFrom(jar.get(BID_COOKIE)?.value)
  const deviceHash = hashDevice(device)
  const emailKey = email.toLowerCase()

  // ── THE THREE CEILINGS ──────────────────────────────────────────────────
  const tenMin = new Date(Date.now() - 600_000).toISOString()
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const [byDevice, byEmail, overall] = await Promise.all([
    a.from('studio_bids').select('id', { count: 'exact', head: true })
      .eq('device_hash', deviceHash).gte('created_at', tenMin),
    a.from('studio_bids').select('id', { count: 'exact', head: true })
      .eq('bidder_email_key', emailKey).gte('created_at', hourAgo),
    a.from('studio_bids').select('id', { count: 'exact', head: true })
      .gte('created_at', hourAgo),
  ])
  if ((byDevice.count ?? 0) >= PER_DEVICE_10MIN
   || (byEmail.count ?? 0) >= PER_EMAIL_HOUR
   || (overall.count ?? 0) >= AUCTION_HOUR) {
    return NextResponse.json({ error: say('err_busy') }, { status: 429 })
  }

  // ── THE ABSURD-AMOUNT QUESTION ──────────────────────────────────────────
  // Asked BEFORE the write, and only when there is a current highest to be
  // absurd against — the first bid on a lot has no scale to be judged by.
  const { data: lotRow } = await a.from('studio_lots')
    .select('id, piece_id, auction_id, starting_bid_usd, closes_at').eq('id', lotId).maybeSingle()
  if (!lotRow) return NextResponse.json({ error: 'no_lot' }, { status: 404 })

  const { data: auctionRow } = await a.from('studio_auctions')
    .select('id, collaboration_id, closes_at, announce_at, confirm_multiple')
    .eq('id', lotRow.auction_id).maybeSingle()

  const { data: topRow } = await a.from('studio_bids')
    .select('amount_usd').eq('lot_id', lotId).eq('void', false)
    .order('amount_usd', { ascending: false }).limit(1).maybeSingle()

  // ── THE CLOSE IS ASKED FIRST ────────────────────────────────────────────
  // studio_place_bid enforces the close under the row lock and remains the
  // authority; this is about WHICH TRUE THING THE GUEST IS TOLD. Without it,
  // someone arriving at 15:01 with a large number is asked "press again to
  // confirm you meant it" — so they press again, and only then learn bidding
  // ended. The close is the fact that settles the matter, so it is the fact
  // they get. The lot's own close overrides the auction's, as everywhere else.
  const effectiveClose = lotRow.closes_at || auctionRow?.closes_at
  if (effectiveClose && Date.parse(effectiveClose) <= Date.now()) {
    return NextResponse.json({ error: say('err_closed'), closed: true }, { status: 409 })
  }

  const currentHigh: number | null = topRow?.amount_usd ?? null
  const multiple = Number(auctionRow?.confirm_multiple ?? 5)
  if (!confirmed && currentHigh != null && amount > currentHigh * multiple) {
    return NextResponse.json(
      { needs_confirm: true, error: say('err_confirm_big', { amount: money(amount) }) },
      { status: 409 },
    )
  }

  // ── THE WRITE. Locked, serialised, and the only arbiter of too-low. ──────
  const { data: res, error: rpcErr } = await a.rpc('studio_place_bid', {
    p_lot_id: lotId,
    p_amount: amount,
    p_name: name,
    p_email: email,
    p_phone: phone,
    p_lang: lang,
    p_share_price: sharePrice,
    p_news: news,
    p_terms: termsText,
    p_device: deviceHash,
  })

  const out = Array.isArray(res) ? res[0] : res

  if (rpcErr || !out) {
    await alertAdmins(a, 'A bid could not be written', { lot_id: lotId, amount, detail: rpcErr?.message })
    return NextResponse.json(
      { error: say('err_failed'), detail: rpcErr?.message,
        hint: 'Has db/studio_auction.sql been run?' },
      { status: 500 },
    )
  }

  if (!out.ok) {
    const reason = String(out.reason || '')
    if (reason === 'too_low') {
      return NextResponse.json(
        { error: say('err_low', { min: money(out.min_next) }), min_next: out.min_next },
        { status: 409 },
      )
    }
    if (reason === 'closed') return NextResponse.json({ error: say('err_closed'), closed: true }, { status: 409 })
    // not_live / not_auction / no_lot — the work is not biddable at all.
    return NextResponse.json({ error: say('err_closed'), closed: true }, { status: 409 })
  }

  // ═══ FROM HERE THE BID EXISTS. Nothing below may discard it. ════════════
  const placedAt = new Date().toISOString()

  // The title and the link for the email, read server-side rather than taken
  // from the client — the client could say anything.
  const { data: piece } = await a.from('collaboration_pieces')
    .select('title_en, title_vn, sort').eq('id', lotRow.piece_id).maybeSingle()
  const { data: collab } = await a.from('collaborations')
    .select('slug').eq('id', auctionRow?.collaboration_id).maybeSingle()
  const title = (lang === 'vn' ? piece?.title_vn : piece?.title_en) || piece?.title_en || 'The work'
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const link = collab?.slug ? `${site}/studio/${collab.slug}/guide#piece-${(piece?.sort ?? 0) + 1}` : site

  let emailed = false
  let emailError: string | null = null
  try {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const closes = closeLabel(lang, auctionRow!.closes_at)
    const announce = dateLabel(lang, auctionRow!.announce_at)
    const html = emailShell(`
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 18px;">
        ${esc(tr(lang, 'ok_title'))}
      </h1>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.ink};margin:0 0 6px;">
        ${esc(tr(lang, 'mail_confirm_lead'))}
      </p>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:${EMAIL.gold};margin:0 0 18px;">
        <strong>${esc(title)}</strong> — ${esc(money(amount))}<br>
        <span style="color:${EMAIL.muted};font-size:13px;">${esc(stampLabel(lang, placedAt))}</span>
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0 0 10px;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        ${esc(tr(lang, 'mail_confirm_terms'))}
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.75;color:${EMAIL.muted};margin:0 0 20px;">
        ${esc(tr(lang, 'mail_confirm_when', { time: closes, date: announce }))}
      </p>
      <p style="margin:0;"><a href="${link}" style="font-family:Arial,sans-serif;font-size:13px;color:${EMAIL.gold};">${esc(title)} →</a></p>
    `, { title: tr(lang, 'ok_title'), preheader: `${title} — ${money(amount)}` })

    const r = await resend.emails.send({
      from: 'The Rampant Club <studio@therampantclub.com>',
      to: email,
      subject: tr(lang, 'mail_confirm_subject', { title }),
      html,
    })
    if (r.error) throw new Error(r.error.message)
    emailed = true
    await a.from('studio_bids').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', out.bid_id)
  } catch (e) {
    emailError = (e as Error).message
    // THE BID STANDS. The guest is told the truth on screen and somebody is
    // told to reach them by hand.
    await alertAdmins(a, 'A bid was placed but its confirmation email failed', {
      bid_id: out.bid_id, lot_id: lotId, amount, email, detail: emailError,
    })
  }

  const reply = NextResponse.json({
    ok: true,
    bid_id: out.bid_id,
    amount,
    placed_at: placedAt,
    emailed,
  })
  if (freshCookie) {
    reply.cookies.set(BID_COOKIE, freshCookie, COOKIE_OPTS)
  }
  return reply
}

// Minimal escaping for the one place user input reaches HTML. The bidder's own
// name is not in the email body, but a title typed in the admin is.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

