import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { BID_COOKIE, hashDevice } from '@/lib/studio/device'

// ═══════════════════════════════════════════════════════════════════════════
// WHERE DO MY OWN BIDS STAND — asked by the phone that placed them.
// ───────────────────────────────────────────────────────────────────────────
// A guest bids on Black Swan, walks the rest of the room, and comes back. The
// work should say "you have been outbid" with the control to bid again, rather
// than making them remember what they bid and compare it to the figure.
//
// ── WHY THIS IS NOT A LEAK ────────────────────────────────────────────────
// It returns ONE number per lot — the highest amount bid from THIS device, read
// through the hash of a cookie this server set. There is no name, no email, no
// other bidder, and no way to ask about a device that is not the caller's: the
// cookie is httpOnly, so the page itself cannot read or forge it. A request
// with no cookie gets an empty object, which is the truthful answer.
//
// It needs the service role because studio_bids grants nothing to anybody —
// which is also why this narrow shape is written out by hand rather than the
// row being passed through.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug_required' }, { status: 400, headers: NO_STORE })

  const cookie = (await cookies()).get(BID_COOKIE)?.value
  // NO COOKIE, NOTHING TO SAY. Not an error — most readers of the guide have
  // never bid, and they must not be told anything about anybody who has.
  if (!cookie || cookie.length < 8) {
    return NextResponse.json({ mine: {} }, { headers: NO_STORE })
  }

  const a = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Scoped to this exhibition's auction, so a device's bids on one show cannot
  // be read back through another show's page.
  const { data: collab } = await a.from('collaborations').select('id').eq('slug', slug).maybeSingle()
  if (!collab) return NextResponse.json({ mine: {} }, { headers: NO_STORE })
  const { data: auction } = await a.from('studio_auctions')
    .select('id').eq('collaboration_id', collab.id).maybeSingle()
  if (!auction) return NextResponse.json({ mine: {} }, { headers: NO_STORE })
  const { data: lots } = await a.from('studio_lots').select('id').eq('auction_id', auction.id)
  const lotIds = (lots || []).map(l => l.id)
  if (!lotIds.length) return NextResponse.json({ mine: {} }, { headers: NO_STORE })

  const { data: bids, error } = await a.from('studio_bids')
    .select('lot_id, amount_usd')
    .eq('device_hash', hashDevice(cookie))
    .eq('void', false)                     // A VOIDED BID IS NOT MINE EITHER.
    .in('lot_id', lotIds)
  if (error) return NextResponse.json({ mine: {} }, { headers: NO_STORE })

  // The highest this device bid on each work. One number, nothing else.
  const mine: Record<string, number> = {}
  for (const b of bids || []) {
    if (!(b.lot_id in mine) || b.amount_usd > mine[b.lot_id]) mine[b.lot_id] = b.amount_usd
  }
  return NextResponse.json({ mine }, { headers: NO_STORE })
}
