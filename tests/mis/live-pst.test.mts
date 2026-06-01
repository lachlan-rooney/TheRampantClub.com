// live-pst.test.mts
// Bound to the REAL exported functions in lib/mis/live-pst.ts via tsx — does NOT
// re-implement the formulas. Same 18 assertions as the user's sandbox harness;
// running them against the real module proves the live PS(t) used in the
// Observatory equals the preference_scores SQL view it claims to mirror.
// Run:  npx tsx tests/mis/live-pst.test.mts

import {
  reinforcement,
  engagement,
  daysSinceInteger,
  computePSt,
  decayFactor,
} from "../../lib/mis/live-pst.js";

let pass = 0, fail = 0;
const fails: string[] = [];

function ck(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; fails.push(label); console.log(`  ✗ FAIL ${label}${detail ? `\n      ${detail}` : ""}`); }
}
const approx = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;

console.log("TEST — R (reinforcement)");
ck("vc=1 → 1.0", reinforcement(1) === 1.0);
ck("vc=4 → 1.225", approx(reinforcement(4), 1.225));
ck("vc=5 → 1.3 (cap)", reinforcement(5) === 1.3);
ck("vc=100 → 1.3 (cap holds)", reinforcement(100) === 1.3);

console.log("\nTEST — M (engagement)");
ck("no visits → 1.0", engagement(null) === 1.0 && engagement(undefined) === 1.0);
ck("1/mo → 1.0 neutral", engagement(1) === 1.0);
ck("2/mo → 1.25", approx(engagement(2), 1.25));
ck("3/mo → 1.5 cap", engagement(3) === 1.5);
ck("lapsed 0.2/mo → 0.8 floor", engagement(0.2) === 0.8);

console.log("\nTEST — integer days match CURRENT_DATE − last_validated");
ck("same day → 0", daysSinceInteger("2026-06-01", new Date("2026-06-01T23:00:00Z")) === 0);
ck("90 days", daysSinceInteger("2026-03-03", new Date("2026-06-01T00:00:00Z")) === 90);

console.log("\nTEST — full PS(t) matches hand calc, NEW preference (R=M=1)");
{
  const r = computePSt(
    { s0: 4, confidence: 1.0, lambda: 0.002, frequency: 1.0, validationCount: 1, lastValidatedISO: "2026-05-02" },
    {},
    new Date("2026-06-01T00:00:00Z")
  );
  const hand = 4 * 1.0 * decayFactor(0.002, 30) * 1.0 * 1.0 * 1.0;
  ck("days=30", r.daysSince === 30);
  ck("R=1, M=1 for new pref", r.reinforcement === 1.0 && r.engagement === 1.0);
  ck("pst matches hand calc", approx(r.pst, hand));
  console.log(`    pst=${r.pst.toFixed(4)}  (hand ${hand.toFixed(4)})  decay=${r.decay.toFixed(4)}`);
}

console.log("\nTEST — amplifiers can lift a moderate pref, cap binds at 5");
{
  const r = computePSt(
    { s0: 4, confidence: 1.0, lambda: 0.002, frequency: 1.5, validationCount: 5, lastValidatedISO: "2026-05-22" },
    { avgVisitsPerMonth: 3 },
    new Date("2026-06-01T00:00:00Z")
  );
  const raw = 4 * 1.0 * decayFactor(0.002, 10) * 1.5 * 1.3 * 1.5;
  ck("raw exceeds 5", raw > 5);
  ck("pst capped at exactly 5", r.pst === 5 && r.capped === true);
  console.log(`    raw=${raw.toFixed(3)} → capped pst=${r.pst}`);
}

console.log("\nTEST — medical (λ=0) never decays");
{
  const r = computePSt(
    { s0: 5, confidence: 1.0, lambda: 0.0, frequency: 1.5, validationCount: 1, lastValidatedISO: "2020-01-01" },
    {},
    new Date("2026-06-01T00:00:00Z")
  );
  ck("decay factor = 1 after years", r.decay === 1.0);
  ck("pst = min(5, 5·1·1·1.5·1·1) = 5", r.pst === 5);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:", fails); process.exit(1); }
console.log("All live-pst cases pass.");
