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

// 17. (Pass-B UPDATED) ai_permanent: rule-labels distinct from medical AND from
//     identity — uses a NON-IDENTITY AI-λ=0 row so the rule-label assertions
//     test the ai_permanent path specifically. The original "wife Sophie /
//     anniversary" input now routes to forced_identity (covered in case 12).
const aiPermanentForLabels: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Permanent taste preference",
  verbatim_quote: "this never changes for me, my whole life",
  s0: 4, confidence: 0.75, lambda: 0, frequency: 1.0,
  rationale: {
    summary: "AI's lifelong taste judgement",
    s0:      "AI's s0 reason (should be overridden, but different from medical AND identity)",
    c:       "AI's c reason (should be overridden)",
    lambda:  "AI's lambda reason (should be overridden)",
    f:       "every whisky occasion",
  },
}
const r17 = reconcile([aiPermanentForLabels], baselinesDayOne)
const p17 = r17.preferences[0]
check("17a. ai_permanent → λ rule-labelled mentioning identity/lifelong (NOT 'medical guardrail', NOT 'identity guardrail')",
  !!p17?.rationale?.lambda &&
    !p17.rationale.lambda.toLowerCase().includes("medical guardrail") &&
    !p17.rationale.lambda.toLowerCase().includes("identity guardrail") &&
    (p17.rationale.lambda.toLowerCase().includes("lifelong") || p17.rationale.lambda.toLowerCase().includes("identity")),
  `λ=${p17?.rationale?.lambda}`)
check("17b. ai_permanent → S₀ rule-labelled mentioning 'permanence' (not medical, not identity-guardrail)",
  !!p17?.rationale?.s0 &&
    !p17.rationale.s0.toLowerCase().includes("medical guardrail") &&
    !p17.rationale.s0.toLowerCase().includes("identity guardrail") &&
    p17.rationale.s0.toLowerCase().includes("permanence"),
  `s0=${p17?.rationale?.s0}`)
check("17c. ai_permanent → F is the AI's text (not overridden)",
  p17?.rationale?.f === "every whisky occasion",
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

// ── Cases 20-23: Pass-B Identity-Permanence Guardrail ────────────────
// Code-forced identity origin for declarative identity/relationship facts.
// NARROW / under-catch bias: locks only on clear identity statements.
// Precedence: MEDICAL > IDENTITY > AI_PERMANENT. F is never overridden.

// 20. LOCKS — clear declarative identity/relationship facts.
const idWifeSophie: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wife — Sophie",
  verbatim_quote: "my wife Sophie",
  s0: 4, confidence: 0.75, lambda: 0.002, frequency: 1.0,
}
const idAnniversaryDate: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wedding anniversary",
  verbatim_quote: "our anniversary is 14 October",
  s0: 4, confidence: 0.75, lambda: 0.002, frequency: 1.0,
}
const idNoBirthday: ExtractedPreference = {
  category: "Personal & Lifestyle",
  preference_name: "No birthday celebrations",
  verbatim_quote: "I don't do birthdays, I'll walk straight out",
  s0: 4, confidence: 0.75, lambda: 0.002, frequency: 1.0,
}
const idSingaporean: ExtractedPreference = {
  category: "Personal & Lifestyle",
  preference_name: "Singaporean heritage",
  verbatim_quote: "I'm Singaporean",
  s0: 3, confidence: 0.75, lambda: 0.005, frequency: 1.0,
}

const r20a = reconcile([idWifeSophie], baselinesDayOne)
check("20a. 'my wife Sophie' → forced_identity (λ=0/s0=5/c=1)",
  r20a.preferences[0]?.lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"])
    && r20a.preferences[0]?.lambda === 0 && r20a.preferences[0]?.s0 === 5 && r20a.preferences[0]?.confidence === 1.0,
  `origin=${r20a.preferences[0]?.lambda_origin} λ=${r20a.preferences[0]?.lambda} s0=${r20a.preferences[0]?.s0} c=${r20a.preferences[0]?.confidence}`)

