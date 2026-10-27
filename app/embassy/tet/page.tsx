import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'
import { getCaskBoard } from '@/lib/tet/queries'
import TetGate from '@/components/tet/TetGate'
import EmbassyCasks from '@/components/embassy/EmbassyCasks'
import { EMBASSY_CASKS } from '@/components/embassy/EmbassyBrand'

// THE SPIRITS EMBASSY · TẾT 2027 — ten casks, Embassy blue, on a tablet.
//
// Built 2026-10-27 for an event the same evening. The club's own /tet is
// untouched: this page shares the data layer and nothing else, so a mistake
// here cannot reach it.
//
// Server-rendered and gated before a single figure is fetched, exactly like
// /tet — a visitor without a pass never receives the board at all. It reuses
// THE SAME Tết pass: staff enter the password once on the tablet and the
// signed httpOnly cookie lasts 30 days, which is the behaviour you want on a
// device standing on a table all evening. No second password to brief anyone
// on, and no new gate code written on the day of an event.
//
// Data comes through the ANON key, as a browser would get it, so wrong RLS or
// grants surface here rather than in front of a buyer.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tết Đinh Mùi 2027 · The Spirits Embassy',
  description: 'Single casks from Duncan Taylor for Tết 2027.',
  // A password-gated commercial page has no business in a search index.
  robots: { index: false, follow: false },
}

export default async function EmbassyTetPage() {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return <TetGate />

  // NEVER A CACHED BOARD. supabase-js calls fetch and Next caches fetch, so a
  // server-rendered page will happily serve yesterday's availability. On a
  // board whose job is to say what is gone, a stale answer is worse than a
  // slow one — and tonight it would be said out loud to a buyer.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  )

  const board = await getCaskBoard(db).catch(() => [])

  // TEN OF THE TWENTY, IN THE OWNER'S ORDER.
  //
  // Filtered by an explicit allow-list rather than by anything derived: the
  // Embassy offer is a commercial decision, not a property of a cask, so
  // nothing about a cask row should be able to add one to this page. A ref on
  // the list that is not on the board is dropped silently here and reported by
  // scripts/verify-embassy-tet.mjs — a page that renders nine casks is better
  // at an event than a page that throws, but nobody should learn about the
  // tenth from a guest.
  const byRef = new Map(board.map(c => [c.cask_ref, c]))
  const casks = EMBASSY_CASKS.map(ref => byRef.get(ref)).filter((c): c is NonNullable<typeof c> => !!c)

  return <EmbassyCasks casks={casks} />
}
