// A member's palate in two words — the discreet "signature" shown in the directory
// and on an introduction. Top families from the taste vector, in short adjectives.
// Returns a gentle placeholder when the palate is still taking shape (never empty).

const SHORT: Record<string, string> = {
  cereal_biscuit: 'malty', green_grassy: 'grassy', orchard_fruit: 'orchard-sweet',
  tropical_citrus: 'tropical', floral_honeyed: 'honeyed', buttery_creamy: 'creamy',
  meaty_sulphury: 'savoury', vanilla_coconut: 'vanilla-rich', baking_spice: 'spiced',
  pepper_tannin: 'peppery', dried_fruit_walnut: 'sherried', treacle_roast: 'rich & roasted',
  leather_polished_oak: 'old & deep', woodsmoke: 'smoky', tar_iodine: 'peated', brine_shoreline: 'coastal',
}

export function paletteSignature(vector: Record<string, number> | null | undefined): string {
  const top = Object.entries(vector || {})
    .filter(([slug, v]) => v > 0 && SHORT[slug])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([slug]) => SHORT[slug])
  return top.length ? top.join(', ') : 'still taking shape'
}
