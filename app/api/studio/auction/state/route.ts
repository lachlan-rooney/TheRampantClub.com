import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// THE LIVE NUMBERS. Public, uncached, and deliberately thin.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ WHY THIS EXISTS AT ALL, RATHER THAN THE PAGE RENDERING THE FIGURES.
// /studio/[slug]/guide is `export const revalidate = 60` — a static page
// rebuilt at most once a minute. A current highest bid rendered into it would
// be up to sixty seconds stale, and two guests standing side by side would see
// different numbers on the same work. An auction cannot be served from a
// cached render, so the figures are fetched in the browser from here, where
// `dynamic` and `no-store` mean what they say.
//
// ── IT USES THE ANON KEY ON PURPOSE ───────────────────────────────────────
// studio_auction_public is SECURITY DEFINER and is the ONLY thing anon may
// touch: the tables themselves grant it nothing. So this route holds no
// privilege it could leak. The function chooses the columns, and there is no
// reserve amount and no bidder in its return type — not filtered out here,
// absent from the shape.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug_required' }, { status: 400 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await sb.rpc('studio_auction_public', { p_slug: slug })

  if (error) {
    // Almost certainly db/studio_auction.sql has not been run. Say so rather
    // than returning an empty list, which the page would render as "no
    // auction" — a silent wrong answer.
    return NextResponse.json(
      { error: 'state_failed', detail: error.message, hint: 'Has db/studio_auction.sql been run?' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    { lots: data || [], now: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
