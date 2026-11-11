import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { money, tr, type Lang } from '@/lib/studio/auction'
import { BID_COOKIE, COOKIE_OPTS, deviceFrom, hashDevice } from '@/lib/studio/device'
import { adminEmails, alertAdmins } from '@/lib/studio/alert'

// ═══════════════════════════════════════════════════════════════════════════
// AN ENQUIRY ABOUT A PRICED WORK — a name, an address, and which painting.
// ───────────────────────────────────────────────────────────────────────────
// A priced work cannot be bought from a phone: there is a conversation, an
// invoice and a crate. So this control promises exactly one thing — somebody
// will be in touch — and it is the only thing it does.
//
// ── NOTHING MARKETING-SHAPED HAPPENS HERE ─────────────────────────────────
// There is no news box on this form and no list to be added to. A guest asking
// the price of a painting has not consented to anything else, and burying that
// consent in a sales enquiry is the behaviour the club's own privacy notice
// exists to rule out.
//
// ── IT IS NOT AVAILABLE ON A SOLD WORK ────────────────────────────────────
// Checked HERE and not only in the page: the control is gone from a sold work,
// but a route that would still accept the POST is a route that can be made to
// take enquiries for a painting that is already on somebody's wall.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const PER_DEVICE_10MIN = 6
const PER_EMAIL_HOUR   = 10
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
  const say = (k: Parameters<typeof tr>[1], v: Record<string, string | number> = {}) => tr(lang, k, v)

  const lotId = typeof b.lot_id === 'string' ? b.lot_id : ''
  const name  = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : ''
  const email = typeof b.email === 'string' ? b.email.trim() : ''
  const phone = typeof b.phone === 'string' ? b.phone.trim().slice(0, 40) : ''
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 1200) : ''

  if (!lotId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (!name || name.length > 120) return NextResponse.json({ error: say('err_name') }, { status: 400 })
  if (!LOOKS_LIKE_EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: say('err_email') }, { status: 400 })
  }

  const { device, fresh } = deviceFrom(jar.get(BID_COOKIE)?.value)
  const deviceHash = hashDevice(device)
  const emailKey = email.toLowerCase()

  // ── THE CEILINGS. Lower than the bid route's, because there is no reason to
  // send the same enquiry twelve times in ten minutes. ────────────────────
  const tenMin = new Date(Date.now() - 600_000).toISOString()
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const [byDevice, byEmail] = await Promise.all([
    a.from('studio_enquiries').select('id', { count: 'exact', head: true })
      .eq('device_hash', deviceHash).gte('created_at', tenMin),
    a.from('studio_enquiries').select('id', { count: 'exact', head: true })
      .eq('email_key', emailKey).gte('created_at', hourAgo),
  ])
  if ((byDevice.count ?? 0) >= PER_DEVICE_10MIN || (byEmail.count ?? 0) >= PER_EMAIL_HOUR) {
    return NextResponse.json({ error: say('err_busy') }, { status: 429 })
  }

  // ── IS THIS WORK ACTUALLY TAKING ENQUIRIES ──────────────────────────────
  const { data: lot } = await a.from('studio_lots')
    .select('id, kind, status, price_usd, piece_id, auction_id').eq('id', lotId).maybeSingle()
  if (!lot) return NextResponse.json({ error: 'no_lot' }, { status: 404 })
  const { data: auction } = await a.from('studio_auctions')
    .select('id, published, collaboration_id').eq('id', lot.auction_id).maybeSingle()
  // A draft lot, a sold work, an auction lot (which takes bids, not enquiries)
  // or an unpublished auction: the same flat refusal, because none of them is
  // a state a guest should be able to probe for.
  if (!auction?.published || lot.kind !== 'sale' || lot.status !== 'live') {
    return NextResponse.json({ error: say('err_enq_failed') }, { status: 409 })
  }

  const { data: piece } = await a.from('collaboration_pieces')
    .select('title_en, title_vn, sort').eq('id', lot.piece_id).maybeSingle()
  const titleEn = piece?.title_en || 'Untitled'
  const titleShown = (lang === 'vn' ? piece?.title_vn : piece?.title_en) || titleEn

  // ── THE WRITE COMES FIRST. Nothing is confirmed to the guest until the row
  // exists; an enquiry that only ever existed as an email is an enquiry that
  // is lost the moment the email fails. ──────────────────────────────────
  const { error: insErr } = await a.from('studio_enquiries').insert({
    lot_id: lotId, name, email, email_key: emailKey,
    phone: phone || null, message: message || null, lang, device_hash: deviceHash,
  })
  if (insErr) {
    await alertAdmins(a, 'An enquiry could not be written', {
      lot_id: lotId, title: titleEn, detail: insErr.message,
    })
    return NextResponse.json(
      { error: say('err_enq_failed'), detail: insErr.message,
        hint: 'Has db/studio_auction.sql been run?' },
      { status: 500 },
    )
  }

  // ── THEN THE PEOPLE. In-app for everybody, and an email to whoever has a
  // login, because during an opening nobody is watching a bell. ──────────
  await alertAdmins(a, `Enquiry: ${titleEn} — ${name}`, {
    lot_id: lotId, title: titleEn, name, email, phone: phone || null,
  })

  let notified = false
  try {
    const to = await adminEmails(a)
    if (to.length && process.env.RESEND_API_KEY) {
      const { data: collab } = await a.from('collaborations')
        .select('slug').eq('id', auction.collaboration_id).maybeSingle()
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
      const link = collab?.slug
        ? `${site}/studio/${collab.slug}/guide#piece-${(piece?.sort ?? 0) + 1}`
        : site
      const resend = new Resend(process.env.RESEND_API_KEY)
      const html = emailShell(`
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;line-height:1.25;color:${EMAIL.ink};margin:0 0 16px;">
          ${esc(titleEn)} — an enquiry
        </h1>
        <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:${EMAIL.ink};margin:0 0 16px;">
          <strong>${esc(name)}</strong><br>
          <a href="mailto:${esc(email)}" style="color:${EMAIL.gold};">${esc(email)}</a>
          ${phone ? `<br>${esc(phone)}` : ''}
        </p>
        ${message ? `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:${EMAIL.ink};margin:0 0 16px;white-space:pre-wrap;border-left:2px solid ${EMAIL.rule};padding-left:12px;">${esc(message)}</p>` : ''}
        <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:${EMAIL.muted};margin:0 0 18px;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
          ${esc(titleEn)} · ${esc(money(lot.price_usd))} · asked in ${lang === 'vn' ? 'Vietnamese' : 'English'}
        </p>
        <p style="margin:0;"><a href="${link}" style="font-family:Arial,sans-serif;font-size:13px;color:${EMAIL.gold};">The work on the guide →</a></p>
      `, { title: `Enquiry — ${titleEn}`, preheader: `${name} · ${email}` })
      const r = await resend.emails.send({
        from: 'The Rampant Club <studio@therampantclub.com>',
        to, subject: `Enquiry — ${titleEn}`, html,
      })
      if (r.error) throw new Error(r.error.message)
      notified = true
    }
  } catch (e) {
    // THE ENQUIRY STANDS. It is on the admin screen either way; this only
    // means nobody was pinged, so say so where a person will see it.
    await alertAdmins(a, 'An enquiry was recorded but the staff email failed', {
      lot_id: lotId, title: titleEn, name, email, detail: (e as Error).message,
    })
  }

  const reply = NextResponse.json({ ok: true, title: titleShown, notified })
  if (fresh) reply.cookies.set(BID_COOKIE, fresh, COOKIE_OPTS)
  return reply
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
