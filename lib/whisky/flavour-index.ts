import type { SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// READING THE FLAVOUR INDEX — the whole of it.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ THIS EXISTS BECAUSE THREE SEPARATE PLACES READ THIS TABLE WITH A PLAIN
// SELECT, AND ALL THREE WERE SILENTLY LOSING A THIRD OF IT.
//
// PostgREST caps a select at 1000 rows. On 12 November 2026 there were 1,582
// intensity rows across 296 whiskies, so every one of these reads saw 1000
// rows and about 208 bottles:
//
//   · /api/whisky/flavour-match   the members', public and kiosk finders
//   · /api/whisky/recommend       the member recommendation engine
//   · lib/whisky/derive-taste     the derived taste profile
//
// Eighty-eight bottles could never be recommended by anything. Worse, a bottle
// whose rows straddled the cut-off was scored on PART of its profile — which
// changes its distance without changing anything visible. No error, no warning,
// no empty screen: just quietly wrong answers, since whenever the catalogue
// passed a thousand rows.
//
// It is one function now so the next caller cannot reintroduce it, and so a
// fix is made once rather than three times and missed somewhere.
//
// ⚠ ORDERED, because paging without an ORDER BY is not stable: the database is
// free to return rows in any order it likes, and a row can be repeated or
// skipped between pages. It happens not to today. It is not a thing to leave
// to luck in the code that decides what a member is offered.
// ═══════════════════════════════════════════════════════════════════════════

export interface IntensityRow {
  whisky_id: string
  category_slug: string
  intensity: number
}

const PAGE = 1000

export async function readAllIntensities(sb: SupabaseClient): Promise<IntensityRow[]> {
  const out: IntensityRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('whisky_flavour_intensities')
      .select('whisky_id,category_slug,intensity')
      .order('whisky_id').order('category_slug')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`flavour index: ${error.message}`)
    out.push(...((data || []) as IntensityRow[]))
    if (!data || data.length < PAGE) break
    // A table that somehow never stops is a bug worth stopping on rather than
    // a loop that runs until the function times out.
    if (out.length > 200_000) throw new Error('flavour index: refusing to read past 200,000 rows')
  }
  return out
}

/** whisky_id → { category_slug: intensity }, the shape every caller wants. */
export function spokesByWhisky(rows: IntensityRow[]): Record<string, Record<string, number>> {
  const by: Record<string, Record<string, number>> = {}
  for (const r of rows) (by[r.whisky_id] = by[r.whisky_id] || {})[r.category_slug] = r.intensity
  return by
}
