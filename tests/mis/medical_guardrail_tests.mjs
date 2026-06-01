// medical_guardrail_tests.mjs
// TEST-FIRST guardrail cases. Fail-safe: any medical signal → must force.
// Only the explicitly-non-medical controls (last block) may return false.
// Run:  node tests/mis/medical_guardrail_tests.mjs   (expects medical-detect.mjs alongside)

const CASES = [
  ["casual shellfish allergy, keyword in quote only",
    {category:"Food & Beverage", preference_name:"Avoids shellfish", detail:"Won't order it",
     verbatim_quote:"I'm a bit sensitive to shellfish, brings me out in hives", subcategory:"Seafood"}, true],
  ["explicit allergy in name",
    {category:"Wellness & Comfort", preference_name:"Peanut allergy", detail:"Severe",
     verbatim_quote:"carries an EpiPen", subcategory:"Allergy"}, true],
  ["anaphylaxis phrasing, no 'allergy' word",
    {category:"Personal & Lifestyle", preference_name:"Reacts to bee stings", detail:"anaphylactic",
     verbatim_quote:"if I get stung I go into anaphylactic shock", subcategory:""}, true],
  ["coeliac / gluten medical (not preference)",
    {category:"Food & Beverage", preference_name:"Gluten-free", detail:"coeliac disease",
     verbatim_quote:"I'm coeliac, even a trace makes me ill", subcategory:"Dietary"}, true],
  ["religious dietary rule — halal",
    {category:"Food & Beverage", preference_name:"Halal only", detail:"observant Muslim",
     verbatim_quote:"I only eat halal", subcategory:"Dietary restriction"}, true],
  ["religious dietary rule — kosher",
    {category:"Food & Beverage", preference_name:"Keeps kosher", detail:"",
     verbatim_quote:"we keep kosher at home and when out", subcategory:"Dietary"}, true],
  ["lactose intolerance",
    {category:"Food & Beverage", preference_name:"No dairy", detail:"lactose intolerant",
     verbatim_quote:"dairy upsets my stomach, I'm lactose intolerant", subcategory:""}, true],
  ["medication interaction (avoid grapefruit)",
    {category:"Food & Beverage", preference_name:"No grapefruit", detail:"interferes with medication",
     verbatim_quote:"my doctor said grapefruit interferes with my heart medication", subcategory:""}, true],
  ["nut intolerance phrased as 'can't have'",
    {category:"Food & Beverage", preference_name:"Avoids tree nuts", detail:"",
     verbatim_quote:"I can't have tree nuts, my throat closes up", subcategory:""}, true],
  ["pregnancy — avoid alcohol (medical-temporary)",
    {category:"Wellness & Comfort", preference_name:"No alcohol currently", detail:"pregnant",
     verbatim_quote:"I'm pregnant so no alcohol for now", subcategory:""}, true],

  // ── MUST-NOT-trigger controls ──
  ["dislikes peat — taste, 'medicinal' is a tasting note",
    {category:"Whisky & Beverage", preference_name:"Dislikes heavy peat", detail:"prefers Speyside",
     verbatim_quote:"I'm not a fan of really peaty drams, too medicinal for me", subcategory:"Flavour"}, false],
  ["prefers sparkling water — preference",
    {category:"Food & Beverage", preference_name:"Sparkling water", detail:"Perrier",
     verbatim_quote:"always sparkling, never still", subcategory:"Water"}, false],
  ["corner seat — environment preference",
    {category:"Social & Networking", preference_name:"Corner table", detail:"back to wall",
     verbatim_quote:"I like the corner booth so I can see the room", subcategory:"Seating"}, false],
  ["likes spicy food — taste",
    {category:"Food & Beverage", preference_name:"Loves spice", detail:"very high tolerance",
     verbatim_quote:"the spicier the better", subcategory:"Taste"}, false],
  ["'healthy' eating as lifestyle, not medical",
    {category:"Wellness & Comfort", preference_name:"Eats light", detail:"health-conscious",
     verbatim_quote:"I try to eat healthy, lots of greens", subcategory:""}, false],
];

let isMedicalPreference;
try {
  ({ isMedicalPreference } = await import("./medical-detect.mjs"));
} catch {
  console.error("medical-detect.mjs not found — place it alongside this test.");
  process.exit(2);
}

let pass = 0, fail = 0; const fails = [];
for (const [label, pref, expected] of CASES) {
  const got = isMedicalPreference(pref);
  if (got === expected) { pass++; console.log(`  ✓ ${label} → ${got ? "MEDICAL" : "ok"}`); }
  else { fail++; fails.push(label); console.log(`  ✗ FAIL ${label}: expected ${expected ? "MEDICAL" : "non-medical"}, got ${got ? "MEDICAL" : "non-medical"}`); }
}
console.log(`\n${pass}/${CASES.length} passed`);
if (fail) { console.log("FAILURES:", fails); process.exit(1); }
console.log("All medical-guardrail cases pass.");
