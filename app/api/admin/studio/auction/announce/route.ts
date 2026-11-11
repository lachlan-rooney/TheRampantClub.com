import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isAdmin } from '@/lib/admin'
import { EMAIL, emailShell } from '@/lib/email/shell'
import { money, tr, type Lang } from '@/lib/studio/auction'

// ═══════════════════════════════════════════════════════════════════════════
// THE ANNOUNCEMENT — a draft, and then a human.
// ───────────────────────────────────────────────────────────────────────────
// NOTHING HERE EVER FIRES ON A TIMER. There is no cron that sends this, and
// there is deliberately no "send at 16:00" switch to forget you set. The
// admin shows a reminder from the announcement hour that a draft is ready;
// sending is a person reading it and pressing Send.
//
// ── TWO LETTERS, NOT ONE ──────────────────────────────────────────────────
// The winner is told they won and for how much. Everyone else is told the
// work has been won — and whether that sentence carries the PRICE is decided
// by the box the WINNER ticked when they bid, not by whoever presses Send and
// not by the losing bidders' own choices. The winner's name is never in the
// other letter, under any setting.
//
// ── AND IN THEIR OWN LANGUAGE ─────────────────────────────────────────────
// Each bid stored the language its bidder was reading. A person who bid in
// Vietnamese gets the Vietnamese letter, whatever anybody else got.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

interface Letter {
  to: string
  name: string
  lang: Lang
  kind: 'winner' | 'other'
  lot_title: string
  subject: string
  body: string
}

async function buildLetters(a: SupabaseClient, collaboration: string): Promise<{
  letters: Letter[]
  lots: Array<Record<string, unknown>>
  closed: boolean
  error?: string
}> {
  const { data: auction } = await a.from('studio_auctions')
    .select('*').eq('collaboration_id', collaboration).maybeSingle()
  if (!auction) return { letters: [], lots: [], closed: false, error: 'No auction for this exhibition.' }

  const { data: lots } = await a.from('studio_lots')
    .select('*').eq('auction_id', auction.id).eq('kind', 'auction').order('sort')

  const pieceIds = (lots || []).map(l => l.piece_id)
  const { data: pieces } = pieceIds.length
    ? await a.from('collaboration_pieces').select('id, title_en, title_vn').in('id', pieceIds)
    : { data: [] as Array<{ id: string; title_en: string | null; title_vn: string | null }> }
  const byPiece = new Map((pieces || []).map(p => [p.id, p]))

  const lotIds = (lots || []).map(l => l.id)
  const { data: bids } = lotIds.length
    ? await a.from('studio_bids').select('*').in('lot_id', lotIds).eq('void', false)
    : { data: [] as Array<Record<string, unknown>> }

  const closed = Date.now() >= Date.parse(auction.closes_at)
  const letters: Letter[] = []
  const summary: Array<Record<string, unknown>> = []

  for (const lot of lots || []) {
    const mine = (bids || []).filter(b => b.lot_id === lot.id)
    const ranked = [...mine].sort((x, y) =>
      y.amount_usd - x.amount_usd || Date.parse(x.created_at) - Date.parse(y.created_at))
    const winner = ranked[0] || null
    const reserveMet = lot.reserve_usd == null ? ranked.length > 0 : (winner?.amount_usd ?? 0) >= lot.reserve_usd
    const sharePrice = !!winner?.share_price_consent
    const piece = byPiece.get(lot.piece_id)

    summary.push({
      lot_id: lot.id,
      title: piece?.title_en || 'Untitled',
      winner_name: winner?.bidder_name ?? null,
      winner_email: winner?.bidder_email ?? null,
      amount: winner?.amount_usd ?? null,
      reserve_met: reserveMet,
      winner_shares_price: winner ? sharePrice : null,
      entrants: mine.length,
    })

    // ONE PERSON, ONE LETTER PER WORK THEY BID ON. Somebody who bid five times
    // on one painting gets one letter about that painting, not five.
    const seen = new Set<string>()
    for (const b of mine) {
      const key = String(b.bidder_email).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const lang: Lang = b.lang === 'vn' ? 'vn' : 'en'
      const title = (lang === 'vn' ? piece?.title_vn : piece?.title_en) || piece?.title_en || 'The work'
      const isWinner = !!winner && String(winner.bidder_email).toLowerCase() === key && reserveMet

      const line = isWinner
        ? tr(lang, 'mail_result_won', { amount: money(winner!.amount_usd) })
        : !reserveMet
          ? tr(lang, 'mail_result_unsold')
          : sharePrice
            ? tr(lang, 'mail_result_lost_with_price', { amount: money(winner!.amount_usd) })
            : tr(lang, 'mail_result_lost_no_price')

      letters.push({
        to: b.bidder_email,
        name: b.bidder_name,
        lang,
        kind: isWinner ? 'winner' : 'other',
        lot_title: piece?.title_en || 'Untitled',
        subject: tr(lang, 'mail_result_subject', { title }),
        body: line,
      })
    }
  }

  return { letters, lots: summary, closed }
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const collaboration = req.nextUrl.searchParams.get('collaboration')
  if (!collaboration) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })
  const out = await buildLetters(svc(), collaboration)
  if (out.error) return NextResponse.json({ error: out.error }, { status: 404 })
  return NextResponse.json(out)
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const collaboration = String(b.collaboration || '')
  if (!collaboration) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })

  const a = svc()
  const { letters, closed, error } = await buildLetters(a, collaboration)
  if (error) return NextResponse.json({ error }, { status: 404 })

  // ⚠ NEVER BEFORE THE CLOSE. Announcing a result while bidding is open tells
  // the losing bidders the winning price with time left to beat it.
  if (!closed) {
    return NextResponse.json({ error: 'Bidding has not closed yet. Nothing can be announced.' }, { status: 400 })
  }
  // TYPED, AND COUNT-MATCHED. The same shape the newsletter uses: the number
  // in the confirmation has to match the number of letters about to go, so a
  // list that changed since the draft was read cannot be sent by accident.
  if (b.confirm !== `SEND-${letters.length}`) {
    return NextResponse.json({ error: 'Not confirmed.', need: `SEND-${letters.length}` }, { status: 400 })
  }
  // An edited body, if the owner rewrote one. Keyed by recipient+title so a
  // rewrite follows the letter it was written for.
  const edits: Record<string, string> = (b.edits && typeof b.edits === 'object') ? b.edits : {}

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not configured (no RESEND_API_KEY).' }, { status: 500 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  let sent = 0, failed = 0
  const problems: string[] = []
  for (const L of letters) {
    const key = `${L.to.toLowerCase()}::${L.lot_title}`
    const body = typeof edits[key] === 'string' && edits[key].trim() ? edits[key].trim() : L.body
    const html = emailShell(`
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:${EMAIL.ink};margin:0 0 16px;">
        ${esc(L.lot_title)}
      </h1>
      <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:${EMAIL.ink};margin:0 0 18px;white-space:pre-wrap;">${esc(body)}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:${EMAIL.muted};margin:0;border-top:1px solid ${EMAIL.rule};padding-top:16px;">
        The Studio · The Rampant Club
      </p>
    `, { title: L.subject, preheader: L.lot_title })
    try {
      const r = await resend.emails.send({
        from: 'The Rampant Club <studio@therampantclub.com>',
        to: L.to, subject: L.subject, html,
      })
      if (r.error) throw new Error(r.error.message)
      sent++
    } catch (e) {
      failed++
      problems.push(`${L.to}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ ok: failed === 0, sent, failed, problems })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
