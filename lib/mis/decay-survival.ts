/**
 * decay-survival.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bayesian exponential survival model for preference-decay (λ) estimation.
 *
 * The deployed scoring law is  PS(t) = S₀ · C · e^(−λt) · F · R · M.
 * The e^(−λt) term is exponential decay; this module fits the *generative*
 * counterpart — modelling each preference's time-to-contradiction as an
 * exponential survival process — so the inferred λ is the parameter of the very
 * decay law the system already uses, not an arbitrary survival fit.
 *
 * WHY ANALYTICAL (NOT MCMC):
 *   Exponential likelihood × Gamma prior is conjugate. The posterior is
 *   Gamma(α₀ + d, β₀ + T) in closed form, where
 *       d = number of contradiction events  (uncensored)
 *       T = total time-at-risk across all spells (events + censored survivals).
 *   No sampler is required; everything below is exact arithmetic plus a few
 *   well-characterised special-function approximations. Runs in any JS runtime
 *   (Vercel Edge or Node), fully transparent, nothing to "trust" about convergence.
 *
 * Dependency-free. No external packages.
 *
 * NUMERICS ARE INDEPENDENTLY VERIFIED (round-trip, posterior-vs-Monte-Carlo,
 * SBC coverage). Do NOT modify the math without re-running the verification.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ===========================================================================
 * 1. SPECIAL FUNCTIONS (Lanczos logΓ, regularised incomplete gamma, inverse,
 *    Gamma quantile, normal quantile, Gamma sampler). Standard numerical methods.
 * =========================================================================== */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

/** Natural log of the gamma function, via Lanczos approximation (g=7). */
export function logGamma(z: number): number {
  if (z < 0.5) {
    // Reflection formula: Γ(z)Γ(1−z) = π / sin(πz)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  z -= 1
  let x = LANCZOS[0]
  for (let i = 1; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i)
  const t = z + LANCZOS.length - 1.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/** Series expansion for the regularised lower incomplete gamma P(a,x), x < a+1. */
function gserP(a: number, x: number): number {
  if (x <= 0) return 0
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 0; n < 300; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * 1e-16) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
}

/** Continued fraction (Lentz) for the regularised upper incomplete gamma Q(a,x), x ≥ a+1. */
function gcfQ(a: number, x: number): number {
  const TINY = 1e-300
  let b = x + 1 - a
  let c = 1 / TINY
  let d = 1 / b
  let h = d
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < TINY) d = TINY
    c = b + an / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

/** Regularised lower incomplete gamma P(a,x) = γ(a,x)/Γ(a). This is the CDF of Gamma(a, rate=1). */
export function regLowerGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN
  if (x === 0) return 0
  return x < a + 1 ? gserP(a, x) : 1 - gcfQ(a, x)
}

/** Inverse standard-normal CDF (Acklam's rational approximation; |err| < 1.15e-9). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2,
             1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239e+0]
  const b = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2,
             6.680131188771972e+1, -1.328068155288572e+1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e+0,
             -2.549732539343734e+0, 4.374664141464968e+0, 2.938163982698783e+0]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e+0,
             3.754408661907416e+0]
  const plow = 0.02425, phigh = 1 - plow
  let q: number, r: number
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  } else if (p <= phigh) {
    q = p - 0.5; r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  }
}

/**
 * Quantile (inverse CDF) of Gamma(shape, rate).
 * Solves P(shape, rate·x) = p for x, via Wilson–Hilferty initial guess + Newton,
 * with bisection fallback for robustness.
 */
