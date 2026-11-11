import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ═══════════════════════════════════════════════════════════════════════════
// THE AUCTION, FROM THE INSIDE. Admin only, and the only surface anywhere
// that can see a reserve or a bidder.
// ───────────────────────────────────────────────────────────────────────────
// The public function studio_auction_public deliberately has no reserve and no
// bidder in its return type. This route reads the tables directly with the
// service role, which is why `isAdmin()` is the first line of every handler
// and why there is no fallthrough that answers a request that failed it.
//
// ── A BID IS VOIDED, NEVER DELETED ────────────────────────────────────────
// Voiding drops it out of the public current highest and out of ranking, and
// leaves on the row who did it, when, and why. A deleted bid is a number that
// changed with no account of itself — which is the one thing an auction cannot
// afford.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const AUCTION_FIELDS = new Set([
  'closes_at', 'announce_at', 'published', 'min_step_usd', 'confirm_multiple', 'vn_reviewed_at',
])
// A WHITELIST, NOT A SPREAD. Every one of these is a field a person is meant
// to type; `id`, `auction_id`, `piece_id` and `created_at` are not on it, so a
// crafted body cannot move a lot onto another exhibition's auction or point it
// at a different painting.
const LOT_FIELDS = new Set([
  'kind', 'status', 'sort', 'title_vn',
  // Priced
  'price_usd', 'price_note_en', 'price_note_vn',
  // Auction
  'starting_bid_usd', 'step_usd', 'reserve_usd', 'closes_at',
  // The donation share, and the sale record
  'donation_pct', 'donation_org',
  'sold_price_usd', 'sold_to', 'sold_on', 'sold_note',
])

const MISSING = 'Has db/studio_auction.sql been run?'

// ── GET: everything an admin needs about one exhibition's auction ─────────
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const collaboration = req.nextUrl.searchParams.get('collaboration')
  if (!collaboration) return NextResponse.json({ error: 'Which exhibition?' }, { status: 400 })

  const a = svc()
  const { data: auction, error: aErr } = await a.from('studio_auctions')
    .select('*').eq('collaboration_id', collaboration).maybeSingle()
  // A missing TABLE and a missing ROW are different answers and the admin
  // page says different things about them.
  if (aErr) return NextResponse.json({ missing: true, hint: MISSING, detail: aErr.message })
  if (!auction) return NextResponse.json({ auction: null, lots: [] })

  const { data: lots } = await a.from('studio_lots')
    .select('*').eq('auction_id', auction.id).order('sort')

  const pieceIds = (lots || []).map(l => l.piece_id)
  const { data: pieces } = pieceIds.length
    ? await a.from('collaboration_pieces')
        .select('id, title_en, title_vn, year, sort, image_path').in('id', pieceIds)
    : { data: [] as Array<Record<string, unknown>> }
  const byPiece = new Map((pieces || []).map(p => [p.id as string, p]))

  const lotIds = (lots || []).map(l => l.id)
  const { data: bids } = lotIds.length
    ? await a.from('studio_bids')
        .select('*').in('lot_id', lotIds).order('created_at', { ascending: false })
    : { data: [] as Array<Record<string, unknown>> }

  // ENQUIRIES on the priced works. Same table scoping as the bids: by lot, so
  // one exhibition's admin screen cannot read another's.
  const { data: enquiries } = lotIds.length
    ? await a.from('studio_enquiries')
        .select('*').in('lot_id', lotIds).order('created_at', { ascending: false })
    : { data: [] as Array<Record<string, unknown>> }

  const out = (lots || []).map(l => {
    const mine = (bids || []).filter(b => b.lot_id === l.id)
    const live = mine.filter(b => !b.void)
    // The leader: highest amount, earliest of a tie. A tie cannot happen while
    // studio_place_bid refuses an equal bid, but ranking must not DEPEND on
    // that — a bid voided out from under a tie would otherwise be ambiguous.
    const leader = [...live].sort((x, y) =>
      y.amount_usd - x.amount_usd || Date.parse(x.created_at) - Date.parse(y.created_at))[0] || null
    const high = leader?.amount_usd ?? null
    return {
      ...l,
      piece: byPiece.get(l.piece_id) || null,
      bids: mine,
      enquiries: (enquiries || []).filter(e => e.lot_id === l.id),
      bid_count: live.length,
      highest_usd: high,
      leader,
      // The winner's choice decides what the OTHER bidders' email says. Shown
      // beside the result so the draft holds no surprises.
      winner_shares_price: leader ? !!leader.share_price_consent : null,
      reserve_met: l.reserve_usd == null ? live.length > 0 : (high ?? 0) >= l.reserve_usd,
    }
  })

  // ── THE FEED. Every bid across the whole auction, newest first, with the
  // work's title attached — for watching during the opening, which is a
  // different job from reading one work's history. Built here rather than in
  // the page so it is one ordering decided in one place.
  const titleOf = (lotId: string) => {
    const lot = (lots || []).find(l => l.id === lotId)
    const piece = lot ? byPiece.get(lot.piece_id) : null
    return (piece?.title_en as string) || 'Untitled'
  }
  const feed = (bids || []).slice(0, 120).map(b => ({ ...b, title: titleOf(b.lot_id) }))

  return NextResponse.json({
    auction, lots: out, feed,
    enquiry_count: (enquiries || []).filter(e => !e.handled_at).length,
    now: new Date().toISOString(),
  })
}