const r20b = reconcile([idAnniversaryDate], baselinesDayOne)
check("20b. 'our anniversary is 14 October' → forced_identity",
  r20b.preferences[0]?.lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"])
    && r20b.preferences[0]?.lambda === 0,
  `origin=${r20b.preferences[0]?.lambda_origin} λ=${r20b.preferences[0]?.lambda}`)

const r20c = reconcile([idNoBirthday], baselinesDayOne)
check("20c. 'I don't do birthdays' declarative rule → forced_identity",
  r20c.preferences[0]?.lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"])
    && r20c.preferences[0]?.lambda === 0,
  `origin=${r20c.preferences[0]?.lambda_origin}`)

const r20d = reconcile([idSingaporean], baselinesDayOne)
check("20d. 'I'm Singaporean' heritage → forced_identity",
  r20d.preferences[0]?.lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"])
    && r20d.preferences[0]?.lambda === 0,
  `origin=${r20d.preferences[0]?.lambda_origin}`)

// 21. MUST NOT LOCK — Trap 3 — emphasis/sentiment ≠ identity.
const peatPreference: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Peated Islay whisky",
  verbatim_quote: "I'm a peat man. Always have been. Not negotiable.",
  s0: 5, confidence: 1.0, lambda: 0.002, frequency: 1.0,
}
const laphroaigSentiment: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Laphroaig",
  verbatim_quote: "Laphroaig, my late father's dram. His study. Eight years old again.",
  s0: 5, confidence: 1.0, lambda: 0.002, frequency: 1.0,
}
const lovePlace: ExtractedPreference = {
  category: "Social & Networking",
  preference_name: "Club enthusiasm",
  verbatim_quote: "I absolutely love this place",
  s0: 4, confidence: 0.75, lambda: 0.005, frequency: 1.0,
}

const r21a = reconcile([peatPreference], baselinesDayOne)
check("21a. 'I'm a peat man, always have been' → ai_specific (NOT identity)",
  r21a.preferences[0]?.lambda_origin === "ai_specific" && r21a.preferences[0]?.lambda === 0.002,
  `origin=${r21a.preferences[0]?.lambda_origin} λ=${r21a.preferences[0]?.lambda}`)

const r21b = reconcile([lovePlace], baselinesDayOne)
check("21b. 'I absolutely love this place' → ai_specific (NOT identity; emphasis ≠ identity)",
  r21b.preferences[0]?.lambda_origin === "ai_specific",
  `origin=${r21b.preferences[0]?.lambda_origin}`)

const r21c = reconcile([laphroaigSentiment], baselinesDayOne)
check("21c. 'Laphroaig, my late father's dram' → ai_specific λ=0.002 (sentiment ≠ identity)",
  r21c.preferences[0]?.lambda_origin === "ai_specific" && r21c.preferences[0]?.lambda === 0.002,
  `origin=${r21c.preferences[0]?.lambda_origin} λ=${r21c.preferences[0]?.lambda}`)

// 22. PRECEDENCE — Trap 2 — MEDICAL > IDENTITY > AI_PERMANENT.
const halalRow: ExtractedPreference = {
  category: "Food & Beverage",
  preference_name: "Halal only",
  verbatim_quote: "I keep halal",
  s0: 4, confidence: 1.0, lambda: 0.005, frequency: 1.0,
}
const identityWithAiZero: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wife Sophie",
  verbatim_quote: "my wife Sophie",
  s0: 5, confidence: 1.0, lambda: 0, frequency: 1.0, // AI also emitted λ=0
}
const tasteAiZero: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Permanent taste",
  verbatim_quote: "this never changes for me, has always been my drink",
  s0: 5, confidence: 1.0, lambda: 0, frequency: 1.0, // AI says permanent, no identity content
}

const r22a = reconcile([halalRow], baselinesDayOne)
check("22a. 'I keep halal' → forced_medical (medical precedence wins over identity)",
  r22a.preferences[0]?.lambda_origin === "forced_medical",
  `origin=${r22a.preferences[0]?.lambda_origin} (halal is a MEDICAL_STEM; identity never reached)`)

const r22b = reconcile([identityWithAiZero], baselinesDayOne)
check("22b. identity content + AI λ=0 → forced_identity (identity precedence wins over ai_permanent)",
  r22b.preferences[0]?.lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"]),
  `origin=${r22b.preferences[0]?.lambda_origin} (must NOT be ai_permanent)`)

