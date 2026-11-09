import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// /studio/guide — THE ADDRESS THE PRINTED QR CARRIES.
//
// ── WHY THIS EXISTS RATHER THAN PRINTING THE SLUG ─────────────────────────
// A booklet is printed once and sits in the room; the exhibition changes every
// quarter. A QR pointing at /studio/rizal-fathoni/guide is correct today and
// wrong in February, and the booklet cannot be recalled from a side table. So
// the printed code points HERE, and here resolves to whichever exhibition is
// currently live. One printed asset survives the next hang.
//
// The per-exhibition permalink still exists at /studio/<slug>/guide for
// linking, sharing and anything dated.
//
// NOT CACHED. A redirect that is cached for five minutes is a guest standing in
// the new exhibition reading the old one's guide. The query is one indexed row.
export const dynamic = 'force-dynamic'

export default async function CurrentGuide() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: live } = await sb.from('collaborations')
    .select('slug').eq('status', 'live').order('sort').limit(1).maybeSingle()

  // Nothing hanging: send them to the Studio page rather than a dead end. It
  // tells them what the room is and what has been in it, which is the honest
  // answer to "I scanned a code and there is no exhibition".
  redirect(live?.slug ? `/studio/${live.slug}/guide` : '/studio')
}
