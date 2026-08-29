# The Rampant Club — Whisky Flavour Matching Engine

A complete reference to how the club matches whiskies to palates: the data model,
the algorithms, the actual code, and where to build visualisers / improve. Hand
this whole file to Claude as context.

---

## 1. What it is, in one paragraph

Every whisky is described as a **16-spoke flavour vector** (a radar/spider chart:
each spoke is one flavour *family*, length 1–4 = how intense that family is in the
bottle). Whiskies get their spokes from an **LLM that reads the tasting-notes prose
only** (never the name/region — anti-fabrication). Each **member** gets the *same*
shaped 16-spoke vector, *derived* from what they love/drink/note. Matching is then
pure geometry over these vectors — **no LLM at query time, zero per-search cost**:

- **Flavour Finder** (member expresses a shape by tapping sliders) → **RMS distance**
  to every whisky → nearest bottles.
- **Recommendations** (member's *stored* taste vector) → same RMS ranking, then a
  **stock-aware, delight-first** re-order.
- **Palate twins** (member ↔ member) → **cosine similarity** between taste vectors.
- **Signature / narrative** → the top families rendered as short human phrases.

The design principle throughout: **honesty over padding** — an empty radar is a
valid answer, match strength is reported truthfully ("distant — nearest we have"),
and taste is never invented from a name.

---

## 2. The taxonomy — the Flavour Compass (16 families, 4 quadrants)

The single source of truth is the `TAXONOMY` constant in
`scripts/whisky-flavour-tags.mjs`. Two tiers: broad **families** (the radar spokes)
and finer **descriptors** under each. The families group into four production-origin
**quadrants** — `field` → `still` → `cask` → `shore` — which are *metadata only*,
invisible to the match maths (the radius 0–4 alone is intensity).

| # | slug | quadrant | name | gist |
|---|------|----------|------|------|
| 1 | `cereal_biscuit` | field | Cereal & Biscuit | Malt loaf, biscuit, porridge, rye bread, corn |
| 2 | `green_grassy` | field | Green & Grassy | Cut grass, hay, green apple skin, leafy |
| 3 | `orchard_fruit` | still | Orchard Fruit | Apple, pear, plum, apricot |
| 4 | `tropical_citrus` | still | Tropical & Citrus | Banana, pineapple, mango, lemon zest |
| 5 | `floral_honeyed` | still | Floral & Honeyed | Heather honey, rose, elderflower, beeswax |
| 6 | `buttery_creamy` | still | Buttery & Creamy | Butter, cream, custard, fudge |
| 7 | `meaty_sulphury` | still | Meaty & Sulphury | Struck match, broth, cooked meat, gunpowder |
| 8 | `vanilla_coconut` | cask | Vanilla & Coconut | Vanilla, coconut, toasted-oak sweetness |
| 9 | `baking_spice` | cask | Baking Spice | Cinnamon, clove, nutmeg, ginger |
| 10 | `pepper_tannin` | cask | Pepper & Tannin | Black pepper, oak tannin, black tea, rye pepper |
| 11 | `dried_fruit_walnut` | cask | Dried Fruit & Walnut | Raisin, fig, date, walnut |
| 12 | `treacle_roast` | cask | Treacle & Roast | Toffee, treacle, coffee, dark chocolate, char |
| 13 | `leather_polished_oak` | cask | Leather & Polished Oak | Old leather, tobacco, waxed wood, dried herbs |
| 14 | `woodsmoke` | shore | Woodsmoke | Bonfire, ash, smoked meat, embers |
| 15 | `tar_iodine` | shore | Tar & Iodine | Tar, iodine, antiseptic, creosote, kippers |
| 16 | `brine_shoreline` | shore | Brine & Shoreline | Sea salt, seaweed, oyster shell, wet stone |

Each family also carries ~3–5 descriptors (e.g. `dried_fruit_walnut` → raisin, fig,
date, walnut). Descriptors are tier-2 detail; **the 16 family intensities are what
all matching runs on.** Note the deliberate **two smokes**: `woodsmoke` (guaiacol —
bonfire/ash/embers) and `tar_iodine` (phenol/cresol — medicinal/TCP); a dram can
score both.

---

## 3. Data model (Postgres / Supabase)

```
flavour_categories            -- the 16 families: slug, name, description, quadrant, sort_order
flavour_descriptors           -- tier-2 notes: slug, category_slug (FK), name
whisky_flavour_intensities    -- THE RADAR SPOKES. one row per (whisky, family):
                              --   intensity 1..4, confidence 0..1, confirmed bool,
                              --   source ('llm'), model, evidence (prose phrase)
whisky_flavour_tags           -- per (whisky, descriptor): confidence, confirmed, evidence
member_taste_profiles         -- per member: vector jsonb {family: 0..4 fractional},
                              --   sources jsonb, source_count, updated_at
```

Key points:
- **`intensity` (1–4)** = how strong/dominant the family is (spoke length).
- **`confidence` (0–1)** = how sure we are it's present (separate axis; used in the
  review queue, not in the match maths).
