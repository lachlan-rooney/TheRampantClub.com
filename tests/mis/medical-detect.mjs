// medical-detect.mjs
// Medical-preference detector — FAIL-SAFE by design.
// Returns true if a preference shows ANY signal of being medical/allergy/religious-dietary.
// Biased toward detection: over-forcing a non-medical item is harmless; missing an allergy is not.

const STRONG = [
  "allerg", "anaphyla", "epipen", "epi pen", "epi-pen",
  "coeliac", "celiac", "intoleran", "lactose", "halal", "kosher",
  "diabet", "medication", "medicine", "prescription", "prescribed",
  "doctor", "physician", "medical", "pregnan", "gluten",
];

const PHRASES = [
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

function hay(pref) {
  return [pref.preference_name, pref.detail, pref.verbatim_quote, pref.subcategory, pref.category]
    .filter(Boolean).join("  ").toLowerCase();
}

function hasStem(text, stem) {
  const i = text.indexOf(stem);
  if (i === -1) return false;
  const before = i === 0 ? " " : text[i - 1];
  return !/[a-z]/.test(before);
}

export function isMedicalPreference(pref) {
  const text = hay(pref);
  for (const s of STRONG) if (hasStem(text, s)) return true;
  for (const re of PHRASES) if (re.test(text)) return true;
  return false;
}
