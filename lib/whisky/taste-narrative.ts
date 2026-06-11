// Turn a member's raw taste vector + loved distilleries into a warm, club-voice
// sentence — NEVER raw scores or parameter names. Honest: the phrases come from
// the member's actual dominant flavour families and real loved distilleries.

import type { ShapeValues } from '@/components/whisky/flavour-data'

// The 13 SMWS families → a descriptive phrase the club would speak.
const FAMILY_PHRASE: Record<string, string> = {
  young_spritely:      'bright, youthful drams',
  sweet_fruity_mellow: 'sweet, mellow orchard fruit',
  spicy_sweet:         'warm baking spice',
  spicy_dry:           'dry, peppery spice',
  rich_dried_fruits:   'rich, sherried dried-fruit depth',
  old_dignified:       'old, dignified complexity',
  light_delicate:      'light, delicate styles',
  juicy_oak_vanilla:   'juicy oak and vanilla',
  oily_coastal:        'an oily, coastal brine',
  lightly_peated:      'a gentle wisp of peat',
  peated:              'smoky, peated whisky',
  heavily_peated:      'bold, heavy smoke',
  grain_rye:           'crisp grain and rye',
}

export interface TasteVector { [slug: string]: number }
export interface TasteSources { loved_distilleries?: string[]; loved_bottles?: string[]; consumption_rows?: number; noted_count?: number; noted_families?: string[] }

// Join a list with Oxford-ish "a, b and c".
function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// A member-facing palate narrative. Returns '' when there's nothing to say
// (caller shows the honest empty state instead).
export function buildTasteNarrative(vector: TasteVector, sources: TasteSources): string {
  const top = Object.entries(vector || {})
    .filter(([slug, v]) => v > 0 && FAMILY_PHRASE[slug])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => FAMILY_PHRASE[slug])
  // Dedup distilleries case-insensitively (the source can carry e.g. both
  // 'GlenAllachie' and 'GLENALLACHIE'); keep the first, nicest-cased occurrence.
  const seen = new Set<string>()
  const distilleries = (sources?.loved_distilleries || []).filter(d => {
    if (!d) return false
    const k = d.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  if (top.length === 0 && distilleries.length === 0) return ''

  let s = top.length ? `You lean toward ${joinNatural(top)}` : 'Your palate is still taking shape'
  if (distilleries.length) {
    s += ` — with a particular love of ${joinNatural(distilleries.slice(0, 3))}`
  }
  return s + '.'
}

// Member taste vector → RadarChart ShapeValues (confidence 1; it's a picture of
// the shape, not a parameter readout).
export function vectorToShape(vector: TasteVector): ShapeValues {
  return Object.fromEntries(
    Object.entries(vector || {}).map(([slug, intensity]) => [slug, { intensity, confidence: 1 }])
  )
}
