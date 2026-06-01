/**
 * decay-priors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The canonical designed-λ map per category. Single source of truth: imported
 * by the Pass-3 fit cron AND by Pass-4 AI-extraction's category baseline.
 * Hard-coding it in either caller would create two copies that will drift.
 *
 * λ has units of day⁻¹. half-life (days) = ln(2) / λ.
 *
 * BASIS — these are the *corrected* designed centres, anchored on modal live
 * values rather than dissertation specification. The prior should encode what
 * operators actually believe; the spec demonstrably disagrees with practice
 * in five of nine categories, so we anchor where the evidence (live preference
 * λ assignments) and operator intuition agree. The per-category basis comment
 * is the audit trail — when a reviewer asks "why 0.002 here?", the answer
 * sits inline.
 *
 * MEDICAL EXCLUSION IS NOT A CATEGORY. There is no "Health & Safety" key here.
 * The λ=0 exclusion is row-level: when a preference is stored with lambda=0
 * (medical/safety), it is excluded by the views (lambda > 0 filter) and by
 * fitCategory's designed-λ ≤ 0 branch. Don't add a medical category to this
 * map to trigger the exclusion — that was the v1 bug.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { PriorConfig } from './decay-survival'

/**
 * Designed λ per category, day⁻¹. Half-life shown in basis comment for review.
 * Order is alphabetical — the cron sorts results alphabetically anyway, so
 * matching here makes diffs against the proposals table easy to read.
 */
export const DESIGNED_LAMBDA: Record<string, number> = {
  // Business & Productivity — modal 11/18 live rows at 0.002; spec was 0.010
  // (every-100-day decay), operators set ~year half-life. Trust operators.
  'Business & Productivity': 0.002,        // half-life ≈ 347 d

  // Cultural & Intellectual — modal 11/17 at 0.005, matches spec.
  'Cultural & Intellectual': 0.005,        // half-life ≈ 139 d

  // Family & Personal — first-principles core-identity. No live rows in
  // production yet (0 in B4). Half-year+ half-life: family preferences
  // (e.g. spouse's wine, child's name) shift slowly. Hold loosely until
  // evidence arrives.
  'Family & Personal': 0.002,              // half-life ≈ 347 d

  // Food & Beverage — modal 12/24 at 0.005, matches spec.
  'Food & Beverage': 0.005,                // half-life ≈ 139 d

  // Personal & Lifestyle — modal 8/24 at 0.002 (4 medical zeros excluded,
  // so denominator is 20); matches spec.
  'Personal & Lifestyle': 0.002,           // half-life ≈ 347 d

  // Social & Networking — modal 8/12 at 0.002; spec was 0.005. Operators
  // judge social preferences (table layout, intro style) as longer-lived
  // than spec assumed. Trust live data.
  'Social & Networking': 0.002,            // half-life ≈ 347 d

  // Travel & Global — modal 3/7 at 0.005 by a single row over 0.010 (2/7).
  // Weak signal; hold loosely. SBC may flag this category first as live
  // events accrue.
  'Travel & Global': 0.005,                // half-life ≈ 139 d

  // Wellness & Comfort — modal 4/5 at 0.002. Sparse category (only 5 active
  // prefs), modal is the best we have. Reconsider once n_active > 20.
  'Wellness & Comfort': 0.002,             // half-life ≈ 347 d

  // Whisky & Beverage — modal 24/51 at 0.005 (2 medical zeros excluded from
  // the modal denominator), matches spec. The largest category by row count
  // and likely the first to clear the event floor.
  'Whisky & Beverage': 0.005,              // half-life ≈ 139 d
}

/** Prior strength as pseudo-exposure days. 365 = "one year of prior exposure". */
export const DEFAULT_PSEUDO_EXPOSURE_DAYS = 365

/** Build the {category → PriorConfig} dict the survival fitter expects. */
export function buildPriorMap(
  pseudoExposureDays: number = DEFAULT_PSEUDO_EXPOSURE_DAYS
): Record<string, PriorConfig> {
  const out: Record<string, PriorConfig> = {}
  for (const [cat, lam] of Object.entries(DESIGNED_LAMBDA)) {
    out[cat] = { designedLambda: lam, pseudoExposureDays }
  }
  return out
}

/** The nine canonical category keys, sorted alphabetically. */
export const CANONICAL_CATEGORIES = Object.keys(DESIGNED_LAMBDA).sort()