const r22c = reconcile([tasteAiZero], baselinesDayOne)
check("22c. non-identity AI λ=0 (taste) → ai_permanent (residue path still works)",
  r22c.preferences[0]?.lambda_origin === "ai_permanent",
  `origin=${r22c.preferences[0]?.lambda_origin}`)

// 22d. Disqualifier doesn't over-negate — compound row: father-possessive
//      disqualifies the father stem, BUT independent anniversary phrase fires.
const compoundFather: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Anniversary date",
  verbatim_quote: "my late father's whisky was Laphroaig, and our anniversary is 14 October",
  s0: 4, confidence: 0.75, lambda: 0.002, frequency: 1.0,
}
const r22d = reconcile([compoundFather], baselinesDayOne)
check("22d. compound: father-possessive disqualified, anniversary still locks → forced_identity",
  r22d.preferences[0]?.lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"]),
  `origin=${r22d.preferences[0]?.lambda_origin} (anniversary phrase must fire independently of father-possessive)`)

// 22e. Disqualifier doesn't interact with medical — "my father's allergy"
//      hits the medical detector FIRST. Precedence makes identity irrelevant
//      here; this case proves the disqualifier can't open a medical gap.
const fathersAllergy: ExtractedPreference = {
  category: "Food & Beverage",
  preference_name: "Family allergy",
  verbatim_quote: "my father's allergy is severe",
  s0: 3, confidence: 0.5, lambda: 0.005, frequency: 1.0,
}
const r22e = reconcile([fathersAllergy], baselinesDayOne)
check("22e. 'my father's allergy' → forced_medical (medical fires first; identity disqualifier is irrelevant)",
  r22e.preferences[0]?.lambda_origin === "forced_medical",
  `origin=${r22e.preferences[0]?.lambda_origin} (proves the disqualifier can't open a medical hole)`)

// 23. Rule-label overrides for forced_identity (mirrors cases 16/17 for medical/permanent).
const idForLabels: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wife — Sophie",
  verbatim_quote: "my wife Sophie",
  s0: 4, confidence: 0.75, lambda: 0.002, frequency: 1.0,
  rationale: {
    summary: "AI summary",
    s0:      "AI's S₀ reason (should be overridden by identity rule label)",
    c:       "AI's C reason (should be overridden)",
    lambda:  "AI's λ reason (should be overridden)",
    f:       "applies whenever we're together",
  },
}
const r23 = reconcile([idForLabels], baselinesDayOne)
const p23 = r23.preferences[0]
check("23a. forced_identity → S₀ rule-labelled (contains 'identity')",
  !!p23?.rationale?.s0?.toLowerCase().includes("identity"),
  `s0=${p23?.rationale?.s0}`)
check("23b. forced_identity → C rule-labelled (contains 'identity')",
  !!p23?.rationale?.c?.toLowerCase().includes("identity"),
  `c=${p23?.rationale?.c}`)
check("23c. forced_identity → λ rule-labelled (contains 'identity' AND NOT 'medical guardrail')",
  !!p23?.rationale?.lambda?.toLowerCase().includes("identity") &&
    !p23?.rationale?.lambda?.toLowerCase().includes("medical guardrail"),
  `λ=${p23?.rationale?.lambda}`)
check("23d. forced_identity → F is the AI's text (not overridden)",
  p23?.rationale?.f === "applies whenever we're together",
  `f=${p23?.rationale?.f}`)
check("23e. identityForced counter increments for the forced_identity row",
  (r23 as unknown as { identityForced?: number }).identityForced === 1,
  `identityForced=${(r23 as unknown as { identityForced?: number }).identityForced}`)

// ── Cases 11-13: content-first precedence + ai_permanent (Pass-7 refinement) ─
// The medical guardrail has TWO triggers (content-detected + AI-emitted λ=0).
// Both still lock the row at λ=0 / s0=5 / c=1. The distinction is labelling:
//   - content-detected medical → forced_medical (the safety path; red badge)
//   - AI-emitted λ=0 WITHOUT medical content → ai_permanent (identity-permanence; gold badge)
// Precedence is content-first: a row that is BOTH content-medical AND AI-zeroed
// lands as forced_medical. ai_permanent only catches the residue.