export function gammaQuantile(p: number, shape: number, rate: number): number {
  if (p <= 0) return 0
  if (p >= 1) return Infinity
  const a = shape
  // Wilson–Hilferty initial guess for the rate-1 gamma quantile y (P(a,y)=p):
  const z = normalQuantile(p)
  let y = a * Math.pow(1 - 1 / (9 * a) + z / Math.sqrt(9 * a), 3)
  if (!(y > 0)) y = a // guard
  // Newton on f(y) = P(a,y) − p, f'(y) = y^{a-1} e^{-y} / Γ(a)
  let lo = 0, hi = Number.POSITIVE_INFINITY
  for (let it = 0; it < 100; it++) {
    const f = regLowerGamma(a, y) - p
    if (f > 0) hi = y; else lo = y
    const logpdf = (a - 1) * Math.log(y) - y - logGamma(a)
    const fp = Math.exp(logpdf)
    const step = fp > 0 ? f / fp : 0
    let yNext = y - step
    if (!(yNext > lo && yNext < hi) || !isFinite(yNext)) {
      // bisection fallback
      yNext = hi === Number.POSITIVE_INFINITY ? y * 2 : 0.5 * (lo + hi)
    }
    if (Math.abs(yNext - y) < 1e-12 * (1 + y)) { y = yNext; break }
    y = yNext
  }
  return y / rate // rescale rate-1 quantile to rate β
}

/** Box–Muller standard normal sample. */
function randNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Marsaglia–Tsang Gamma(shape, rate) sampler (used only for simulation-based calibration). */
export function randGamma(shape: number, rate: number): number {
  if (shape < 1) {
    return randGamma(1 + shape, rate) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number, v: number
    do { x = randNormal(); v = 1 + c * x } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * x * x * x * x) return (d * v) / rate
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return (d * v) / rate
  }
}

/* ===========================================================================
 * 2. DATA MODEL
 * =========================================================================== */

/**
 * One observed "spell": the interval a preference survived without contradiction,
 * since its last validation.
 *   - event=true  → the spell ENDED in a contradiction at time `days` (uncensored)
 *   - event=false → the spell was right-censored at `days` (still valid, or ended
 *                   in a confirmation, i.e. survived without failing)
 */
export interface Spell {
  category: string
  days: number
  event: boolean
}

export interface PriorConfig {
  /** Designed (domain-expert) λ for this category, in day⁻¹. λ=0 ⇒ category is EXCLUDED from fitting. */
  designedLambda: number
  /** Prior strength expressed as pseudo-exposure in days. Default 365 = "one year of prior exposure". */
  pseudoExposureDays?: number
}

export interface CategoryPosterior {
  category: string
  excluded: boolean
  reason?: string
  designedLambda: number
  // sufficient statistics actually used:
  nSpells: number
  nEvents: number
  totalExposureDays: number
  // posterior:
  priorAlpha: number
  priorBeta: number
  postAlpha: number
  postBeta: number
  learnedLambda: number
  lambdaCI95: [number, number]
  halfLifeDays: number
  halfLifeCI95: [number, number]
  // governance:
  meetsEventFloor: boolean
  ciRelativeWidth: number
  ciNarrowEnough: boolean
  recommendation: 'propose' | 'insufficient_data' | 'excluded'
}

export interface FitOptions {
  eventFloor?: number
  ciMaxRelWidth?: number
  pseudoExposureDays?: number
}

/* ===========================================================================
 * 3. PRIOR ELICITATION
 * =========================================================================== */

export function designedPrior(cfg: PriorConfig): { alpha: number; beta: number } | null {
  if (cfg.designedLambda <= 0) return null
  const tau0 = cfg.pseudoExposureDays ?? 365
  return { alpha: cfg.designedLambda * tau0, beta: tau0 }
}

/* ===========================================================================
 * 4. CORE FIT — single category
 * =========================================================================== */

