// Flavour Finder — pure nearest-neighbour match over the mapped whiskies'
// flavour spokes. No LLM, no API cost: distance is computed ONLY over the
// spokes the member SET (raised above 0); unset spokes are "don't care" and
// excluded from the calc. Distance is the ROOT-MEAN-SQUARE per-spoke difference
// (normalised by set-spoke count, so 1 vs 5 spokes are comparable). RMS (not
// mean-absolute) so a single BIG miss — e.g. the member asked for heavy peat
// and the whisky has none — is penalised harder than several small misses;
// mean-absolute let opposite whiskies collide on the same total and tie.

export type SetSpokes = Record<string, number>            // slug -> level 1..4 (only set spokes)
export interface IndexRow { id: string; name: string; in_stock?: boolean; spokes: Record<string, number> } // slug -> intensity 1..4

export type Strength = 'strong' | 'good' | 'loose' | 'distant'
export interface Match {
  id: string; name: string; in_stock?: boolean
  spokes: Record<string, number>
  distance: number; pct: number; strength: Strength
}

export const STRENGTH_LABEL: Record<Strength, string> = {
  strong: 'Strong match', good: 'Good match', loose: 'Loose match', distant: 'Distant — nearest we have',
}

// Buckets calibrated to the RMS distribution (0-4 scale): a near-perfect match
// (every set spoke within ~1 level) reads strong; an eclectic profile's best
// realistic fit reads good; a whisky that misses a requested headline flavour
// drops to loose; nothing-really-fits reads distant.
function strengthOf(distance: number): Strength {
  return distance <= 1.0 ? 'strong' : distance <= 1.5 ? 'good' : distance <= 2.5 ? 'loose' : 'distant'
}

export function matchWhiskies(set: SetSpokes, index: IndexRow[], topN = 3): { matches: Match[]; bestIsClose: boolean } {
  const slugs = Object.keys(set).filter(s => (set[s] || 0) > 0)
  if (slugs.length === 0) return { matches: [], bestIsClose: false }

  const scored = index.map(w => {
    let sq = 0
    for (const s of slugs) { const d = set[s] - (w.spokes[s] || 0); sq += d * d }  // unset whisky spoke = 0
    return { w, distance: Math.sqrt(sq / slugs.length) }                           // RMS over SET spokes only
  }).sort((a, b) => a.distance - b.distance)

  const matches = scored.slice(0, topN).map(({ w, distance }) => ({
    id: w.id, name: w.name, in_stock: w.in_stock, spokes: w.spokes,
    distance: Math.round(distance * 100) / 100,
    pct: Math.max(0, Math.round((1 - distance / 4) * 1000) / 10),     // 1-decimal closeness (0 diff = 100, 4 = 0)
    strength: strengthOf(distance),
  }))
  // Honest: "close" only if the BEST match is genuinely near (avg < 1.5 levels off).
  const bestIsClose = matches.length > 0 && matches[0].distance <= 1.5
  return { matches, bestIsClose }
}
