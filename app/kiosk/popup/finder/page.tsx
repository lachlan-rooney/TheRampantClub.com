import { createClient } from '@supabase/supabase-js'
import OfflineFinderClient from './client'
import type { Cat } from '@/components/whisky/flavour-data'
import type { IndexRow } from '@/lib/whisky/flavour-match'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// THE FLAVOUR FINDER AT THE POP-UP — answers with no connection.
// ───────────────────────────────────────────────────────────────────────────
// The tablets inside Independence Palace run on a pocket router that will drop
// at some point in three hours. A finder that stops answering when it does is
// a finder that stops answering in front of a guest.
//
// So EVERYTHING IS DELIVERED WITH THE PAGE: the bottles on the table, their
// confirmed flavour spokes, and the sixteen flavour categories. After the
// first load the tablet makes no request to answer anybody — the matching runs
// on the device, through the same scorer the club's finder uses.
//
// ══ WHY THIS PAGE IS CACHED WHEN NOTHING ELSE UNDER /kiosk IS ════════════
// public/sw.js refuses to cache anything under /kiosk, because the room
// tablets are shared and anything stored outlives the member who put it there.
// THAT RULE STILL STANDS FOR EVERY OTHER KIOSK PAGE.
//
// This one is exempt, and it is exempt on its merits, not for convenience:
//   · it carries NO member data — no names, no numbers, no sessions;
//   · it carries NO guest data, and records none: nothing is typed into it,
//     nothing is stored, nothing is queued. The club's own finder logs no
//     searches either (there is no searches table anywhere), and the pop-up
//     records nothing the club does not;
//   · what it does carry is a list of whiskies and their flavour spokes —
//     which is printed on the table it is standing next to.
//
// The exemption in sw.js names this exact path and nothing wider.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

export default async function PopupFinderPage() {
  const a = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } })

  const { data: ev } = await a.from('popup_events')
    .select('finder_whisky_ids, title_en, title_vn').eq('slug', SLUG).maybeSingle()
  const ids = ((ev?.finder_whisky_ids || []) as string[])

  // ── THE INDEX, BUILT EXACTLY AS THE ROUTE BUILDS IT ───────────────────
  // Same shape, same dedupe-by-name, same spokes. The only difference is the
  // WHERE: this one is limited to the bottles the owner put on the table.
  let index: IndexRow[] = []
  if (ids.length) {
    const [{ data: ints }, { data: ws }] = await Promise.all([
      a.from('whisky_flavour_intensities')
        .select('whisky_id, category_slug, intensity, confirmed').in('whisky_id', ids),
      a.from('whiskies').select('id, name, in_stock, distillery, region, age, abv').in('id', ids),
    ])
    const meta = new Map((ws || []).map(w => [w.id, w]))
    const byW = new Map<string, Record<string, number>>()
    for (const r of (ints || []) as { whisky_id: string; category_slug: string; intensity: number; confirmed: boolean }[]) {
      // ⚠ UNCONFIRMED SPOKES ARE NOT SHIPPED. The admin refuses to save a
      // bottle without a confirmed profile, so this should never fire — but a
      // profile can be un-confirmed in the library after the list was saved,
      // and a tablet at the Palace must not recommend on a guess.
      if (!r.confirmed) continue
      const s = byW.get(r.whisky_id) || {}
      s[r.category_slug] = r.intensity
      byW.set(r.whisky_id, s)
    }
    const seen = new Set<string>()
    for (const id of ids) {                       // the owner's order, kept
      const m = meta.get(id); const spokes = byW.get(id)
      if (!m || !spokes || seen.has(m.name)) continue
      seen.add(m.name)
      index.push({ id, name: m.name, in_stock: m.in_stock, spokes })
    }
  }

  // ⚠ THE SAME QUERY AS /api/whisky/categories, down to the quadrant filter.
  // The wheel's sixteen families and their order ARE this query; a different
  // one here would be a different wheel, and the parity check would compare
  // two finders that were never asked the same question.
  const { data: cats } = await a.from('flavour_categories')
    .select('slug,name,sort_order').not('quadrant', 'is', null).order('sort_order')

  return (
    <OfflineFinderClient
      index={index}
      cats={(cats || []) as Cat[]}
      title={ev?.title_en || 'The Rampant Club'}
      builtAt={new Date().toISOString()}
    />
  )
}
