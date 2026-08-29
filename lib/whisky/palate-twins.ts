// Palate-twin similarity — member↔member, over the flavour-family taste vectors
// (member_taste_profiles). Cosine similarity (bounded 0–1 → an intuitive %); the
// existing flavour-match RMS is whisky↔taste set-distance, a different shape. Only
// the % + a FAMILY-level shared-note ever leave the server — never a vector.

// Tunable config (not hardcoded at call sites): only matches at/above this surface.
export const PALATE_TWIN_THRESHOLD = 0.70

type Vec = Record<string, number>

export function cosineSimilarity(a: Vec, b: Vec): number {
  const fams = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  let dot = 0, na = 0, nb = 0
  for (const f of fams) { const x = a[f] || 0, y = b[f] || 0; dot += x * y; na += x * x; nb += y * y }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// A FAMILY-level hook from the families BOTH score in — never a specific bottle.
const SHARED_PHRASE: Record<string, string> = {
  dried_fruit_walnut: 'sherried, dried-fruit drams', tar_iodine: 'big, medicinal peat', woodsmoke: 'wood-smoke',
  brine_shoreline: 'oily, coastal styles', baking_spice: 'warm baking spice', pepper_tannin: 'dry, peppery spice',
  orchard_fruit: 'mellow orchard fruit', tropical_citrus: 'bright tropical fruit', floral_honeyed: 'floral, honeyed drams',
  vanilla_coconut: 'juicy oak & vanilla', buttery_creamy: 'buttery, creamy textures', treacle_roast: 'treacle & roast',
  leather_polished_oak: 'old, dignified malts', cereal_biscuit: 'malty, cereal notes', green_grassy: 'fresh, grassy styles',
  meaty_sulphury: 'savoury, meaty notes',
}

export function sharedNote(a: Vec, b: Vec): string {
  const shared = Object.keys(a || {})
    .filter(f => (a[f] || 0) > 0 && (b[f] || 0) > 0 && SHARED_PHRASE[f])
    .sort((x, y) => ((a[y] || 0) + (b[y] || 0)) - ((a[x] || 0) + (b[x] || 0)))
  if (!shared.length) return 'a shared turn of palate'
  if (shared.length === 1) return `a shared love of ${SHARED_PHRASE[shared[0]]}`
  return `a shared love of ${SHARED_PHRASE[shared[0]]} and ${SHARED_PHRASE[shared[1]]}`
}

export const pct = (cos: number) => Math.round(cos * 100)
