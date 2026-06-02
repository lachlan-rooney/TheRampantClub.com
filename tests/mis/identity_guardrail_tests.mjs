// identity_guardrail_tests.mjs
// Identity-detector cases, mirroring medical_guardrail_tests.mjs in shape.
// The discipline: NARROW / UNDER-CATCH bias — locks are reserved for clear
// declarative identity/relationship facts. Emphasis, sentiment, incidental
// mention, and dietary identity (medical-precedence) must NOT lock here.
// Run:  node tests/mis/identity_guardrail_tests.mjs

const CASES = [
  // ── LOCKS — declarative identity/relationship facts ──
  ["20a. relationship + proper name: 'my wife Sophie'",
    {preference_name: "Wife — Sophie", verbatim_quote: "my wife Sophie", category: "Family & Personal", subcategory: "Spouse"}, true],
  ["20b. anniversary as declarative date: 'our anniversary is 14 October'",
    {preference_name: "Wedding anniversary", verbatim_quote: "our anniversary is 14 October", category: "Family & Personal"}, true],
  ["20c. declarative lifelong rule about events: 'I don't do birthdays'",
    {preference_name: "No birthday celebrations", verbatim_quote: "I don't do birthdays, I'll walk straight out", category: "Personal & Lifestyle"}, true],
  ["20d. heritage 'I'm Singaporean'",
    {preference_name: "Singaporean heritage", verbatim_quote: "I'm Singaporean", category: "Personal & Lifestyle"}, true],
  ["20e. heritage 'I'm Peranakan'",
    {preference_name: "Peranakan heritage", verbatim_quote: "I'm Peranakan", category: "Cultural & Intellectual"}, true],
  ["20f. relationship's identity attribute: 'my wife's birthday is the 14th'",
    {preference_name: "Wife's birthday", verbatim_quote: "my wife's birthday is the 14th", category: "Family & Personal"}, true],
  ["20g. relationship declarative: 'my father is Scottish'",
    {preference_name: "Father heritage", verbatim_quote: "my father is Scottish, from Glasgow", category: "Family & Personal"}, true],
  ["20h. religion declarative: 'I'm Muslim'",
    {preference_name: "Religious identity", verbatim_quote: "I'm Muslim, the faith I was raised in", category: "Personal & Lifestyle"}, true],
  ["20i. apostrophe-anniversary date: \"our anniversary's the fourteenth\"",
    {preference_name: "Anniversary", verbatim_quote: "our anniversary's the fourteenth of October", category: "Family & Personal"}, true],
  ["20j. wedding anniversary date: 'our wedding anniversary is March 5'",
    {preference_name: "Wedding anniversary", verbatim_quote: "our wedding anniversary is March 5", category: "Family & Personal"}, true],
  ["20k. relationship + name with 'late' modifier: 'my late uncle James'",
    {preference_name: "Family relation", verbatim_quote: "my late father James was a guide", category: "Family & Personal"}, true],
  ["20l. 'I'm from [Place]' heritage",
    {preference_name: "Origin", verbatim_quote: "I'm from Singapore originally", category: "Personal & Lifestyle"}, true],

  // ── DISQUALIFIER COMPOUND CASE (Trap-2 sharpening) ──
  ["22d. compound: father-possessive disqualified BUT independent anniversary phrase fires",
    {preference_name: "Anniversary date", verbatim_quote: "my late father's whisky was Laphroaig, and our anniversary is the 14th October", category: "Family & Personal"}, true],

  // ── MUST NOT LOCK (Trap 3 — emphasis ≠ identity, sentiment ≠ identity) ──
  ["21a. emphasis ≠ identity: 'I'm a peat man, always have been'",
    {preference_name: "Peated Islay whisky", verbatim_quote: "I'm a peat man. Always have been.", category: "Whisky & Beverage"}, false],
  ["21b. love/emphasis ≠ identity: 'I absolutely love this place'",
    {preference_name: "Club enthusiasm", verbatim_quote: "I absolutely love this place", category: "Social & Networking"}, false],
  ["21c. sentiment-anchored preference: 'Laphroaig, my late father's dram'",
    {preference_name: "Laphroaig", verbatim_quote: "My father drank Laphroaig — Laphroaig, my late father's dram, his study, eight years old again", category: "Whisky & Beverage"}, false],
  ["21d. preference about wife's drink: 'we have Bollinger on our anniversary'",
    {preference_name: "Wife's anniversary champagne", verbatim_quote: "we always have Bollinger on our anniversary", category: "Family & Personal"}, false],
  ["21e. taste preference using 'my wife' incidentally: 'my wife loves Bollinger'",
    {preference_name: "Champagne preference", verbatim_quote: "my wife loves Bollinger", category: "Family & Personal"}, false],
  ["21f. preference: 'I never drink gin' (NOT a declarative identity rule)",
    {preference_name: "Avoids gin", verbatim_quote: "I never drink gin", category: "Whisky & Beverage"}, false],
  ["21g. food preference: 'I love British food' (heritage noun in food context, not heritage claim)",
    {preference_name: "British classics", verbatim_quote: "I love British food", category: "Food & Beverage"}, false],
  ["21h. incidental wife mention: 'tennis with my wife on Sundays'",
    {preference_name: "Sunday tennis", verbatim_quote: "tennis with my wife on Sundays", category: "Personal & Lifestyle"}, false],
  ["21i. 'my father drank' — preference about father's habits, not heritage",
    {preference_name: "Family memory", verbatim_quote: "my father drank Laphroaig", category: "Whisky & Beverage"}, false],
  ["21j. 'I'm from a different generation' (not literal origin)",
    {preference_name: "Generational view", verbatim_quote: "I'm from a different generation", category: "Personal & Lifestyle"}, false],
  ["21k. taste preference 'this never changes for me' — not declarative-rule",
    {preference_name: "Permanent taste", verbatim_quote: "this never changes for me", category: "Whisky & Beverage"}, false],
  ["21l. 'I don't drink gin' — preference, NOT a declarative-event rule",
    {preference_name: "Gin avoidance", verbatim_quote: "I don't drink gin", category: "Whisky & Beverage"}, false],
];

let isIdentityPreference;
try {
  ({ isIdentityPreference } = await import("./identity-detect.mjs"));
} catch {
  console.error("identity-detect.mjs not found — place it alongside this test.");
  process.exit(2);
}

let pass = 0, fail = 0; const fails = [];
for (const [label, pref, expected] of CASES) {
  const got = isIdentityPreference(pref);
  if (got === expected) { pass++; console.log(`  ✓ ${label} → ${got ? "IDENTITY" : "ok"}`); }
  else { fail++; fails.push(label); console.log(`  ✗ FAIL ${label}: expected ${expected ? "IDENTITY" : "non-identity"}, got ${got ? "IDENTITY" : "non-identity"}`); }
}
console.log(`\n${pass}/${CASES.length} passed`);
if (fail) { console.log("FAILURES:", fails); process.exit(1); }
console.log("All identity-guardrail cases pass.");
