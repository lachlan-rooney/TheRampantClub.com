import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/sports/fixture-counts
//
// PUBLIC, COUNTS-ONLY. The /sports page is unauthenticated and RLS hides the
// fixtures rows from anon, so the live "N upcoming" badges can't be read client-
// side — this route reads them server-side (service role) and returns ONLY
// per-sport upcoming counts. It deliberately selects just `sport` (never titles,
// dates, locations, signups, or any user data) so nothing but aggregate integers
// can leave. Keyed by the SportSelector tab id (type 'other' → tab 'misc').
//
// `type` now also covers HOUSE events (dinner/tasting/social). This page is the
// public SPORTS page, so those are skipped outright rather than falling into
// 'misc' — a whisky dinner is not an upcoming fixture.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TAB_OF: Record<string, string> = { golf: 'golf', tennis: 'tennis', padel: 'padel', hash: 'hash', other: 'misc' }
const COUNTED = new Set(Object.keys(TAB_OF))

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  const counts: Record<string, number> = {}
  try {
    const sb = svc()
    const { data } = await sb
      .from('fixtures')
      .select('type')                        // counts only — no PII columns selected
      .gte('date', new Date().toISOString()) // upcoming only
    for (const r of (data || []) as { type: string }[]) {
      if (!COUNTED.has(r.type)) continue        // house event — not a sports fixture
      counts[TAB_OF[r.type]] = (counts[TAB_OF[r.type]] || 0) + 1
    }
  } catch {
    // fail soft — the page falls back to its static counts
  }
  return NextResponse.json({ counts })
}