- **`confirmed`** = machine proposes, human ratifies (an admin review queue at
  `/admin/whisky/flavour-review`, mirroring the MIS preference-candidate pattern).
- A missing `(whisky, family)` row = that spoke is **0** (absent), not unknown.
- `member_taste_profiles.vector` is the **same shape** as a whisky's spokes, so the
  member is literally "a whisky" the engine can compare against.

RLS: everyone authenticated can *read* the taxonomy + whisky spokes (it's catalogue
data); only admins write. A member reads only their *own* `member_taste_profiles`
row.

---

## 4. How a whisky gets its spokes (the tagging step — LLM, offline)

Run by `scripts/whisky-flavour-tags.mjs`. For each whisky it sends the **tasting
notes prose** to Claude with a forced tool-call that returns `{categories[],
descriptors[]}`. The system prompt is the interesting part — it enforces honesty:

```
INTENSITY vs CONFIDENCE — keep them distinct:
  • CONFIDENCE = how SURE you are the flavour is present.
  • INTENSITY  = how STRONG/dominant it is. 1 = faint/a whisper; 2 = clearly present;
    3 = prominent, a major theme; 4 = dominant/intense/defining.

ABSOLUTE RULES:
1. Tag ONLY flavours explicitly present in the TASTING NOTES prose. Every category
   and descriptor needs an "evidence" phrase taken from those notes.
2. NEVER infer flavour or intensity from the name, distillery, region, or age.
   "It's an Islay so probably peaty" is FORBIDDEN — fabricated data.
3. If the notes carry no flavour info, return notes_quality "none" with EMPTY
   categories. A sparse/empty radar is the honest answer — never pad it.
4. Every descriptor's category must also appear in your categories list.
```

The whisky's `name` is passed **"reference only — do NOT tag from this"**. Output is
clamped (intensity → 1..4, confidence → 0..1) and written to
`whisky_flavour_intensities` / `whisky_flavour_tags` with `confirmed=false` for the
human queue. **This is the only LLM in the system, and it runs offline, not per
search.** ~337 bottles tagged today.

---

## 5. How a member gets their taste vector (derivation — the "flywheel")

`lib/whisky/derive-taste.ts` (live) — builds the member's 16-spoke vector as a
**weighted average of contributor whiskies' spokes**. Three sources feed it:

| Source | Weight | How it's found |
|--------|--------|----------------|
| **Loved distilleries** | 1 | Member's stated whisky preferences → distinctive distillery tokens → whiskies whose distillery shares a token (strict, ≥5-char, stop-worded) |
| **Consumption** | 1 | `member_consumption` rows (whiskies actually finished) |
| **Tasting notes** (flywheel) | 2 | The member's own `tasting_notes`; a self-tagged note is a stronger signal, and their explicit `flavour_tags` **floor** those families at 2 |

The vector = `Σ(spoke × weight) / Σ(weight)` per family (fractional 0–4). Logging a
note re-derives on the spot (`rederiveAndPersist`), so the palate thickens as the
member engages. **If no source yields a bottle, the vector is honestly `{}`** — the
engine then requires an *expressed* Finder shape rather than inventing taste.

```ts
// lib/whisky/derive-taste.ts — the core blend (contributors → vector)
const contributors = [...loved.map(w => ({ w, weight: 1 })), ...consumption, ...noteContribs]
const vector: Record<string, number> = {}
if (contributors.length) {
  const totalW = contributors.reduce((s, c) => s + c.weight, 0)
  for (const cat of categories) {
    const sum = contributors.reduce((s, c) => s + (c.w.spokes[cat] || 0) * c.weight, 0)
    const v = sum / totalW
    if (v > 0) vector[cat] = Math.round(v * 100) / 100
  }
}
```

