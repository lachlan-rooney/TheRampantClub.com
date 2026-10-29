import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'
import { deviceOk } from '@/lib/kiosk/server'
import { getCategories, getCaskBoard, getBlendBoard, getTiers, getCountdown, getCaskCompass } from '@/lib/tet/queries'
import TetGate from '@/components/embassy/tet/TetGate'
import EmbassyTabs from '@/components/embassy/EmbassyTabs'
import { EMBASSY_CASKS } from '@/components/embassy/casks'

// THE SPIRITS EMBASSY · TẾT 2027 — the club's page, in the Embassy's colours.
//
// A copy of app/tet/page.tsx, line for line, with two differences: it renders
// the forked components in components/embassy/tet (navy #151d2a, gold
// #d2b37f, Embassy lockup), and the cask board is cut to the ten the Embassy
// offers. Everything else — the gate, the no-store client, the per-query
// guards, the noindex — is the club page's behaviour and is meant to stay
// that way.
//
// Server-rendered on purpose: the gate is checked before a single figure is
// fetched, so a visitor without a pass never receives the programme at all,
// rather than receiving it and being asked politely not to look.
//
// Data comes through the ANON key, exactly as a browser would get it — so if
// the RLS or the grants are wrong, this page is wrong too and we find out here
// instead of in front of a buyer.

export const dynamic = 'force-dynamic'

// THE TABLET'S OWN CHROME. The root layout sets theme-color to the club's
// #052E20, which tints the browser bar on Android and the status area when a
// kiosk runs full-screen — so an Embassy page was framed in club green. Route
// metadata overrides it; the club's pages are unaffected.
export const viewport = { themeColor: '#151d2a' }

export const metadata: Metadata = {
  title: 'Tết Đinh Mùi 2027 · The Spirits Embassy',
  description: 'Corporate gifting and single casks for Tết 2027.',
  // A password-gated commercial page has no business in a search index.
  robots: { index: false, follow: false },
}

export default async function EmbassyTetPage() {
  // TWO WAYS IN, AND A PAIRED KIOSK NEEDS NEITHER A PASSWORD NOR A PERSON.
  //
  // The club runs a real kiosk estate: tablets enrolled through
  // /api/kiosk/pair, carrying an httpOnly device token that kiosk_device_active
  // re-checks on every request and that an admin can revoke. Those devices are
  // the point of the system — nobody should be typing a shared password into
  // one in front of guests, and a password is the weaker proof anyway: it can
  // be read over a shoulder, and it cannot be revoked for one tablet.
  //
  // So an enrolled kiosk opens this page because of WHAT IT IS. Everyone else
  // — a laptop, a phone, a buyer following a link — still meets the Tết door.
  // ── THE DOOR IS OFF ──────────────────────────────────────────────────────
  // Owner's explicit instruction during the launch event, 2026-10-27:
  // "disable it now". The gate was unusable on the shop iPad — the password
  // field would not keep what was typed and the Enter button never enabled —
  // and staff were standing in front of guests with no way in.
  //
  // ⚠ /embassy/tet IS NOW OPEN TO ANYONE WITH THE LINK.
  //
  // What that does and does not expose: the page is noindex, and the board
  // carries no cost or margin at all (lib/tet/types) — only Duncan Taylor
  // Vietnam's own list prices, which are quoted to buyers anyway. The mailing
  // list behind it is NOT affected: /api/embassy/signup keeps its own check.
  //
  // TO PUT IT BACK, restore these two lines:
  //   const pass = (await cookies()).get(TET_COOKIE)?.value
  //   if (!tetPassValid(pass) && !(await deviceOk())) return <TetGate />
  //
  // The club's own /tet is untouched and still gated.
  void TET_COOKIE; void tetPassValid; void deviceOk; void TetGate; void cookies

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
  const [categories, allCasks, blends, tiers, countdown, compass] = await Promise.all([
    getCategories(db).catch(() => []),
    getCaskBoard(db).catch(() => []),
    getBlendBoard(db).catch(() => []),
    getTiers(db).catch(() => []),
    getCountdown(db).catch(() => null),
    getCaskCompass(db).catch(() => []),
  ])

  // TEN OF THE TWENTY, IN THE OWNER'S ORDER.
  //
  // An explicit allow-list, not anything derived: which casks the Embassy
  // offers is a commercial decision, not a property of a cask, so nothing
  // about a cask row should be able to add one to this page. A ref on the list
  // that is not on the board is dropped here and reported by
  // scripts/verify-embassy-tet.mjs — nine casks at an event beats a page that
  // throws, but nobody should learn about the tenth from a guest.
  const byRef = new Map(allCasks.map(c => [c.cask_ref, c]))
  const casks = EMBASSY_CASKS.map(ref => byRef.get(ref)).filter((c): c is NonNullable<typeof c> => !!c)

  // The Compass radars follow the casks, or a cask the Embassy does not offer
  // would still have its flavour profile drawn on the page.
  const shown = new Set(casks.map(c => c.cask_ref))
  const compassShown = compass.filter(r => shown.has(r.cask_ref))

  // TWO TABS on the kiosk: the programme, and the mailing list.
  return <EmbassyTabs categories={categories} casks={casks} blends={blends} tiers={tiers} countdown={countdown} compass={compassShown} />
}
