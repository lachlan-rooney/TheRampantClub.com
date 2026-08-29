// Turn a member's raw taste vector + loved distilleries into a warm, club-voice
// sentence — NEVER raw scores or parameter names. Honest: the phrases come from
// the member's actual dominant flavour families and real loved distilleries.

import type { ShapeValues } from '@/components/whisky/flavour-data'

// The 16 Compass families → a descriptive phrase the club would speak.
const FAMILY_PHRASE: Record<string, string> = {
  cereal_biscuit:       'malty, cereal-led drams',
  green_grassy:         'fresh, green and grassy notes',
  orchard_fruit:        'sweet, mellow orchard fruit',
  tropical_citrus:      'bright tropical fruit and citrus',
  floral_honeyed:       'a floral, honeyed lift',
  buttery_creamy:       'a buttery, creamy texture',
  meaty_sulphury:       'savoury, meaty depth',
  vanilla_coconut:      'juicy vanilla and coconut',
  baking_spice:         'warm baking spice',
  pepper_tannin:        'dry, peppery tannin',
  dried_fruit_walnut:   'rich, sherried dried-fruit depth',
  treacle_roast:        'treacle, coffee and roast',
  leather_polished_oak: 'old, dignified oak and leather',
  woodsmoke:            'wood-smoke and embers',
  tar_iodine:           'bold, medicinal peat',
  brine_shoreline:      'an oily, coastal brine',
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
