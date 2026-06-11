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
  rich_dried_fruits: 'sherried, dried-fruit drams', peated: 'peated whisky', heavily_peated: 'big, smoky drams',
  lightly_peated: 'a gentle wisp of peat', oily_coastal: 'oily, coastal styles', spicy_sweet: 'warm baking spice',
  spicy_dry: 'dry, peppery spice', sweet_fruity_mellow: 'mellow orchard fruit', juicy_oak_vanilla: 'juicy oak & vanilla',
  old_dignified: 'old, dignified malts', light_delicate: 'light, delicate styles', young_spritely: 'bright, youthful drams',
  grain_rye: 'crisp grain & rye',
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
