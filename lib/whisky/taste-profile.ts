// Per-member taste profile derivation — composes a 13-spoke flavour vector from
// PLUGGABLE sources, so the engine reads one stored profile and new sources
// thicken it over time without a rewrite.
//
// SOURCE 1 (today): mapped LOVED BOTTLES — a member's MIS whisky prefs that name
//   a distillery present + flavour-mapped in the catalogue. STRICT distillery-
//   token match (a loose token match fabricates loves: "Black Americano" is not
//   "Black Bull"). Trait-text prefs ("Seeks Bold Flavours") name no distillery →
//   correctly contribute nothing.
// SOURCE 2 (seam, empty today): CONSUMPTION — whiskies the member actually
//   finished, passed as weighted contributors. Wired when the Harmony Log feeds
//   member_consumption; until then it's [] and changes nothing.
// SOURCE 3 (future): explicit ratings/favourites — same contributor shape.
//
// If no source yields a bottle, the profile is honestly EMPTY (vector {}) — the
// engine then needs an EXPRESSED shape (a Finder tap), never an invented taste.

export interface MappedWhisky { id: string; name: string; distillery: string | null; spokes: Record<string, number> }
export interface Contributor { whisky_id: string; weight: number }   // SOURCE 2/3 seam
export interface DerivedProfile {
  vector: Record<string, number>
  sources: { loved_distilleries: string[]; loved_bottles: string[]; consumption_rows: number }
  source_count: number
}

// Words that are NOT distinctive distillery identifiers (serving style, drinks,
// descriptors, cask/age boilerplate). A pref token must be ≥5 chars AND not here.
const STOP = new Set([
  'single', 'malt', 'scotch', 'whisky', 'whiskey', 'blended', 'grain', 'cask', 'casks', 'finish', 'finished',
  'bourbon', 'sherry', 'oloroso', 'port', 'wine', 'reserve', 'batch', 'strength', 'vintage', 'edition', 'release',
  'years', 'year', 'distillers', 'matured', 'double', 'peated', 'peaty', 'smoky', 'maritime', 'classic', 'comfort',
  'preference', 'preferred', 'default', 'current', 'always', 'often', 'never', 'occasional', 'exploration', 'exploratory',
  'black', 'white', 'green', 'red', 'coffee', 'water', 'sparkling', 'still', 'negroni', 'martini', 'americano',
  'espresso', 'brandy', 'cognac', 'rum', 'burgundy', 'unique', 'flavours', 'flavour', 'bold', 'delicate', 'japanese',
  'global', 'devotee', 'comfort', 'unusual', 'origins', 'finishes', 'interest', 'islands', 'islay', 'speyside',
  'highland', 'lowland', 'campbeltown', 'fashioned', 'kingston', 'passion', 'learning', 'elements', 'morning',
])
const toks = (s: string | null | undefined): string[] => (s || '').toLowerCase().match(/[a-z0-9]+/g) || []
const distinctive = (t: string): boolean => t.length >= 5 && !STOP.has(t)

export function deriveTasteVector(
  prefNames: string[],
  mapped: MappedWhisky[],
  categories: string[],
  consumption: Contributor[] = [],          // SOURCE 2 — empty today
): DerivedProfile {
  // Distinctive distillery tokens the member's prefs mention.
  const prefToks = new Set<string>()
  for (const p of prefNames) for (const t of toks(p)) if (distinctive(t)) prefToks.add(t)

  // SOURCE 1: mapped whiskies whose DISTILLERY shares a distinctive token.
  const loved = mapped.filter(w => toks(w.distillery).some(t => prefToks.has(t)))

  // Combine contributors: loved bottles (weight 1) + consumption (its weights).
  const byId = new Map(mapped.map(w => [w.id, w]))
  const contributors: { w: MappedWhisky; weight: number }[] = [
    ...loved.map(w => ({ w, weight: 1 })),
    ...consumption.map(c => ({ w: byId.get(c.whisky_id)!, weight: c.weight })).filter(x => x.w),
  ]

  const vector: Record<string, number> = {}
  if (contributors.length) {
    const totalW = contributors.reduce((s, c) => s + c.weight, 0)
    for (const cat of categories) {
      const sum = contributors.reduce((s, c) => s + (c.w.spokes[cat] || 0) * c.weight, 0)
      const v = sum / totalW
      if (v > 0) vector[cat] = Math.round(v * 100) / 100
    }
  }

  return {
    vector,
    sources: {
      loved_distilleries: [...new Set(loved.map(w => w.distillery).filter(Boolean) as string[])],
      loved_bottles: loved.map(w => w.name),
      consumption_rows: consumption.length,
    },
    source_count: loved.length + consumption.length,
  }
}