(`lib/whisky/taste-profile.ts` is the pure, source-pluggable version of the same
math; `derive-taste.ts` is the DB-wired one that adds the notes source.)

---

## 6. The match algorithm — Flavour Finder (whisky ↔ expressed shape)

`lib/whisky/flavour-match.ts`. The member raises some sliders (a `set` of
`{family: 1..4}`). Distance is **root-mean-square per-spoke difference over ONLY the
spokes the member set** — unset spokes are "don't care" and excluded. RMS (not
mean-absolute) so one *big* miss (asked for heavy peat, bottle has none) is punished
harder than several small ones.

```ts
// lib/whisky/flavour-match.ts — the whole matcher
export function matchWhiskies(set, index, topN = 3) {
  const slugs = Object.keys(set).filter(s => (set[s] || 0) > 0)
  if (slugs.length === 0) return { matches: [], bestIsClose: false }

  const scored = index.map(w => {
    let sq = 0
    for (const s of slugs) { const d = set[s] - (w.spokes[s] || 0); sq += d * d } // unset whisky spoke = 0
    return { w, distance: Math.sqrt(sq / slugs.length) }                          // RMS over SET spokes only
  }).sort((a, b) => a.distance - b.distance)

  const matches = scored.slice(0, topN).map(({ w, distance }) => ({
    id: w.id, name: w.name, in_stock: w.in_stock, spokes: w.spokes,
    distance: Math.round(distance * 100) / 100,
    pct: Math.max(0, Math.round((1 - distance / 4) * 1000) / 10), // closeness %: 0 diff→100, 4→0
    strength: strengthOf(distance),
  }))
  const bestIsClose = matches.length > 0 && matches[0].distance <= 1.5
  return { matches, bestIsClose }
}

// strength buckets on the 0–4 RMS scale
function strengthOf(distance) {
  return distance <= 1.0 ? 'strong' : distance <= 1.5 ? 'good' : distance <= 2.5 ? 'loose' : 'distant'
}
```

- `distance` ∈ [0,4]; `pct = (1 − distance/4)·100` gives an intuitive closeness %.
- `strength`: ≤1.0 **strong**, ≤1.5 **good**, ≤2.5 **loose**, else **distant — nearest
  we have**.
- `bestIsClose` gates honest copy ("we've got you" vs "nothing really fits, but…").

Wired at `POST /api/whisky/flavour-match` (`{ set }` → top-3 mapped whiskies).

---

## 7. Recommendations — taste vector ↔ catalogue, stock-aware

`lib/whisky/recommend.ts`. Reuses the Finder's RMS to rank **all** mapped whiskies
against the member's stored vector, then re-orders **delight-first**: match quality
buckets always win; only *within a near-equal bucket* (RMS within `0.15`) does
**known** higher stock tie-break. Never tie-breaks on unknown ("fictional") stock.

```ts
// lib/whisky/recommend.ts
const NEAR_EQUAL = 0.15
withStock.sort((a, b) => {
  const ba = Math.round(a.distance / NEAR_EQUAL), bb = Math.round(b.distance / NEAR_EQUAL)
  if (ba !== bb) return ba - bb                       // better match bucket ALWAYS first
  const sa = a.stock_known ? (a.fill_pct ?? 0) : -1   // within bucket: prefer KNOWN higher stock
  const sb = b.stock_known ? (b.fill_pct ?? 0) : -1   // unknown stock = neutral
  if (sa !== sb) return sb - sa
  return a.distance - b.distance
})
```

