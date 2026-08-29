# The Rampant Club — Flavour Compass migration round-up

**Status: COMPLETE & verified (2026-08-29).** Hand this whole file to Claude as a
context handoff. Deeper engine/algorithm reference: `docs/whisky-matching-engine.md`.

## What it was
Replaced the inherited 13-family (SMWS-style) whisky flavour taxonomy with the
**Flavour Compass** — 16 character-named families in four production-origin
**quadrants** (`field → still → cask → shore`). Quadrant is metadata only,
invisible to the match maths (the radius 0–4 alone is intensity).

### The 16 families
| quadrant | families |
|----------|----------|
| **field** | `cereal_biscuit`, `green_grassy` |
| **still** | `orchard_fruit`, `tropical_citrus`, `floral_honeyed`, `buttery_creamy`, `meaty_sulphury` |
| **cask**  | `vanilla_coconut`, `baking_spice`, `pepper_tannin`, `dried_fruit_walnut`, `treacle_roast`, `leather_polished_oak` |
| **shore** | `woodsmoke`, `tar_iodine`, `brine_shoreline` |

Deliberate **two smokes**: `woodsmoke` (guaiacol — bonfire/ash/embers) vs
`tar_iodine` (phenol/cresol — medicinal/TCP/creosote). A dram can score both.

## Final DB state (all verified)
16 categories · **66** descriptors · **1604** intensity spokes · **880**
descriptor tags · **zero** legacy rows. Quadrant distribution 2 / 5 / 6 / 3.

## What was done — staged & audited, A → E
- **A — Recon.** Manifest of every taxonomy touchpoint; risk was concentrated in ~10 files, everything else count-agnostic.
- **B — Migration SQL** (`db/compass/01–05`, additive; ran manually in Supabase). Seeded the 16 alongside the old 13. Collision-safe routing (old→new by deterministic map + evidence-keyword splits + additive rows), merged per `(whisky, new family)` → **1604 spokes: 1397 `confirmed=true` (curation preserved) / 207 re-queued** (split + additive rows; ratification doesn't survive a reinterpretation). Descriptor tags remapped by meaning; 18 dropped (`oily_texture` — mouthfeel, no home).
- **C — Code.** TAXONOMY v2 (16 + quadrants + descriptor lexicon) and tagger prompt v2 (congener cues + two-smoke routing; anti-fabrication rules verbatim). The 4 hardcoded slug→phrase maps updated (palate-signature `SHORT`, taste-narrative `FAMILY_PHRASE`, palate-twins `SHARED_PHRASE`, journey `FAMILY_WORD`). Tag caps `slice(0,13)`→`16`. **Every `flavour_categories` display read filters `quadrant IS NOT NULL`** so nothing shows the old 13. Copy: "wheel"→"compass" (feature name "Flavour Finder" kept). Regenerated `db/whisky_flavour_tags.sql` + the engine doc. `grep -ri smws` in src is empty.
- **D — Data.** The 3 member taste profiles (M001–M003) re-derived onto the 16. No LLM re-tag fallback was needed (every split-family row had routable evidence).
- **E — Cutover** (`db/compass/06_cutover.sql`, ran manually). Deleted the legacy 13 families / descriptors / intensity + tag rows. Post-checks reconcile.

### Also shipped alongside
- **`lib/cup-whiskies.ts` retired.** The public `/cup/finder` kiosk was a baked 40-bottle Ho Tram file on the old 13; it now pulls the **full live catalogue** via DB categories + `POST /api/whisky/flavour-match`, hard-filtered to `in_stock` (public-surface convention). That endpoint is unauthenticated, so it gained **IP rate-limiting** + an `in_stock_only` flag (closed a long-flagged no-auth service-role gap).
- **Admin `/admin/whisky/flavour-review`** gained a **Radar-spokes queue + family filter + "Confirm all shown"** so the 207 migrated spokes ratify a family at a time.

## Invariants that held
- **Match formula is PINNED.** `lib/whisky/flavour-match.ts` `matchWhiskies` (RMS over set spokes; `pct = (1−d/4)·100`; bands strong ≤1.0 / good ≤1.5 / loose ≤2.5 / distant) was **not touched**. Regression proved **byte-identical top-3** for three fixed shapes before vs after the migration.
- **Routing preserved** in the `flavour_family_migration` audit table; the old seed lives in git history — recoverable if ever needed.
- Adversarial multi-agent verification of the whole codebase: **0 confirmed defects**.

## Where things live
```
scripts/whisky-flavour-tags.mjs   — TAXONOMY (source of truth) + offline LLM tagger (v2 prompt)
db/compass/01–06.sql              — the staged migration (audit, seed, descriptors, intensities, tags, cutover)
db/whisky_flavour_tags.sql        — regenerated fresh-install seed (16 + quadrant)
lib/whisky/*                       — flavour-match, recommend, derive-taste, palate-twins, palate-signature, taste-narrative
components/whisky/flavour-data.ts  — fetchCategories (filters quadrant IS NOT NULL)
app/api/whisky/flavour-match       — the shared (public, rate-limited) match endpoint
docs/whisky-matching-engine.md     — full engine + algorithm reference (on the 16)
```

## Remaining / optional
Nothing is blocking. The only future work is **re-tagging bottles** with the v2
prompt whenever desired: `node scripts/whisky-flavour-tags.mjs tag` (writes
`confirmed=false` rows into the review queue). New tags land in the Radar-spokes /
Descriptors review page for human ratification.
