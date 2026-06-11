// A member's palate in two words — the discreet "signature" shown in the directory
// and on an introduction. Top families from the taste vector, in short adjectives.
// Returns a gentle placeholder when the palate is still taking shape (never empty).

const SHORT: Record<string, string> = {
  young_spritely: 'bright', sweet_fruity_mellow: 'orchard-sweet', spicy_sweet: 'spiced',
  spicy_dry: 'peppery', rich_dried_fruits: 'sherried', old_dignified: 'old & deep',
  light_delicate: 'delicate', juicy_oak_vanilla: 'oaky-vanilla', oily_coastal: 'coastal',
  lightly_peated: 'lightly peated', peated: 'peated', heavily_peated: 'heavily peated', grain_rye: 'grainy',
}

export function paletteSignature(vector: Record<string, number> | null | undefined): string {
  const top = Object.entries(vector || {})
    .filter(([slug, v]) => v > 0 && SHORT[slug])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([slug]) => SHORT[slug])
  return top.length ? top.join(', ') : 'still taking shape'
}
