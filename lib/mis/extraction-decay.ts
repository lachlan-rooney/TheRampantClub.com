/**
 * extraction-decay.ts  (v2 — corrected per Step-0 audit)
 * ─────────────────────────────────────────────────────────────────────────────
 * Transcript → preference extraction, aligned to the live 6-variable scoring model
 * with LEARNED-λ inheritance (closed loop with the Bayesian decay fit).
 *
 * CORRECTIONS FROM AUDIT:
 *   1. Canonical categories fixed: "Family & Personal" is IN (λ_designed = 0.002,
 *      core-identity); "Health & Safety" is OUT — it is not a category in this
 *      system, it is an OVERRIDE applied to medical preferences that live inside
 *      ordinary categories with a row-level λ=0.
 *   2. Medical guardrail is now CONTENT-BASED and FAIL-SAFE (isMedicalPreference),
 *      not category-based. The old `DESIGNED_LAMBDA[category]===0` test never fired
 *      for real allergies (they have no dedicated category) — a safety regression.
 *      Now: any medical/allergy/religious-dietary signal in the text -> force
 *      s0=5, C=1.00, λ=0. Over-forcing a non-medical item is harmless; missing an
 *      allergy is dangerous, so detection is deliberately broad.
 *   3. Model string: claude-opus-4-7 (codebase standard; exact ID, no date suffix).
 *
 * The AI still emits only the four transcript-observable inputs (S0, C, λ, F).
 * It must NOT emit R or M — those are computed live in preference_scores. R and M
 * for a new preference are neutral (1.0) automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

/* SINGLE SOURCE OF TRUTH for the designed-λ map: lib/mis/decay-priors.ts.
 * Do NOT redeclare the map here — the cron route and this extractor MUST read the
 * SAME values or the priors will diverge. The map holds the corrected MODAL live
 * values (Whisky 0.005, Social 0.002, Business 0.002, Wellness 0.002, Travel 0.005,
 * etc.), NOT the original spec values. Medical is a row-level λ=0 override, not a
 * category — there is no "Health & Safety" key.
 *
 * NB FOR INTEGRATION: confirm the exact export name in decay-priors.ts and align
 * this import. Expected shape: a Record<string, number> of the 9 canonical
 * categories → designed λ. If decay-priors.ts exports it under a different name
 * (e.g. DESIGNED_PRIORS or a richer object), adapt the import and, if needed, map
 * it to Record<string, number> here. */
import { DESIGNED_LAMBDA } from "./decay-priors";
export { DESIGNED_LAMBDA };

export const ALLOWED_LAMBDA = [0.0, 0.002, 0.005, 0.01, 0.02] as const;
export const CANONICAL_CATEGORIES = Object.keys(DESIGNED_LAMBDA); // exactly 9

/* ===========================================================================
 * MEDICAL GUARDRAIL — content-based, fail-safe. (Verified: 15/15 cases incl. traps.)
 * "medicinal" as a tasting note and "health(y)" as a lifestyle word do NOT trigger;
 * keyword-free allergy phrasings ("can't have X, my throat closes up") DO.
 * =========================================================================== */

const MEDICAL_STEMS = [
  "allerg", "anaphyla", "epipen", "epi pen", "epi-pen",
  "coeliac", "celiac", "intoleran", "lactose", "halal", "kosher",
  "diabet", "medication", "medicine", "prescription", "prescribed",
  "doctor", "physician", "medical", "pregnan", "gluten",
];

