// closed-loop-demo.mts
// Closed-loop proof for MIS Pass 4.
//
// Demonstrates the seam: the SAME extracted preference set, reconciled twice
// against different baselines, yields different lambda_origin stamps because
// the system has "learned" a Whisky λ in between. This is the proof the loop
// closes — extraction inherits a rate the system itself learned.
//
// Run:  npx tsx tests/mis/closed-loop-demo.mts
//
// What's NOT demonstrated here: the live Anthropic API call. That is the
// streaming intake route's job. The reconcile + baseline-inheritance step is
// pure; running it twice with different baselines is structurally identical
// to running it twice in production with a real learned-λ promotion in between.
// The /api/admin/_debug/decay-demo endpoint provides the production-side
// counterpart (writes a fixture row), guarded behind MIS_DEMO_ENABLED=1.

import {
  reconcile,
  buildCategoryBaselines,
  type ExtractedPreference,
} from "../../lib/mis/extraction-decay.js";

// Fixed "extraction" output — what the AI would emit for a sample transcript
// containing one allergy (medical), one whisky preference with no specific λ
// (will inherit the baseline), and one whisky preference with a specific λ
// (the AI's signal). Designed so the BEFORE row 2 inherits the designed
// baseline and the AFTER row 2 inherits the learned baseline — that's the
// loop closing.
const extraction: ExtractedPreference[] = [
  {
    category: "Food & Beverage",
    preference_name: "Shellfish allergy",
    detail: "anaphylactic",
    verbatim_quote: "I can't have shellfish, my throat closes up",
    subcategory: "Allergy",
    s0: 4, confidence: 1.0, lambda: 0.005, frequency: 1.0,
  },
  {
    category: "Whisky & Beverage",
    preference_name: "Drinks neat",
    detail: "no ice, no water",
    verbatim_quote: "always neat, never bruise the dram",
    subcategory: "Service",
    s0: 4, confidence: 1.0, frequency: 1.0,
    // NB: no lambda — the AI didn't have a preference-specific signal, so it
    // omits the field. reconcile MUST fall through to the category baseline.
  },
  {
    category: "Whisky & Beverage",
    preference_name: "Springbank 15 anchor",
    detail: "long-standing favourite with personal story",
    verbatim_quote: "Springbank 15 reminds me of my father's study",
    subcategory: "Specific bottle",
    s0: 5, confidence: 1.0, lambda: 0.002, frequency: 0.8,
  },
];

// BEFORE: no learned λ yet — every category falls through to designed.
const baselinesBefore = buildCategoryBaselines({});

// AFTER: simulates an accepted Whisky λ proposal. The /admin/decay-fit accept
// path or the dev fixture endpoint writes status='active' to learned_decay_constants;
// getActiveLearnedLambda then returns this map; buildCategoryBaselines stamps
// source='learned' for Whisky. (Picking 0.002 — slower than the designed 0.005 —
// because that's what the modal real distribution actually says for the
// canonical-9 categories that have moved.)
const baselinesAfter = buildCategoryBaselines({ "Whisky & Beverage": 0.002 });

const before = reconcile(extraction, baselinesBefore);
const after  = reconcile(extraction, baselinesAfter);

const W = (s: string, n: number) => (s + " ".repeat(Math.max(0, n - s.length))).slice(0, n);
const fmtLam = (l: number) => l.toFixed(4);

console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("MIS Pass 4 — closed-loop before/after demonstration");
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("");
console.log("Sample transcript yields 3 preferences:");
console.log("  1. shellfish allergy (medical signal in quote)");
console.log("  2. Whisky 'drinks neat'  (NO AI-specific λ → must inherit baseline)");
console.log("  3. Whisky Springbank 15  (AI-specific λ=0.002)");
console.log("");
console.log("BEFORE: no learned λ promoted — Whisky baseline source = designed (0.005)");
console.log("AFTER:  learned Whisky λ promoted at 0.002 — baseline source = learned");
console.log("");
console.log(W("Row", 4) + W("Category", 20) + W("Name", 28)
  + W("λ before", 10) + W("origin before", 30)
  + W("λ after",  10) + W("origin after",  30) + "Δ");
console.log("─".repeat(140));

for (let i = 0; i < before.preferences.length; i++) {
  const b = before.preferences[i];
  const a = after.preferences[i];
  const delta = (b.lambda === a.lambda && b.lambda_origin === a.lambda_origin) ? "—" : "← FLIPPED";
  console.log(
    W(`${i + 1}`, 4) +
    W(b.category, 20) +
    W(b.preference_name, 28) +
    W(fmtLam(b.lambda), 10) +
    W(b.lambda_origin, 30) +
    W(fmtLam(a.lambda), 10) +
    W(a.lambda_origin, 30) +
    delta
  );
}

console.log("");
console.log("Summary:");
console.log(`  before: medicalForced=${before.medicalForced}, dropped=${before.dropped.length}, kept=${before.preferences.length}`);
console.log(`  after:  medicalForced=${after.medicalForced}, dropped=${after.dropped.length}, kept=${after.preferences.length}`);
console.log("");

// Assert the loop closed — row 2 must have flipped.
const row2 = { before: before.preferences[1], after: after.preferences[1] };
const closed =
  row2.before.lambda_origin === "category_baseline_designed" &&
  row2.before.lambda          === 0.005 &&
  row2.after.lambda_origin  === "category_baseline_learned"  &&
  row2.after.lambda           === 0.002;

if (!closed) {
  console.error("LOOP DID NOT CLOSE — row 2 did not flip designed→learned. Aborting.");
  process.exit(1);
}

// Assert the medical lock survived both runs unchanged.
const med = { before: before.preferences[0], after: after.preferences[0] };
const medOk = med.before.lambda_origin === "forced_medical" && med.after.lambda_origin === "forced_medical";
if (!medOk) {
  console.error("MEDICAL LOCK DID NOT HOLD — allergy row was not forced. Aborting.");
  process.exit(1);
}

// Assert the AI-specific row stays AI-specific in both runs.
const ai = { before: before.preferences[2], after: after.preferences[2] };
const aiOk = ai.before.lambda_origin === "ai_specific" && ai.after.lambda_origin === "ai_specific"
  && ai.before.lambda === 0.002 && ai.after.lambda === 0.002;
if (!aiOk) {
  console.error("AI-SPECIFIC ROW DRIFTED — should be ai_specific in both runs. Aborting.");
  process.exit(1);
}

console.log("✓ Row 2 (Whisky, no AI λ) flipped designed→learned. The loop closed.");
console.log("✓ Row 1 (allergy) stayed forced_medical in both runs. Lock survived.");
console.log("✓ Row 3 (AI-specific Whisky) stayed ai_specific in both runs. Specific signal preserved.");
console.log("");
console.log("This is the demonstration that extraction inherits a rate the cron learned.");