// ── PATCH: change the auction, or one lot ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const a = svc()

  if (b.auction_id) {
    const patch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(b.fields || {})) if (AUCTION_FIELDS.has(k)) patch[k] = v
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

    // ⚠ PUBLISHING IS THE ONE IRREVERSIBLE-FEELING ACT HERE, so it is checked
    // rather than taken on trust: an auction published with no live auction
    // lot shows a guest a banner promising works in the auction and then none.
    if (patch.published === true) {
      const { data: auction } = await a.from('studio_auctions').select('id').eq('id', b.auction_id).maybeSingle()
      if (!auction) return NextResponse.json({ error: 'No such auction.' }, { status: 404 })
      const { data: ready } = await a.from('studio_lots')
        .select('id, kind, status, starting_bid_usd')
        .eq('auction_id', b.auction_id).eq('kind', 'auction').eq('status', 'live')
      const live = ready || []
      if (!live.length) {
        return NextResponse.json({
          error: 'Nothing to publish yet: no work is set to Auction and Live. Set those first.',
        }, { status: 400 })
      }
      const noStart = live.filter(l => !l.starting_bid_usd)
      if (noStart.length) {
        return NextResponse.json({
          error: `${noStart.length} auction work(s) have no starting bid. A bid form with no floor accepts US$1.`,
        }, { status: 400 })
      }
    }

    const { error } = await a.from('studio_auctions').update(patch).eq('id', b.auction_id)
    if (error) return NextResponse.json({ error: error.message, hint: MISSING }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b.lot_id) {
    const patch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(b.fields || {})) if (LOT_FIELDS.has(k)) patch[k] = v
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    const { error } = await a.from('studio_lots').update(patch).eq('id', b.lot_id)
    if (error) return NextResponse.json({ error: error.message, hint: MISSING }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Nothing addressed.' }, { status: 400 })
}

// ── POST: void or restore a bid ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const action = String(b.action || '')
  if (!['void', 'unvoid', 'handled', 'unhandled'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  // WHO DID IT. Read from the session, never from the body.
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  const a = svc()

  // ── AN ENQUIRY, DEALT WITH OR REOPENED. Same shape as voiding: the record
  // keeps who and when, and nothing is deleted.
  if (action === 'handled' || action === 'unhandled') {
    if (!b.enquiry_id) return NextResponse.json({ error: 'Which enquiry?' }, { status: 400 })
    const { error } = await a.from('studio_enquiries').update(
      action === 'handled'
        ? { handled_at: new Date().toISOString(), handled_by: user?.id ?? null }
        : { handled_at: null, handled_by: null },
    ).eq('id', b.enquiry_id)
    if (error) return NextResponse.json({ error: error.message, hint: MISSING }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!b.bid_id) return NextResponse.json({ error: 'Which bid?' }, { status: 400 })
  const patch = action === 'void'
    ? { void: true,
        void_reason: (typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '') || 'No reason given',
        voided_at: new Date().toISOString(), voided_by: user?.id ?? null }
    : { void: false, void_reason: null, voided_at: null, voided_by: null }

  const { error } = await a.from('studio_bids').update(patch).eq('id', b.bid_id)
  if (error) return NextResponse.json({ error: error.message, hint: MISSING }, { status: 500 })
  return NextResponse.json({ ok: true })
}