export function fitCategory(
  category: string,
  spells: Spell[],
  prior: PriorConfig,
  opts: FitOptions = {}
): CategoryPosterior {
  const eventFloor = opts.eventFloor ?? 20
  const ciMaxRelWidth = opts.ciMaxRelWidth ?? 1.0

  if (prior.designedLambda <= 0) {
    return {
      category, excluded: true,
      reason: 'Designed λ = 0 (permanent preference class, e.g. medical/safety). ' +
              'A contradiction here is a data-entry error or genuine clinical change, ' +
              'not evidence of decay; fitting would be a safety regression.',
      designedLambda: prior.designedLambda,
      nSpells: spells.length, nEvents: spells.filter(s => s.event).length,
      totalExposureDays: spells.reduce((a, s) => a + s.days, 0),
      priorAlpha: NaN, priorBeta: NaN, postAlpha: NaN, postBeta: NaN,
      learnedLambda: 0, lambdaCI95: [0, 0], halfLifeDays: Infinity, halfLifeCI95: [Infinity, Infinity],
      meetsEventFloor: false, ciRelativeWidth: NaN, ciNarrowEnough: false,
      recommendation: 'excluded',
    }
  }

  const pr = designedPrior({ ...prior, pseudoExposureDays: prior.pseudoExposureDays ?? opts.pseudoExposureDays })!
  const d = spells.filter(s => s.event).length
  const T = spells.reduce((acc, s) => acc + s.days, 0)

  const postAlpha = pr.alpha + d
  const postBeta = pr.beta + T
  const mean = postAlpha / postBeta
  const lo = gammaQuantile(0.025, postAlpha, postBeta)
  const hi = gammaQuantile(0.975, postAlpha, postBeta)
  const relWidth = (hi - lo) / mean

  const LN2 = Math.LN2
  return {
    category, excluded: false,
    designedLambda: prior.designedLambda,
    nSpells: spells.length, nEvents: d, totalExposureDays: T,
    priorAlpha: pr.alpha, priorBeta: pr.beta,
    postAlpha, postBeta,
    learnedLambda: mean,
    lambdaCI95: [lo, hi],
    halfLifeDays: LN2 / mean,
    halfLifeCI95: [LN2 / hi, LN2 / lo],
    meetsEventFloor: d >= eventFloor,
    ciRelativeWidth: relWidth,
    ciNarrowEnough: relWidth <= ciMaxRelWidth,
    recommendation: (d >= eventFloor && relWidth <= ciMaxRelWidth) ? 'propose' : 'insufficient_data',
  }
}

/* ===========================================================================
 * 5. EMPIRICAL-BAYES HYPERPRIOR — gated; only activates with enough categories.
 * =========================================================================== */

export interface HyperpriorResult {
  activated: boolean
  alpha?: number
  beta?: number
  nQualifyingCategories: number
  note: string
}

export function empiricalBayesHyperprior(
  categoryStats: { category: string; d: number; T: number }[],
  opts: { minCategories?: number; eventFloor?: number } = {}
): HyperpriorResult {
  const minCategories = opts.minCategories ?? 4
  const eventFloor = opts.eventFloor ?? 20
  const qualifying = categoryStats.filter(c => c.d >= eventFloor && c.T > 0)

  if (qualifying.length < minCategories) {
    return {
      activated: false,
      nQualifyingCategories: qualifying.length,
      note: `Empirical-Bayes pooling inactive: ${qualifying.length}/${minCategories} categories ` +
            'clear the event floor. Falling back to designed-λ priors. Partial pooling will ' +
            'activate automatically once cross-category evidence is sufficient.',
    }
  }

  const negLogMarg = (alpha: number, beta: number): number => {
    if (alpha <= 0 || beta <= 0) return Infinity
    let s = 0
    for (const c of qualifying) {
      s += alpha * Math.log(beta) - logGamma(alpha) + logGamma(alpha + c.d)
         - (alpha + c.d) * Math.log(beta + c.T)
    }
    return -s
  }

  let best = { a: 1, b: 365, f: Infinity }
  const gridA = logspace(-2, 2, 41)
  const gridB = logspace(0, 4.5, 41)
  for (const a of gridA) for (const b of gridB) {
    const f = negLogMarg(a, b)
    if (f < best.f) best = { a, b, f }
  }
  for (let iter = 0; iter < 30; iter++) {
    const da = best.a * 0.1, db = best.b * 0.1
    let improved = false
    for (const a of [best.a - da, best.a, best.a + da]) {
      for (const b of [best.b - db, best.b, best.b + db]) {
        const f = negLogMarg(a, b)
        if (f < best.f) { best = { a, b, f }; improved = true }
      }
    }
    if (!improved) break
  }

  return {
    activated: true,
    alpha: best.a,
    beta: best.b,
    nQualifyingCategories: qualifying.length,
    note: `Empirical-Bayes hyperprior active (MLE over ${qualifying.length} categories): ` +
          `Gamma(α=${best.a.toPrecision(3)}, β=${best.b.toPrecision(3)}).`,
  }
}

