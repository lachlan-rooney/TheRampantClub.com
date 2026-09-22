import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'
import { getCategories, getCaskBoard, getBlendBoard, getTiers, getCountdown, getCaskCompass } from '@/lib/tet/queries'
import TetGate from '@/components/tet/TetGate'
import TetProgramme from '@/components/tet/TetProgramme'

// THE TẾT PAGE — public site, behind the door (18+ and a password).
//
// Server-rendered on purpose: the gate is checked before a single figure is
// fetched, so a visitor without a pass never receives the programme at all,
// rather than receiving it and being asked politely not to look.
//
// Data comes through the ANON key, exactly as a browser would get it — so if
// the RLS or the grants are wrong, this page is wrong too and we find out here
// instead of in front of a buyer.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tết Đinh Mùi 2027 · The Rampant Club',
  description: 'Corporate gifting and single casks for Tết 2027.',
  // A password-gated commercial page has no business in a search index.
  robots: { index: false, follow: false },
}

export default async function TetPage() {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return <TetGate />

  // NEVER A CACHED BOARD. supabase-js calls fetch, and Next caches fetch — so a
  // server-rendered page will happily serve yesterday's availability. Caught on
  // 18 Sept: four casks had been marked sold and the page still showed them as
  // held. On a board whose whole job is to say what is gone, a stale answer is
  // worse than a slow one.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  )

  // Each is guarded separately: a programme with no casks yet should still show
  // its countdown, and a missing countdown should not take the page down.
  const [categories, casks, blends, tiers, countdown, compass] = await Promise.all([
    getCategories(db).catch(() => []),
    getCaskBoard(db).catch(() => []),
    getBlendBoard(db).catch(() => []),
    getTiers(db).catch(() => []),
    getCountdown(db).catch(() => null),
    // The Compass profile of any cask linked to a tagged whisky — confirmed
    // tags only (supabase/migrations/20260922200000_tet2027_cask_compass.sql).
    // Before that migration runs the function does not exist, and a cask
    // simply has no radar.
    getCaskCompass(db).catch(() => []),
  ])

  return <TetProgramme categories={categories} casks={casks} blends={blends} tiers={tiers} countdown={countdown} compass={compass} />
}