Wired at `POST /api/whisky/recommend` — three modes: `{member_no}` (staff, admin
only), `{set}` (ad-hoc expressed shape), `{}` (the caller's own profile). Returns
`profileEmpty:true` when there's no data, so the surface asks for a Finder tap
instead of inventing recs.

---

## 8. Palate twins — member ↔ member (cosine)

`lib/whisky/palate-twins.ts`. Whisky↔taste uses *distance* over a set; member↔member
uses **cosine similarity** over the full vectors (bounded 0–1 → clean %). Threshold
`0.70`. **Privacy: only the % and a family-level shared phrase ever leave the server
— never a raw vector or a specific bottle.**

```ts
export const PALATE_TWIN_THRESHOLD = 0.70
export function cosineSimilarity(a, b) {
  const fams = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  let dot = 0, na = 0, nb = 0
  for (const f of fams) { const x = a[f] || 0, y = b[f] || 0; dot += x*y; na += x*x; nb += y*y }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
// sharedNote(a,b) → e.g. "a shared love of sherried, dried-fruit drams and peated whisky"
```

Why cosine here and RMS there: cosine rewards *same shape/direction* of palate
regardless of overall intensity (two people who both lean sherried+peated are twins
even if one rates everything higher); RMS rewards *absolute closeness* to a target
(you want a bottle that actually hits the levels you asked for).

---

## 9. Signature & narrative (human-facing renders)

- `lib/whisky/palate-signature.ts` → `paletteSignature(vector)`: top-2 families as
  short adjectives, e.g. **"sherried, peated"**. Falls back to *"still taking shape"*
  (never empty). Used in the directory and on introductions.
- `lib/whisky/taste-narrative.ts` → longer prose description of a vector.

```ts
// palette-signature.ts
export function paletteSignature(vector) {
  const top = Object.entries(vector || {})
    .filter(([slug, v]) => v > 0 && SHORT[slug])
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([slug]) => SHORT[slug])
  return top.length ? top.join(', ') : 'still taking shape'
}
// SHORT: young_spritely→'bright', rich_dried_fruits→'sherried', peated→'peated', …
```

---

## 10. Surfaces (where it shows today)

- `app/members/whisky/finder/page.tsx` — the Flavour Finder (sliders → matches).
- `app/members/taste/page.tsx` — the member's own radar + derived signature.
- `app/members/whisky/page.tsx` — catalogue with per-bottle radar.
- `app/admin/whisky/flavour-review/page.tsx` — the confirm-tags review queue.
- Palate twins surface through the social layer (introductions / the Snug).
- `TRC radar` component renders a 16-spoke vector as a spider chart.

---

## 11. Where visualisers plug in (for the next Claude)

Everything is a **16-key vector `{family: 0..4}`** — that's the one primitive to
draw. High-value visualisers:

1. **Whisky radar** (exists, could be lifted): 16-spoke spider of a bottle's
   intensities, descriptors on hover, confidence as spoke opacity.
2. **Palate overlay**: the member's vector *over* a whisky's vector on the same
   radar — the gap literally *is* the RMS match. Shade the mismatch area.
3. **Finder live-match**: as sliders move, animate the top matches re-sorting;
   show each candidate's radar with the "don't care" spokes greyed.
4. **Palate-twin constellation**: members as points, cosine similarity as edges
   (respect privacy — family-level only, no raw vectors client-side).
5. **Family galaxy**: all 335 whiskies plotted by dominant family; filter by spoke.
6. **"How we got your palate"**: a provenance view of `sources` (loved bottles →
   contributions → resulting vector), showing the weighted blend.

## 12. Where to improve the maths (candidate upgrades)

- **Weight spokes by confidence** in the match (a low-confidence spoke should pull
  less). Data is already there (`confidence` column), currently unused at query time.
- **Descriptor-level matching** (tier 2) for finer recs, not just the 16 families.
- **Negative preferences** ("no peat") — the Finder only expresses *wants*; a
  dislike axis (penalise presence) would sharpen it.
- **Consumption feedback loop**: the `member_consumption` source is wired but empty
  until the Harmony Log feeds it — turning that on makes profiles self-improving.
- **Similarity normalisation**: cosine ignores magnitude; a hybrid (cosine × a
  magnitude term) could distinguish "same shape, very different intensity" twins.
- **Confirmed-only vs all**: matching currently uses all spokes; a toggle to weight
  or restrict to `confirmed=true` spokes raises trust.

---

### File map (copy these into context when improving)

```
lib/whisky/flavour-match.ts     — RMS matcher (Finder + recommend primitive)
lib/whisky/recommend.ts         — stock-aware, delight-first ranking
lib/whisky/derive-taste.ts      — member vector from loves/consumption/notes (DB)
lib/whisky/taste-profile.ts     — pure derivation (source-pluggable)
lib/whisky/palate-twins.ts      — cosine member↔member + shared-note phrasing
lib/whisky/palate-signature.ts  — top-2-family short label
lib/whisky/taste-narrative.ts   — prose description of a vector
scripts/whisky-flavour-tags.mjs — the taxonomy + the offline LLM tagger
db/whisky_flavour_tags.sql      — spokes/tags schema + RLS
db/member_taste_profiles.sql    — member vector schema + RLS
app/api/whisky/flavour-match/route.ts — Finder endpoint
app/api/whisky/recommend/route.ts     — recommend endpoint
```