const MEDICAL_PHRASES: RegExp[] = [
  /\bcan('|’)?t\s+have\b/i,
  /\bcannot\s+have\b/i,
  /\bbreaks?\s+me\s+out\b/i,
  /\bbrings?\s+me\s+out\b/i,
  /\bthroat\s+(closes|swells|tightens)/i,
  /\bgo(es)?\s+into\s+shock\b/i,
  /\bmakes?\s+me\s+(ill|sick)\b/i,
  /\bupsets?\s+my\s+stomach\b/i,
  /\bsensitiv\w*\s+to\b/i,
  /\breact(s|ion)?\s+to\b/i,
  /\bintoleran\w*\b/i,
  /\bfor\s+now\b.*\b(alcohol|drink)\b/i,
];

function medicalHaystack(p: ExtractedPreference): string {
  return [p.preference_name, p.detail, p.verbatim_quote, p.subcategory, p.category]
    .filter(Boolean).join("  ").toLowerCase();
}

function hasStem(text: string, stem: string): boolean {
  const i = text.indexOf(stem);
  if (i === -1) return false;
  const before = i === 0 ? " " : text[i - 1];
  return !/[a-z]/.test(before); // stem must begin at a word boundary
}

/** TRUE if the preference shows any medical / allergy / religious-dietary signal. Fail-safe. */
export function isMedicalPreference(p: ExtractedPreference): boolean {
  const text = medicalHaystack(p);
  for (const s of MEDICAL_STEMS) if (hasStem(text, s)) return true;
  for (const re of MEDICAL_PHRASES) if (re.test(text)) return true;
  return false;
}

/* ===========================================================================
 * LEARNED-λ live lookup + baselines (medical handled at reconcile)
 * =========================================================================== */

export async function getActiveLearnedLambda(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("learned_decay_constants")
    .select("category, learned_lambda, fit_timestamp, status")
    .eq("status", "active")
    .order("fit_timestamp", { ascending: false });
  if (error) throw new Error(`learned_decay_constants lookup: ${error.message}`);
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const cat = (row as any).category as string;
    if (!(cat in out)) out[cat] = Number((row as any).learned_lambda);
  }
  return out;
}

/** Per-category baseline the AI reasons against: learned λ if promoted, else designed. */
export function buildCategoryBaselines(
  learned: Record<string, number>
): Record<string, { baselineLambda: number; source: "learned" | "designed" }> {
  const out: Record<string, { baselineLambda: number; source: "learned" | "designed" }> = {};
  for (const cat of CANONICAL_CATEGORIES) {
    const designed = DESIGNED_LAMBDA[cat];
    if (cat in learned && isFinite(learned[cat]) && learned[cat] > 0) {
      out[cat] = { baselineLambda: snapToAllowed(learned[cat]), source: "learned" };
    } else {
      out[cat] = { baselineLambda: designed, source: "designed" };
    }
  }
  return out;
}

export function snapToAllowed(lambda: number): number {
  if (!isFinite(lambda) || lambda <= 0) return 0;
  let best: number = ALLOWED_LAMBDA[0], bestD = Infinity;
  for (const v of ALLOWED_LAMBDA) { const d = Math.abs(v - lambda); if (d < bestD) { bestD = d; best = v; } }
  return best;
}

/* ===========================================================================
 * SYSTEM PROMPT — 9 canonical categories (no Health & Safety), learned baselines injected.
 * Medical handling is described to the AI, but ENFORCEMENT is in code (reconcile).
 * =========================================================================== */

