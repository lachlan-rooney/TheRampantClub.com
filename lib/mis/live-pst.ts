/**
 * live-pst.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side PS(t) recomputation for the live "Observatory" page.
 *
 * INTEGRITY RULE: the headline PS(t) this returns MUST equal what the
 * preference_scores SQL view computes, so the observatory shows the system's
 * real number, not a prettier approximation. The view decays on integer days
 * (CURRENT_DATE − last_validated), so `computePSt` uses integer days by default.
 *
 * The continuous `decayFactor` is exposed separately ONLY for drawing the decay
 * curve (the trajectory). The dot for "now" sits at the integer-day value; the
 * curve shows where the value is heading. Never display the fractional value as
 * the score — that would diverge from the system.
 *
 * R and M are recomputed here by the SAME formulas as the view, from stored
 * inputs (validation_count, member visit cadence). Pure functions, no I/O.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PrefInputs {
  s0: number;                 // 1..5
  confidence: number;         // {1, .75, .5, .25}
  lambda: number;             // {0, .002, .005, .01, .02}
  frequency: number;          // {.8, 1, 1.2, 1.5}
  validationCount: number;    // ≥ 1
  lastValidatedISO: string;   // date the spell clock started
}

export interface MemberEngagement {
  /** avg_visits_per_month from member_stats; null/undefined ⇒ no visit history ⇒ M = 1.0 */
  avgVisitsPerMonth?: number | null;
}

/** Reinforcement R = LEAST(1.3, 1 + 0.075·(vc−1)). Matches the view. */
export function reinforcement(validationCount: number): number {
  return Math.min(1.3, 1.0 + 0.075 * (validationCount - 1));
}

/** Engagement M. No visit history ⇒ 1.0. Else clamped to [0.8, 1.5]. Matches the view. */
export function engagement(avgVisitsPerMonth?: number | null): number {
  if (avgVisitsPerMonth == null || !isFinite(avgVisitsPerMonth)) return 1.0;
  return Math.min(1.5, Math.max(0.8, 1.0 + 0.25 * (avgVisitsPerMonth - 1)));
}

/** Continuous decay factor e^(−λ·days). For CURVE PLOTTING ONLY (accepts fractional days). */
export function decayFactor(lambda: number, days: number): number {
  return Math.exp(-lambda * days);
}

/** Whole days elapsed since an ISO date as of `now` — matches CURRENT_DATE − last_validated. */
export function daysSinceInteger(lastValidatedISO: string, now: Date = new Date()): number {
  const start = new Date(lastValidatedISO);
  // normalise to date-only (UTC) to mirror Postgres CURRENT_DATE − date arithmetic
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((b - a) / 86400000));
}

export interface PStBreakdown {
  s0: number;
  confidence: number;
  decay: number;          // e^(−λ·daysSince), integer days
  frequency: number;
  reinforcement: number;  // R
  engagement: number;     // M
  daysSince: number;      // integer
  rawProduct: number;     // before the cap
  pst: number;            // LEAST(5, rawProduct) — THE system value
  capped: boolean;        // true if the scale ceiling bound the score
  needsRevalidation: boolean;
}

/**
 * THE system PS(t), factor-by-factor, for the live decomposition panel.
 * Uses integer days so it equals the preference_scores view exactly.
 */
export function computePSt(
  p: PrefInputs,
  m: MemberEngagement = {},
  now: Date = new Date()
): PStBreakdown {
  const days = daysSinceInteger(p.lastValidatedISO, now);
  const decay = decayFactor(p.lambda, days);
  const R = reinforcement(p.validationCount);
  const M = engagement(m.avgVisitsPerMonth);
  const raw = p.s0 * p.confidence * decay * p.frequency * R * M;
  const pst = Math.min(5, raw);

  // revalidation flag — same score-aware rule as the view
  const needsRevalidation =
    pst < 0.7 * p.s0 || days > 180 || (p.s0 >= 4 && days > 90);

  return {
    s0: p.s0,
    confidence: p.confidence,
    decay,
    frequency: p.frequency,
    reinforcement: R,
    engagement: M,
    daysSince: days,
    rawProduct: raw,
    pst,
    capped: raw > 5,
    needsRevalidation,
  };
}

/**
 * Sample the decay TRAJECTORY for plotting: returns points from the spell start
 * to `horizonDays` ahead, plus the index nearest "today". Continuous (fractional)
 * — this is the curve; the live dot for the current score uses computePSt (integer).
 */
export function decayCurve(
  p: PrefInputs,
  m: MemberEngagement = {},
  horizonDays = 365,
  step = 1,
  now: Date = new Date()
): { points: { day: number; pst: number }[]; todayIndex: number } {
  const R = reinforcement(p.validationCount);
  const M = engagement(m.avgVisitsPerMonth);
  const base = p.s0 * p.confidence * p.frequency * R * M; // constant factors
  const points: { day: number; pst: number }[] = [];
  for (let d = 0; d <= horizonDays; d += step) {
    points.push({ day: d, pst: Math.min(5, base * decayFactor(p.lambda, d)) });
  }
  const today = daysSinceInteger(p.lastValidatedISO, now);
  const todayIndex = Math.min(points.length - 1, Math.round(today / step));
  return { points, todayIndex };
}
