// reconcile.test.mts
// 10-case regression suite for the reconcile guardrail in extraction-decay.ts.
// Imports the REAL exported reconcile via tsx — does NOT re-implement the logic.
// Run:  npx tsx tests/mis/reconcile.test.mts
//
// Cases mirror the Pass-4 spec:
//   1. exactly 9 canonical categories present; Family & Personal in; Health & Safety out
//   2. allergy in Food & Beverage → forced_medical
//   3. EpiPen in Wellness & Comfort → forced_medical
//   4. halal dietary rule → forced_medical
//   5. confident genuine whisky preference with specific lambda → ai_specific (NOT forced)
//   6. "medicinal" whisky tasting note → NOT forced (the trap)
//   7. missing lambda → category baseline (learned if active for category, else designed)
//   8. Family & Personal survives reconciliation
//   9. "Health & Safety" category emitted by model → dropped as non-canonical
//  10. medicalForced counts correctly

import {
  reconcile,
  buildCategoryBaselines,
  CANONICAL_CATEGORIES,
  DESIGNED_LAMBDA,
  type ExtractedPreference,
  type ReconciledPreference,
} from "../../lib/mis/extraction-decay.js";

let pass = 0, fail = 0;
const fails: string[] = [];

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    fails.push(label);
    console.log(`  ✗ FAIL ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

// ── Case 1: canonical categories ─────────────────────────────────────
const cats = CANONICAL_CATEGORIES.slice().sort();
check("1a. exactly 9 canonical categories", cats.length === 9, `got ${cats.length}: ${cats.join(", ")}`);
check("1b. Family & Personal present", cats.includes("Family & Personal"));
check("1c. Health & Safety absent",   !cats.includes("Health & Safety"));
check("1d. Family & Personal designed = 0.002", DESIGNED_LAMBDA["Family & Personal"] === 0.002);

// Build the day-one baselines (empty learned map → all designed).
const baselinesDayOne = buildCategoryBaselines({});

// Build a "Whisky learned" baselines: simulates a promoted learned λ for Whisky.
const baselinesWhiskyLearned = buildCategoryBaselines({ "Whisky & Beverage": 0.002 });

// ── Cases 2-9: per-row reconciliation ────────────────────────────────
const cases: Array<{
  label: string;
  input: ExtractedPreference;
  baselines: ReturnType<typeof buildCategoryBaselines>;
  expectKept: boolean;
  expectOrigin?: "ai_specific" | "category_baseline_learned" | "category_baseline_designed" | "forced_medical";
  expectLambda?: number;
  expectS0?: number;
  expectConfidence?: number;
}> = [
  {
    label: "2. casual allergy in Food & Beverage → forced_medical",
    input: {
      category: "Food & Beverage",
      preference_name: "Avoids shellfish",
      detail: "Won't order it",
      verbatim_quote: "I'm a bit sensitive to shellfish, brings me out in hives",
      subcategory: "Seafood",
      s0: 3, confidence: 0.75, lambda: 0.005, frequency: 1.0,
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "forced_medical",
    expectLambda: 0, expectS0: 5, expectConfidence: 1.0,
  },
  {
    label: "3. EpiPen in Wellness & Comfort → forced_medical",
    input: {
      category: "Wellness & Comfort",
      preference_name: "Peanut allergy",
      verbatim_quote: "carries an EpiPen",
      subcategory: "Allergy",
      s0: 4, confidence: 1.0, lambda: 0.002, frequency: 1.0,
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "forced_medical",
    expectLambda: 0, expectS0: 5, expectConfidence: 1.0,
  },
  {
    label: "4. halal dietary rule → forced_medical",
    input: {
      category: "Food & Beverage",
      preference_name: "Halal only",
      detail: "observant Muslim",
      verbatim_quote: "I only eat halal",
      s0: 5, confidence: 1.0, lambda: 0.002, frequency: 1.0,
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "forced_medical",
    expectLambda: 0,
  },
  {
    label: "5. confident genuine whisky pref with specific λ → ai_specific (NOT forced)",
    input: {
      category: "Whisky & Beverage",
      preference_name: "Springbank 15",
      detail: "long-standing favourite, story attached",
      verbatim_quote: "Springbank 15 takes me back to my dad's study, it's the dram",
      s0: 5, confidence: 1.0, lambda: 0.002, frequency: 1.0,
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "ai_specific",
    expectLambda: 0.002,
  },
  {
    label: "6. 'medicinal' whisky tasting note → NOT forced (the trap)",
    input: {
      category: "Whisky & Beverage",
      preference_name: "Dislikes heavy peat",
      detail: "prefers Speyside",
      verbatim_quote: "I'm not a fan of really peaty drams, too medicinal for me",
      subcategory: "Flavour",
      s0: 4, confidence: 0.75, lambda: 0.005, frequency: 1.0,
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "ai_specific",
    expectLambda: 0.005,
  },
  {
    label: "7a. missing λ on day-one → category_baseline_designed",
    input: {
      category: "Whisky & Beverage",
      preference_name: "Drinks neat",
      detail: "never with ice",
      verbatim_quote: "always neat for me",
      s0: 4, confidence: 1.0, frequency: 1.0,
      // lambda omitted
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "category_baseline_designed",
    expectLambda: 0.005,  // designed for Whisky & Beverage
  },
  {
    label: "7b. missing λ with learned baseline → category_baseline_learned",
    input: {
      category: "Whisky & Beverage",
      preference_name: "Drinks neat",
      detail: "never with ice",
      verbatim_quote: "always neat for me",
      s0: 4, confidence: 1.0, frequency: 1.0,
      // lambda omitted
    },
    baselines: baselinesWhiskyLearned,
    expectKept: true, expectOrigin: "category_baseline_learned",
    expectLambda: 0.002,  // promoted learned value
  },
  {
    label: "8. Family & Personal preference survives reconciliation",
    input: {
      category: "Family & Personal",
      preference_name: "Wife's anniversary champagne",
      detail: "Bollinger Grande Année",
      verbatim_quote: "we always have Bollinger on our anniversary",
      s0: 5, confidence: 1.0, lambda: 0.002, frequency: 0.8,
    },
    baselines: baselinesDayOne,
    expectKept: true, expectOrigin: "ai_specific",
    expectLambda: 0.002,
  },
  {
    label: "9. 'Health & Safety' category emitted by model → DROPPED as non-canonical",
    input: {
      category: "Health & Safety",
      preference_name: "Severe nut allergy",
      detail: "carries an EpiPen",
      verbatim_quote: "anaphylactic to peanuts",
      s0: 5, confidence: 1.0, lambda: 0.0, frequency: 1.0,
    },
    baselines: baselinesDayOne,
    expectKept: false,
  },
];

for (const c of cases) {
  const result = reconcile([c.input], c.baselines);
  if (!c.expectKept) {
    check(c.label, result.preferences.length === 0 && result.dropped.length === 1,
      `expected 1 dropped, got kept=${result.preferences.length} dropped=${result.dropped.length}`);
    continue;
  }
  if (result.preferences.length !== 1) {
    check(c.label, false, `expected 1 kept, got ${result.preferences.length} (dropped=${result.dropped.length})`);
    continue;
  }
  const p = result.preferences[0];
  const conditions: string[] = [];
  if (c.expectOrigin && p.lambda_origin !== c.expectOrigin) conditions.push(`origin=${p.lambda_origin} (want ${c.expectOrigin})`);
  if (c.expectLambda != null && Math.abs(p.lambda - c.expectLambda) > 1e-9) conditions.push(`lambda=${p.lambda} (want ${c.expectLambda})`);
  if (c.expectS0 != null && p.s0 !== c.expectS0) conditions.push(`s0=${p.s0} (want ${c.expectS0})`);
  if (c.expectConfidence != null && p.confidence !== c.expectConfidence) conditions.push(`C=${p.confidence} (want ${c.expectConfidence})`);
  check(c.label, conditions.length === 0, conditions.join("; "));
}

// ── Case 15: rationale passthrough (probe-mode field) ───────────────
// reconcile must copy an AI-provided rationale through verbatim, and must
// pass empty-string when the input has no rationale. The field is text only;
// it must NOT influence any scoring decision.
const withRationale: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Peat preference",
  detail: "Islay regulars",
  verbatim_quote: "I'm a peat man, always have been",
  s0: 5, confidence: 1.0, lambda: 0.002, frequency: 1.0,
  rationale: "emphatic + repeated + tied to father → high importance, slow decay",
}
const withoutRationale: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Sherry-cask kick",
  verbatim_quote: "might've moved on entirely",
  s0: 3, confidence: 0.5, lambda: 0.020, frequency: 1.0,
  // no rationale field
}
const r15 = reconcile([withRationale, withoutRationale], baselinesDayOne)
// Pass-A refresh: rationale is now an OBJECT with optional per-factor fields.
// Legacy string input normalises to { summary: <string> } — the back-compat
// path the analyser's drill-down reads through.
check("15a. rationale.summary carries through when AI provides a string (back-compat)",
  r15.preferences[0]?.rationale?.summary === "emphatic + repeated + tied to father → high importance, slow decay",
  `got: "${r15.preferences[0]?.rationale?.summary}"`)
check("15b. empty rationale object when AI omits the field (no rules applied)",
  r15.preferences[1]?.rationale && Object.keys(r15.preferences[1].rationale).filter(k => (r15.preferences[1].rationale as Record<string, unknown>)[k] !== undefined).length === 0,
  `got: ${JSON.stringify(r15.preferences[1]?.rationale)}`)
check("15c. rationale does NOT influence scoring — S₀/C/λ unchanged",
  r15.preferences[0]?.s0 === 5 && r15.preferences[0]?.confidence === 1.0 && r15.preferences[0]?.lambda === 0.002,
  `s0=${r15.preferences[0]?.s0} c=${r15.preferences[0]?.confidence} λ=${r15.preferences[0]?.lambda}`)

// ── Cases 16-19: rule-label overrides per lambda_origin ──────────────
// reconcile applies deterministic rule labels on factors the AI didn't choose.
// Asking the AI to explain a value the code set would produce plausible but
// FALSE prose — these tests prove the override happens correctly.

// 16. forced_medical: S₀, C, λ all rule-labelled — F stays AI.
const allergyForLabels: ExtractedPreference = {
  category: "Food & Beverage",
  preference_name: "Shellfish allergy",
  verbatim_quote: "throat closes up — I carry an EpiPen",
  s0: 3, confidence: 0.75, lambda: 0.005, frequency: 1.0,
  rationale: {
    summary: "AI thinks this is just a strong dislike",
    s0:      "AI's s0 reason (should be overridden)",
    c:       "AI's c reason (should be overridden)",
    lambda:  "AI's lambda reason (should be overridden)",
    f:       "applies whenever dining",
  },
}
const r16 = reconcile([allergyForLabels], baselinesDayOne)
const p16 = r16.preferences[0]
check("16a. forced_medical → S₀ rule-labelled (contains 'medical guardrail')",
  !!p16?.rationale?.s0?.toLowerCase().includes("medical guardrail"),
  `s0=${p16?.rationale?.s0}`)
check("16b. forced_medical → C rule-labelled (contains 'medical guardrail')",
  !!p16?.rationale?.c?.toLowerCase().includes("medical guardrail"),
  `c=${p16?.rationale?.c}`)
check("16c. forced_medical → λ rule-labelled (contains 'medical guardrail')",
  !!p16?.rationale?.lambda?.toLowerCase().includes("medical guardrail"),
  `λ=${p16?.rationale?.lambda}`)
check("16d. forced_medical → F is the AI's text (not overridden)",
  p16?.rationale?.f === "applies whenever dining",
  `f=${p16?.rationale?.f}`)

// 17. ai_permanent: S₀, C, λ all rule-labelled (distinct from medical) — F stays AI.
const anniversaryForLabels: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wedding anniversary 14 October",
  verbatim_quote: "wife Sophie, our anniversary's the fourteenth of October",
  s0: 4, confidence: 0.75, lambda: 0, frequency: 1.0,
  rationale: {
    summary: "identity-level family fact",
    s0:      "AI's s0 reason (should be overridden, but different from medical)",
    c:       "AI's c reason (should be overridden)",
    lambda:  "AI's lambda reason (should be overridden)",
    f:       "annual, applies once a year",
  },
}
const r17 = reconcile([anniversaryForLabels], baselinesDayOne)
const p17 = r17.preferences[0]
check("17a. ai_permanent → λ rule-labelled mentioning identity/lifelong (NOT 'medical guardrail')",
  !!p17?.rationale?.lambda &&
    !p17.rationale.lambda.toLowerCase().includes("medical guardrail") &&
    (p17.rationale.lambda.toLowerCase().includes("lifelong") || p17.rationale.lambda.toLowerCase().includes("identity")),
  `λ=${p17?.rationale?.lambda}`)
check("17b. ai_permanent → S₀ rule-labelled (permanence lock, not medical)",
  !!p17?.rationale?.s0 &&
    !p17.rationale.s0.toLowerCase().includes("medical guardrail") &&
    p17.rationale.s0.toLowerCase().includes("permanence"),
  `s0=${p17?.rationale?.s0}`)
check("17c. ai_permanent → F is the AI's text (not overridden)",
  p17?.rationale?.f === "annual, applies once a year",
  `f=${p17?.rationale?.f}`)

// 18. category_baseline_designed: λ rule-labelled (inherited); S₀, C, F all AI.
const baselineAi: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Drinks neat by default",
  verbatim_quote: "always neat",
  s0: 4, confidence: 1.0, frequency: 1.0,
  // no lambda → baseline fallback
  rationale: {
    s0:      "'always' → strong rule",
    c:       "explicit, no hedge",
    f:       "interview baseline",
  },
}
const r18 = reconcile([baselineAi], baselinesDayOne)
const p18 = r18.preferences[0]
check("18a. category_baseline_designed → λ rule-labelled mentioning 'inherited' and the baseline",
  !!p18?.rationale?.lambda && p18.rationale.lambda.toLowerCase().includes("inherited"),
  `λ=${p18?.rationale?.lambda}`)
check("18b. category_baseline_designed → S₀ stays AI prose ('always' → strong rule)",
  p18?.rationale?.s0 === "'always' → strong rule",
  `s0=${p18?.rationale?.s0}`)
check("18c. category_baseline_designed → C stays AI prose",
  p18?.rationale?.c === "explicit, no hedge",
  `c=${p18?.rationale?.c}`)
check("18d. category_baseline_designed → F stays AI prose",
  p18?.rationale?.f === "interview baseline",
  `f=${p18?.rationale?.f}`)

// 19. ai_specific: nothing overridden, every factor stays AI.
const aiSpecific: ExtractedPreference = {
  category: "Food & Beverage",
  preference_name: "Loves spicy",
  verbatim_quote: "the spicier the better",
  s0: 4, confidence: 1.0, lambda: 0.005, frequency: 1.0,
  rationale: {
    s0:      "strong positive 'loves'",
    c:       "explicit, no hedge",
    lambda:  "established taste, baseline F&B decay",
    f:       "interview baseline",
  },
}
const r19 = reconcile([aiSpecific], baselinesDayOne)
const p19 = r19.preferences[0]
check("19. ai_specific → all four factor rationales kept verbatim (no overrides)",
  p19?.rationale?.s0     === "strong positive 'loves'" &&
  p19?.rationale?.c      === "explicit, no hedge" &&
  p19?.rationale?.lambda === "established taste, baseline F&B decay" &&
  p19?.rationale?.f      === "interview baseline",
  `got: ${JSON.stringify(p19?.rationale)}`)

// ── Cases 11-13: content-first precedence + ai_permanent (Pass-7 refinement) ─
// The medical guardrail has TWO triggers (content-detected + AI-emitted λ=0).
// Both still lock the row at λ=0 / s0=5 / c=1. The distinction is labelling:
//   - content-detected medical → forced_medical (the safety path; red badge)
//   - AI-emitted λ=0 WITHOUT medical content → ai_permanent (identity-permanence; gold badge)
// Precedence is content-first: a row that is BOTH content-medical AND AI-zeroed
// lands as forced_medical. ai_permanent only catches the residue.

const callumAnniversary: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wedding anniversary 14 October",
  detail: "marks every year with Sophie",
  verbatim_quote: "my wife — Sophie. Our anniversary's the fourteenth of October",
  s0: 5, confidence: 1.0, lambda: 0, frequency: 1.0,
}
const epipenContentAndZero: ExtractedPreference = {
  // Both content-medical (EpiPen, allergy in detail) AND AI-emitted λ=0 — must land forced_medical.
  category: "Wellness & Comfort",
  preference_name: "Peanut allergy",
  detail: "anaphylactic — carries an EpiPen",
  verbatim_quote: "I'm allergic to peanuts, carry an EpiPen",
  s0: 5, confidence: 1.0, lambda: 0, frequency: 1.0,
}

// Case 11: safety path intact — content-detected allergy with AI λ=0.005 still locks forced_medical.
const c11 = reconcile([cases[0].input /* shellfish allergy, λ=0.005 in input */], baselinesDayOne)
check("11. content-detected allergy (AI λ=0.005) → forced_medical (safety path untouched)",
  c11.preferences.length === 1 && c11.preferences[0].lambda_origin === "forced_medical",
  `origin=${c11.preferences[0]?.lambda_origin}`)

// Case 12: identity-permanence — AI emitted λ=0 on non-medical content → ai_permanent.
const c12 = reconcile([callumAnniversary], baselinesDayOne)
check("12. identity λ=0 on non-medical (anniversary) → ai_permanent (gold lock, not red)",
  c12.preferences.length === 1
    && c12.preferences[0].lambda_origin === ("ai_permanent" as ReconciledPreference["lambda_origin"])
    && c12.preferences[0].lambda === 0
    && c12.preferences[0].s0 === 5
    && c12.preferences[0].confidence === 1.0,
  `origin=${c12.preferences[0]?.lambda_origin} λ=${c12.preferences[0]?.lambda} s0=${c12.preferences[0]?.s0} c=${c12.preferences[0]?.confidence}`)

// Case 13: precedence — both content-medical AND AI-zeroed → forced_medical wins.
// This is the case that PROVES the ordering is right.
const c13 = reconcile([epipenContentAndZero], baselinesDayOne)
check("13. both content-medical AND AI-zeroed → forced_medical (content-first precedence)",
  c13.preferences.length === 1 && c13.preferences[0].lambda_origin === "forced_medical",
  `origin=${c13.preferences[0]?.lambda_origin} — ai_permanent must NOT win when content also fires`)

// Case 14: counter — medicalForced counts only content-medical fires; ai_permanent is separate.
const c14 = reconcile(
  [callumAnniversary, cases[0].input /* shellfish allergy */, epipenContentAndZero],
  baselinesDayOne
)
check("14a. medicalForced counts content-medical only (2 of 3 in mixed batch)",
  c14.medicalForced === 2,
  `got medicalForced=${c14.medicalForced} — expected 2 (shellfish + epipen both content-detected)`)

// ── Case 10: medicalForced counts correctly over a mixed batch ───────
const batch: ExtractedPreference[] = [
  { category: "Food & Beverage", preference_name: "Shellfish allergy",
    verbatim_quote: "anaphylactic to shellfish", s0: 5, confidence: 1.0, lambda: 0.0, frequency: 1.0 },
  { category: "Wellness & Comfort", preference_name: "Halal only",
    verbatim_quote: "I only eat halal", s0: 5, confidence: 1.0, lambda: 0.0, frequency: 1.0 },
  { category: "Whisky & Beverage", preference_name: "Likes Speyside",
    verbatim_quote: "Speyside over Islay any day", s0: 4, confidence: 1.0, lambda: 0.005, frequency: 1.0 },
  { category: "Cultural & Intellectual", preference_name: "Jazz",
    verbatim_quote: "always jazz in the background", s0: 3, confidence: 0.75, lambda: 0.005, frequency: 1.0 },
  { category: "Health & Safety", preference_name: "Bad knee",
    verbatim_quote: "old rugby injury", s0: 3, confidence: 0.75, lambda: 0.002, frequency: 1.0 },
];
const batchResult = reconcile(batch, baselinesDayOne);
check("10a. medicalForced = 2 in mixed batch",
  batchResult.medicalForced === 2,
  `got ${batchResult.medicalForced}`);
check("10b. dropped = 1 (Health & Safety non-canonical)",
  batchResult.dropped.length === 1 && batchResult.dropped[0].reason.includes("Health & Safety"),
  `got ${batchResult.dropped.length} dropped: ${JSON.stringify(batchResult.dropped.map(d => d.reason))}`);
check("10c. kept = 4 (5 raw - 1 dropped)",
  batchResult.preferences.length === 4,
  `got ${batchResult.preferences.length}`);

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${pass}/${pass + fail} passed`);
if (fail) { console.log("FAILURES:", fails); process.exit(1); }
console.log("All reconcile regression cases pass.");