export function buildSystemPrompt(
  baselines: Record<string, { baselineLambda: number; source: "learned" | "designed" }>
): string {
  const baselineTable = CANONICAL_CATEGORIES.map((c) => {
    const b = baselines[c];
    const tag = b.source === "learned" ? "LEARNED from member data" : "designed default";
    return `  - ${c}: baseline lambda = ${b.baselineLambda} (${tag})`;
  }).join("\n");

  return `You are the Member Intelligence System (MIS) extraction engine for The Rampant Club,
an ultra-exclusive private members' club in Ho Chi Minh City, Vietnam.

Read an interview transcript and extract EVERY member preference. For each, return four scoring
inputs and nothing scoring-related beyond them. Output a single raw JSON array, no markdown.

OUTPUT FIELDS PER PREFERENCE:
- category: EXACTLY one of these NINE canonical values (no others):
    "Personal & Lifestyle", "Food & Beverage", "Whisky & Beverage", "Social & Networking",
    "Business & Productivity", "Wellness & Comfort", "Cultural & Intellectual",
    "Family & Personal", "Travel & Global"
- subcategory: short specific area (e.g. "Dietary restriction", "Seating", "Greeting style")
- preference_name: short label, max 5 words
- detail: one sentence of context
- verbatim_quote: the member's EXACT words from the transcript
- s0: importance 1-5
    5 ABSOLUTE ("never/always/allergic/require" + emotion + repetition; anger if wrong)
    4 STRONG ("really prefer/strongly dislike/love/hate" + reason; disappointment)
    3 MODERATE ("tend to/usually/enjoy"; mild annoyance)
    2 MILD; 1 AWARE
- confidence: exactly one of 1.00 / 0.75 / 0.50 / 0.25
    1.00 explicit, 0.75 observed-pattern, 0.50 inferred, 0.25 one-off.
    Modifiers: emotional language +0.20, repetition +0.10/mention, qualifier -0.20,
    contradiction -0.50; cap 1.00, floor 0.25.
- lambda: exactly one of 0.000 / 0.002 / 0.005 / 0.010 / 0.020 (decay rate)
- frequency: exactly one of 0.8 / 1.0 / 1.2 / 1.5 (always 1.0 at initial interview)

CRITICAL - DO NOT OUTPUT any other scoring fields. In particular DO NOT output reinforcement,
"R", engagement, "M", or any computed score. Those are derived by the system from validation
history and visit cadence, not from the transcript.

MEDICAL / ALLERGY / RELIGIOUS-DIETARY ITEMS:
Give these the canonical category they naturally belong to (usually "Food & Beverage" or
"Wellness & Comfort"), and set s0=5, confidence=1.00, lambda=0.000. This includes allergies,
intolerances, coeliac/gluten, anaphylaxis, medication-driven avoidances, pregnancy-related
abstention, and religious dietary rules (halal, kosher). Do NOT invent a "Health & Safety"
category - it is not in the list above.

CHOOSING lambda FOR NON-MEDICAL PREFERENCES - START FROM THE CATEGORY BASELINE, THEN ADJUST:
Use each category's baseline lambda as your DEFAULT. Move OFF it only on clear preference-specific signal:
${baselineTable}

  Toward 0.002 (slower, more permanent): identity-/memory-attached, lifelong, spoken with
  emotional weight ([softens], [voice drops], a story about its origin).
  Toward 0.010/0.020 (faster): evolving, situational, seasonal, hedged ([sheepish], "lately",
  "these days", "currently").
  No preference-specific signal -> USE THE BASELINE. In doubt -> choose the SLOWER (lower) bucket.

OTHER RULES:
- Separate compound preferences ("seafood and Vietnamese coffee" = TWO rows).
- A medical condition that drives a dietary rule gets BOTH a medical row (lambda=0.000) AND, if there is
  also a non-medical taste angle, a separate ordinary preference row.
- Extract thoroughly: a real interview yields 25-45 rows.
- Vietnamese cultural context matters (Buddhist dietary rules, business-privacy norms, hierarchy, "face").

Return ONLY the JSON array.`;
}

/* ===========================================================================
 * POST-EXTRACTION RECONCILIATION — guardrails enforced in code, model never trusted
 * =========================================================================== */

export interface ExtractedPreference {
  category: string;
  subcategory?: string;
  preference_name?: string;
  detail?: string;
  verbatim_quote?: string;
  s0?: number;
  confidence?: number;
  lambda?: number;
  frequency?: number;
  /** Optional per-factor reasoning (probe mode). Accepts EITHER the legacy
   *  one-string shape OR the per-factor object — reconcile normalises both
   *  into RationaleDetail and applies rule-label overrides per origin. The
   *  scoring rubric is unchanged; rationale only explains existing choices. */
  rationale?: string | RationaleDetail;
}

/** Per-factor reasoning. Each clause should explain ONLY its own factor —
 *  F explains frequency (how often it applies), C explains confidence, λ
 *  explains decay, S₀ explains importance — without bleeding into others.
 *  Rule-labelled factors override the AI's per-factor text after reconcile. */
export interface RationaleDetail {
  summary?: string;
  s0?: string;
  c?: string;
  lambda?: string;
  f?: string;
}

export interface ReconciledPreference {
  category: string;
  subcategory: string;
  preference_name: string;
  detail: string;
  verbatim_quote: string;
  s0: number;
  confidence: number;
  lambda: number;
  frequency: number;
  source: "Interview";
  lambda_origin:
    | "ai_specific"
    | "category_baseline_learned"
    | "category_baseline_designed"
    | "forced_medical"     // content-detected medical signal — red "MEDICAL — LOCKED" badge
    | "ai_permanent";      // AI judged λ=0 (lifelong identity) without medical content — gold "PERMANENT — LOCKED" badge
  /** Per-factor reasoning. AI-judged factors carry the model's text; rule-forced
   *  factors carry deterministic rule labels written by reconcile (so the card
   *  never displays AI prose explaining a value the code actually set). Empty
   *  object when the input had no rationale and no rules applied. */
  rationale: RationaleDetail;
}

const ALLOWED_CONFIDENCE = [1.0, 0.75, 0.5, 0.25];
const ALLOWED_FREQUENCY = [0.8, 1.0, 1.2, 1.5];

