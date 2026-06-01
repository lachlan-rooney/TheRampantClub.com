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