function logspace(lo: number, hi: number, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(Math.pow(10, lo + (hi - lo) * i / (n - 1)))
  return out
}

/* ===========================================================================
 * 6. FIT ALL CATEGORIES (the function the cron route calls)
 * =========================================================================== */

export function fitAllCategories(
  spells: Spell[],
  priors: Record<string, PriorConfig>,
  opts: FitOptions & { useEmpiricalBayes?: boolean } = {}
): { results: CategoryPosterior[]; hyperprior: HyperpriorResult } {
  const byCat = new Map<string, Spell[]>()
  for (const s of spells) {
    if (!byCat.has(s.category)) byCat.set(s.category, [])
    byCat.get(s.category)!.push(s)
  }
  for (const cat of Object.keys(priors)) if (!byCat.has(cat)) byCat.set(cat, [])

  let hyperprior: HyperpriorResult = { activated: false, nQualifyingCategories: 0, note: 'Empirical-Bayes not requested.' }
  if (opts.useEmpiricalBayes) {
    const stats = [...byCat.entries()]
      .filter(([cat]) => (priors[cat]?.designedLambda ?? 0) > 0)
      .map(([cat, sp]) => ({
        category: cat,
        d: sp.filter(s => s.event).length,
        T: sp.reduce((a, s) => a + s.days, 0),
      }))
    hyperprior = empiricalBayesHyperprior(stats, { eventFloor: opts.eventFloor })
  }

  const results: CategoryPosterior[] = []
  for (const [cat, sp] of byCat) {
    const prior = priors[cat]
    if (!prior) continue
    const effectivePrior: PriorConfig =
      opts.useEmpiricalBayes && hyperprior.activated && prior.designedLambda > 0
        ? { designedLambda: hyperprior.alpha! / hyperprior.beta!, pseudoExposureDays: hyperprior.beta! }
        : prior
    results.push(fitCategory(cat, sp, effectivePrior, opts))
  }
  results.sort((a, b) => a.category.localeCompare(b.category))
  return { results, hyperprior }
}

/* ===========================================================================
 * 7. SIMULATION-BASED CALIBRATION (the honesty check)
 * =========================================================================== */

export interface SBCResult {
  draws: number
  nominalCoverage: number
  empiricalCoverage: number
  meanRelativeBias: number
  preferencesPerDraw: number
  censoringHorizonDays: number
}

export function simulationBasedCalibration(opts: {
  designedLambda: number
  pseudoExposureDays?: number
  draws?: number
  preferencesPerDraw?: number
  censoringHorizonDays?: number
}): SBCResult {
  const tau0 = opts.pseudoExposureDays ?? 365
  const prior = designedPrior({ designedLambda: opts.designedLambda, pseudoExposureDays: tau0 })!
  const N = opts.draws ?? 2000
  const m = opts.preferencesPerDraw ?? 40
  const H = opts.censoringHorizonDays ?? 365

  let covered = 0
  let relBiasSum = 0
  for (let i = 0; i < N; i++) {
    const lambdaStar = randGamma(prior.alpha, prior.beta)
    let d = 0, T = 0
    for (let j = 0; j < m; j++) {
      const tau = -Math.log(Math.random()) / lambdaStar
      if (tau <= H) { d += 1; T += tau }
      else { T += H }
    }
    const postA = prior.alpha + d
    const postB = prior.beta + T
    const lo = gammaQuantile(0.025, postA, postB)
    const hi = gammaQuantile(0.975, postA, postB)
    if (lambdaStar >= lo && lambdaStar <= hi) covered++
    relBiasSum += (postA / postB - lambdaStar) / lambdaStar
  }
  return {
    draws: N,
    nominalCoverage: 0.95,
    empiricalCoverage: covered / N,
    meanRelativeBias: relBiasSum / N,
    preferencesPerDraw: m,
    censoringHorizonDays: H,
  }
}