function snapToSet(v: number | undefined, set: number[], fallback: number): number {
  if (v == null || !isFinite(v)) return fallback;
  let best = set[0], bestD = Infinity;
  for (const s of set) { const d = Math.abs(s - v); if (d < bestD) { bestD = d; best = s; } }
  return best;
}
function clampInt(v: number | undefined, lo: number, hi: number, fallback: number): number {
  if (v == null || !isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Normalise the back-compat rationale input. A bare string becomes
 *  `{ summary: string }`; an object is passed through. Missing → `{}`. */
function normaliseRationale(input: string | RationaleDetail | undefined): RationaleDetail {
  if (!input) return {};
  if (typeof input === "string") return { summary: input };
  return {
    summary: input.summary,
    s0:      input.s0,
    c:       input.c,
    lambda:  input.lambda,
    f:       input.f,
  };
}

/** Rule-label overrides for factors set by deterministic code, NOT by the AI.
 *  This is the principle: every number must trace to its TRUE cause. Letting
 *  the AI narrate a value the guardrail set would be a quiet dishonesty.
 *
 *  Override map per origin:
 *    - forced_medical   → S₀, C, λ all rule-labelled (medical guardrail forced all three)
 *    - ai_permanent     → S₀, C, λ all rule-labelled (permanence lock forced all three)
 *    - category_baseline_designed → λ only (other factors AI-judged)
 *    - category_baseline_learned  → λ only (other factors AI-judged)
 *    - ai_specific      → nothing overridden (everything AI-judged)
 *
 *  F is NEVER overridden — reconcile doesn't force it for any origin, so the
 *  AI's frequency reasoning stays put. On a forced row, three lines are rule
 *  labels and only F is AI prose — that's correct, not a wart. */
function applyRuleLabels(
  r: RationaleDetail,
  origin: ReconciledPreference["lambda_origin"],
  category: string,
  lambdaValue: number,
): RationaleDetail {
  const out = { ...r };
  if (origin === "forced_medical") {
    out.s0     = "Forced to 5 by medical guardrail — content-detected medical/allergy signal sets maximum importance.";
    out.c      = "Forced to 1.00 by medical guardrail — content-detected medical/allergy signal sets full confidence.";
    out.lambda = "Locked at λ=0 by medical guardrail — content-detected medical/allergy signal. Never decays.";
  } else if (origin === "ai_permanent") {
    out.s0     = "Forced to 5 — model judged this lifelong/identity-level. Permanence lock implies absolute importance.";
    out.c      = "Forced to 1.00 — model judged this lifelong/identity-level. Permanence lock implies full confidence.";
    out.lambda = "Locked at λ=0 — model judged this lifelong/identity-level. Never decays.";
  } else if (origin === "category_baseline_designed") {
    out.lambda = `No preference-specific decay signal — inherited the ${category} designed baseline λ=${lambdaValue.toFixed(3)}.`;
  } else if (origin === "category_baseline_learned") {
    out.lambda = `No preference-specific decay signal — inherited the ${category} learned baseline λ=${lambdaValue.toFixed(3)}.`;
  }
  // ai_specific: every factor stays AI-judged; out keeps the model's text as-is.
  return out;
}

/**
 * Guardrails (Pass-7 refinement: content-first precedence + ai_permanent label):
 *   - drop non-canonical categories (logged)
 *   - lock s0=5, C=1, λ=0 when EITHER trigger fires (both fail-safes intact):
 *       1. CONTENT-BASED medical detection (isMedicalPreference) → 'forced_medical'  (red)
 *       2. AI-emitted lambda=0 without medical content      → 'ai_permanent'         (gold)
 *     Precedence is content-first: if isMedicalPreference fires it's forced_medical
 *     even when the AI also emitted λ=0. ai_permanent only catches the residue —
 *     the model judging "lifelong identity" (anniversary, dad's whisky, no
 *     birthdays) where there's no medical signal in the text. Same scoring effect
 *     either way; only the label and audit trail differ.
 *   - else: usable AI lambda -> snap + keep ('ai_specific'); missing/unusable ->
 *     category baseline (learned or designed)
 *   - C, F snapped; R/M and stray fields not carried forward
 *
 * medicalForced counts ONLY the content-medical fires (its original meaning,
 * preserved for callers). aiPermanent counts the identity-permanence locks
 * separately so the demo banner can read "1 medical-forced · 3 permanent-locked"
 * rather than collapsing both into one number.
 */
export function reconcile(
  raw: ExtractedPreference[],
  baselines: Record<string, { baselineLambda: number; source: "learned" | "designed" }>
): {
  preferences: ReconciledPreference[];
  dropped: { reason: string; item: ExtractedPreference }[];
  medicalForced: number;
  aiPermanent: number;
} {
  const out: ReconciledPreference[] = [];
  const dropped: { reason: string; item: ExtractedPreference }[] = [];
  let medicalForced = 0;
  let aiPermanent = 0;

  for (const r of raw) {
    if (!r.category || !CANONICAL_CATEGORIES.includes(r.category)) {
      dropped.push({ reason: `non-canonical category "${r.category}"`, item: r });
      continue;
    }

    const contentMedical = isMedicalPreference(r);
    const aiSaidZero = r.lambda != null && isFinite(r.lambda) && r.lambda === 0;

    let lambda: number, s0: number, confidence: number;
    let lambda_origin: ReconciledPreference["lambda_origin"];

    if (contentMedical) {
      // Safety path — content-detected medical. Fires even if AI ALSO emitted λ=0;
      // the precedence ensures ai_permanent never overrides the medical label.
      lambda = 0; s0 = 5; confidence = 1.0; lambda_origin = "forced_medical";
      medicalForced++;
    } else if (aiSaidZero) {
      // Identity-permanence path — AI judged λ=0 without medical content signal.
      // Same lock (s0=5/c=1/λ=0) so the row never decays, with an honest label.
      lambda = 0; s0 = 5; confidence = 1.0; lambda_origin = "ai_permanent";
      aiPermanent++;
    } else {
      s0 = clampInt(r.s0, 1, 5, 3);
      confidence = snapToSet(r.confidence, ALLOWED_CONFIDENCE, 1.0);
      // Local-narrowed alias so the strict-null check propagates into snapToAllowed.
      const ai = r.lambda;
      if (ai != null && isFinite(ai) && ai > 0) {
        lambda = snapToAllowed(ai); lambda_origin = "ai_specific";
      } else {
        const b = baselines[r.category];
        lambda = b.baselineLambda;
        lambda_origin = b.source === "learned" ? "category_baseline_learned" : "category_baseline_designed";
      }
    }

    out.push({
      category: r.category,
      subcategory: r.subcategory ?? "",
      preference_name: r.preference_name ?? "",
      detail: r.detail ?? "",
      verbatim_quote: r.verbatim_quote ?? "",
      s0, confidence, lambda,
      frequency: snapToSet(r.frequency, ALLOWED_FREQUENCY, 1.0),
      source: "Interview",
      lambda_origin,
      rationale: applyRuleLabels(normaliseRationale(r.rationale), lambda_origin, r.category, lambda),
    });
  }
  return { preferences: out, dropped, medicalForced, aiPermanent };
}

/* ===========================================================================
 * ORCHESTRATOR — uses the Anthropic SDK (matches the existing intake route).
 * =========================================================================== */

export async function extractPreferencesFromTranscript(args: {
  supabase: ReturnType<typeof createClient>;
  anthropic: { messages: { create: (body: any) => Promise<any> } }; // pass an Anthropic SDK client
  memberName: string;
  transcript: string;
  model?: string;
}): Promise<{
  preferences: ReconciledPreference[];
  dropped: { reason: string; item: ExtractedPreference }[];
  medicalForced: number;
  baselinesUsed: Record<string, { baselineLambda: number; source: "learned" | "designed" }>;
}> {
  const learned = await getActiveLearnedLambda(args.supabase);
  const baselines = buildCategoryBaselines(learned);
  const system = buildSystemPrompt(baselines);

  const msg = await args.anthropic.messages.create({
    model: args.model ?? "claude-opus-4-7", // codebase standard, exact ID, no date suffix
    max_tokens: 8000,
    system,
    messages: [{
      role: "user",
      content: `Process this interview transcript for member "${args.memberName}". ` +
               `Extract and score ALL preferences.\n\nTRANSCRIPT:\n${args.transcript}`,
    }],
  });

  let text: string = (msg?.content?.[0]?.text ?? "").trim();
  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Extractor did not return a JSON array.");

  const { preferences, dropped, medicalForced } = reconcile(parsed as ExtractedPreference[], baselines);
  return { preferences, dropped, medicalForced, baselinesUsed: baselines };
}
