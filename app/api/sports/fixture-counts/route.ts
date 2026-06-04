import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/sports/fixture-counts
//
// PUBLIC, COUNTS-ONLY. The /sports page is unauthenticated and RLS hides the
// fixtures rows from anon, so the live "N upcoming" badges can't be read client-
// side — this route reads them server-side (service role) and returns ONLY
// per-sport upcoming counts. It deliberately selects just `sport` (never titles,
// dates, locations, signups, or any user data) so nothing but aggregate integers
// can leave. Keyed by the SportSelector tab id (sport 'other' → tab 'misc').

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TAB_OF: Record<string, string> = { golf: 'golf', tennis: 'tennis', padel: 'padel', hash: 'hash', other: 'misc' }

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  const counts: Record<string, number> = {}
  try {
    const sb = svc()
    const { data } = await sb
      .from('fixtures')
      .select('sport')                       // counts only — no PII columns selected
      .gte('date', new Date().toISOString()) // upcoming only
    for (const r of (data || []) as { sport: string }[]) {
      const tab = TAB_OF[r.sport] || 'misc'
      counts[tab] = (counts[tab] || 0) + 1
    }
  } catch {
    // fail soft — the page falls back to its static counts
  }
  return NextResponse.json({ counts })
}