// Pass-B note: this input contains BOTH "my wife — Sophie" and "our
// anniversary's the fourteenth of October" — two identity-triggering
// phrases. Post-Pass-B, this row resolves as forced_identity, not
// ai_permanent (case 12 below tests this transition explicitly). The
// pre-Pass-B value (ai_permanent) is preserved on a separate row used by
// cases 14a and 17 — those use a non-identity-triggering AI-λ=0 row.
const callumAnniversary: ExtractedPreference = {
  category: "Family & Personal",
  preference_name: "Wedding anniversary 14 October",
  detail: "marks every year with Sophie",
  verbatim_quote: "my wife — Sophie. Our anniversary's the fourteenth of October",
  s0: 5, confidence: 1.0, lambda: 0, frequency: 1.0,
}
// A non-identity AI-λ=0 row used for ai_permanent assertions post-Pass-B.
const nonIdentityAiZero: ExtractedPreference = {
  category: "Whisky & Beverage",
  preference_name: "Permanent taste preference",
  verbatim_quote: "this never changes for me, my whole life",
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

// Case 12 (Pass-B UPDATED): the Callum anniversary input now contains
// declarative identity content ("my wife — Sophie" + "our anniversary's the
// fourteenth of October") → forced_identity, not ai_permanent. Pass B
// extracts identity into a deterministic code-forced origin; ai_permanent
// now only catches AI-λ=0 residue without identity content (see case 22c).
const c12 = reconcile([callumAnniversary], baselinesDayOne)
check("12. (Pass-B) identity content + AI λ=0 → forced_identity (the new code-forced path)",
  c12.preferences.length === 1
    && c12.preferences[0].lambda_origin === ("forced_identity" as ReconciledPreference["lambda_origin"])
    && c12.preferences[0].lambda === 0
    && c12.preferences[0].s0 === 5
    && c12.preferences[0].confidence === 1.0,
  `origin=${c12.preferences[0]?.lambda_origin} λ=${c12.preferences[0]?.lambda} s0=${c12.preferences[0]?.s0} c=${c12.preferences[0]?.confidence}`)
// Companion: ai_permanent still fires for a non-identity AI-λ=0 row (residue path).
const c12residue = reconcile([nonIdentityAiZero], baselinesDayOne)
check("12-residue. non-identity AI λ=0 → ai_permanent (residue path intact)",
  c12residue.preferences[0]?.lambda_origin === "ai_permanent",
  `origin=${c12residue.preferences[0]?.lambda_origin}`)

// Case 13: precedence — both content-medical AND AI-zeroed → forced_medical wins.
// This is the case that PROVES the ordering is right.
const c13 = reconcile([epipenContentAndZero], baselinesDayOne)
check("13. both content-medical AND AI-zeroed → forced_medical (content-first precedence)",
  c13.preferences.length === 1 && c13.preferences[0].lambda_origin === "forced_medical",
  `origin=${c13.preferences[0]?.lambda_origin} — ai_permanent must NOT win when content also fires`)

// Case 14 (Pass-B UPDATED): mixed batch now contains [identity_anniversary,
// shellfish_allergy, epipen_with_aiZero]. Counters per origin:
//   medicalForced  = 2 (shellfish + epipen — both content-medical)
//   identityForced = 1 (anniversary — now code-forced identity)
//   aiPermanent    = 0 (epipen's AI-λ=0 was overridden by medical precedence)
const c14 = reconcile(
  [callumAnniversary, cases[0].input /* shellfish allergy */, epipenContentAndZero],
  baselinesDayOne
)
check("14a. medicalForced counts content-medical only (2 of 3 in mixed batch)",
  c14.medicalForced === 2,
  `got medicalForced=${c14.medicalForced} — expected 2 (shellfish + epipen both content-detected)`)
check("14b. (Pass-B) identityForced counts identity-detected only (1 of 3: anniversary)",
  (c14 as unknown as { identityForced?: number }).identityForced === 1,
  `got identityForced=${(c14 as unknown as { identityForced?: number }).identityForced} — expected 1 (anniversary now forced_identity)`)

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
