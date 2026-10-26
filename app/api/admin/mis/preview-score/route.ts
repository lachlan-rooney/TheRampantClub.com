import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// PS(t) FOR A ROW THAT DOES NOT EXIST YET.
//
// The MIS has two places that show a member of staff what a preference WILL
// score once they save it: the slider on the profile page, and the list of
// extracted preferences on the intake page. Both of them used to work the
// score out in the browser, and both had drifted from the view that computes
// the real thing. The profile one dropped the decay term; both hardcoded M = 1.0 with
// a comment saying visits was empty. Visits is not empty any more, and M is
// now 0.8, 0.81 or 1.09 in the live data — never 1.0, for any row.
//
//
// MEASURED: the preview mis-predicted the save on 146 of 159 rows, by up to
// 0.91 points of 5, over-promising on 98 and under-promising on 48. The cause
// is M alone: a preview is always at t = 0, so the decay term is e^0 = 1 on
// both sides and the omitted decay was dead code rather than a live error.
// (An earlier note here said "156 rows, 3.5 points". That compared the preview
// against the row's CURRENT score, which has decayed for up to 190 days - a
// different quantity, and not the preview's error.)
//
// ── WHY A ROUND TRIP RATHER THAN A SHARED TS HELPER ───────────────────────
// Because PS(t) never leaves SQL. A shared TypeScript function would be one
// implementation of the formula in the wrong language, sitting next to the
// authoritative one in the view, free to drift again the moment somebody
// changes a coefficient in only one of them. db/mis_ps_one_implementation.sql
// moved the arithmetic into mis_ps_t() and made the VIEW call it too, so there
// is exactly one copy and this route is one of its two call sites.
//
// The view itself cannot answer: its FROM is the preferences table, so a draft
// nobody has saved has no row to score. That is what mis_preview_ps is for.
//
// ── BATCHED ON PURPOSE ────────────────────────────────────────────────────
// The intake page prices a whole extracted batch at once, so this takes an
// array and the RPC returns one row per draft, in order. The profile page
// sends an array of one, debounced, because a slider fires per pixel.

export const dynamic = 'force-dynamic'

/** One call prices a batch; this stops a typo turning into a thousand-row scan. */
const MAX_DRAFTS = 200

interface Draft {
  s0: number
  confidence: number
  lambda: number
  frequency: number
  /** What the row's validation_count will BE after the save, not what it is now. */
  validation_count?: number
  /** Defaults to 0: a save refreshes last_validated, so a preview is at t=0. */
  days_since?: number
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const memberNo = typeof body?.member_no === 'string' ? body.member_no.trim() : ''
  if (!memberNo) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const raw: unknown[] = Array.isArray(body?.drafts) ? body.drafts : []
  if (raw.length === 0) return NextResponse.json({ scores: [] })
  if (raw.length > MAX_DRAFTS) {
    return NextResponse.json({ error: `at most ${MAX_DRAFTS} drafts per call` }, { status: 400 })
  }

  // The four model inputs are required and must be numbers. A null that
  // reached the RPC would come back as a null score, and a preview showing
  // blank where it should show a number is the kind of thing nobody reports.
  const drafts: Draft[] = []
  for (const [i, d] of raw.entries()) {
    const r = d as Record<string, unknown>
    const s0 = num(r?.s0), c = num(r?.confidence), l = num(r?.lambda), f = num(r?.frequency)
    if (s0 === null || c === null || l === null || f === null) {
      return NextResponse.json({ error: `draft ${i}: s0, confidence, lambda and frequency are all required` }, { status: 400 })
    }
    const vc = num(r?.validation_count)
    const ds = num(r?.days_since)
    drafts.push({
      s0, confidence: c, lambda: l, frequency: f,
      validation_count: vc === null ? 1 : Math.max(1, Math.round(vc)),
      days_since: ds === null ? 0 : Math.max(0, ds),
    })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await sb.rpc('mis_preview_ps', {
    p_member_no: memberNo,
    p_drafts: drafts,
  })

  if (error) {
    // Most likely cause on a fresh environment: the migration has not been
    // run. Say so, rather than letting the page render a silent dash.
    return NextResponse.json(
      { error: error.message, hint: 'Has db/mis_ps_one_implementation.sql been run?' },
      { status: 500 },
    )
  }

  return NextResponse.json({ scores: data || [] })
}
