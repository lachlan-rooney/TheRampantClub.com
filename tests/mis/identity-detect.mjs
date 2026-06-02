// identity-detect.mjs
// Identity-fact detector — NARROW / HIGH-PRECISION / UNDER-CATCH by design.
// Returns true ONLY if a preference shows clear declarative identity/
// relationship-fact content. Biased toward NON-DETECTION: a false identity
// lock is invisible and self-perpetuating, so when in doubt, do NOT lock —
// leave it AI-judged. This is the OPPOSITE bias to the medical detector,
// and it is deliberate.
//
// The detector operates on PHRASE PATTERNS only (no bare-stem matches),
// because under-catch bias rules out the "any mention of `wife`" approach
// — that would over-catch incidental references. Locks require a phrase
// structure that signals declarative identity claim, not preference.

const RELATIONSHIPS = "wife|husband|spouse|partner|son|daughter|child|children|father|mother|brother|sister|fianc[eé]|fianc[eé]e";

// Heritage / nationality terms. Case-insensitive match; we use these only
// inside "I'm [heritage]" phrase, never as bare stems (otherwise "British
// food" would over-fire). Add liberally — the gate is the phrase structure,
// not the word list.
const HERITAGE = "Singaporean|Peranakan|Vietnamese|British|Scottish|English|Irish|Welsh|American|Canadian|Australian|Malaysian|Thai|Indian|Japanese|Korean|Chinese|French|Italian|Spanish|German|Dutch|Swedish|Danish|Norwegian|Russian|Filipino|Indonesian|Cambodian|Burmese|Nepalese|Pakistani|Bangladeshi|Israeli|Lebanese|Egyptian|Moroccan|Brazilian|Argentinian|Mexican|Peruvian|Greek|Turkish|Portuguese|Polish|Czech|Hungarian|Romanian|Ukrainian|Sri Lankan|South African|New Zealander";

// Religious identity terms. Bare "Muslim" / "Jewish" are identity claims
// only inside "I'm [religion]" phrase. The DIETARY rule that flows from
// religion (halal/kosher) is detected by the MEDICAL detector — medical
// precedence runs FIRST, so we never have to disambiguate here.
const RELIGION = "Muslim|Jewish|Christian|Catholic|Protestant|Orthodox|Buddhist|Hindu|Sikh|Bahá'í|Bahai|Taoist|Shinto";

// Identity-relevant nouns that, when held by a possessive, mark the row as
// identity (vs the row being about a different attribute). "my wife's
// birthday" → identity. "my father's whisky" → NOT identity (whisky isn't
// here). This list is the disqualifier complement: only THESE post-
// possessive nouns keep the row in identity territory.
const IDENTITY_ATTRIBUTES = "birthday|birthdays|anniversary|name|date\\s+of\\s+birth|dob|nationality|heritage|origin";

// "I'm" / "I am" — variants the patterns need to allow.
const I_AM = "(?:I['’]?m|I\\s+am)";

const IDENTITY_PHRASES = [
  // 1a. Relationship's identity attribute — possessive + identity noun.
  //     "my wife's birthday", "my father's name", "my son's date of birth".
  //     The disqualifier is BAKED IN: the possessive only matches when
  //     followed by an identity attribute, not "dram" / "whisky" / etc.
  new RegExp(`\\bmy\\s+(?:late\\s+|deceased\\s+|former\\s+|ex[\\s-]?)?(?:${RELATIONSHIPS})['’]?s\\s+(?:${IDENTITY_ATTRIBUTES})\\b`, 'i'),

  // 1b. Relationship as declarative subject — "my wife is …", "my father was …".
  //     Locks because "is/was" frames an identity attribute follows.
  new RegExp(`\\bmy\\s+(?:late\\s+|deceased\\s+|former\\s+|ex[\\s-]?)?(?:${RELATIONSHIPS})\\s+(?:is|was)\\s+`, 'i'),

  // 1c. Relationship + proper-name introduction — "my wife Sophie", "my son James".
  //     CASE-SENSITIVE: the [A-Z] requirement is what makes this narrow.
  //     "my wife on Sundays" → "on" lowercase, no match.
  //     "my wife was telling me" → "was" matches pattern 1b, but that's intentional.
  //     "my late father's dram" → possessive `'s` blocks `\s+[A-Z]` (the apostrophe
  //     intervenes). Disqualifier built in.
  new RegExp(`\\bmy\\s+(?:late\\s+|deceased\\s+|former\\s+|ex[\\s-]?)?(?:${RELATIONSHIPS})\\s+[A-Z][a-z]+\\b`),

  // 2. Anniversary as DECLARATIVE FACT — must be followed by a date connector
  //    ("is", "was", "falls", "the", "on the", "date is"). "we have Bollinger
  //    on our anniversary" does NOT match because nothing date-declarative
  //    follows the anniversary — it's a beverage preference, not an identity
  //    fact. "our anniversary is 14 October" → locks.
  new RegExp(`\\bour\\s+(?:wedding\\s+)?anniversary['’]?s?\\s+(?:is|was|falls|the|on\\s+the|date\\s+is)\\b`, 'i'),

  // 3. Heritage / nationality identity claim — "I'm Singaporean", "I am Peranakan".
  //    Case-insensitive (the heritage word itself is rare enough to be unambiguous
  //    in this phrase context).
  new RegExp(`\\b${I_AM}\\s+(?:a\\s+)?(?:${HERITAGE})\\b`, 'i'),

  // 4. Religious identity — "I'm Muslim", "I am Buddhist". Dietary rules
  //    (halal/kosher) are MEDICAL — caught earlier by precedence.
  new RegExp(`\\b${I_AM}\\s+(?:a\\s+)?(?:${RELIGION})\\b`, 'i'),

  // 5. "I'm from [Place]" — case-sensitive on the place name. "I'm from work"
  //    won't match because "work" starts lowercase.
  new RegExp(`\\b${I_AM}\\s+from\\s+[A-Z]\\w+`),

  // 6. Declarative lifelong rule about identity events — "I don't do birthdays",
  //    "I don't celebrate anniversaries", "I don't observe Christmas".
  //    NARROW deliberately: only matches rules about identity-relevant EVENTS.
  //    "I don't drink gin" → preference, not identity (no event noun matches).
  new RegExp(`\\bI\\s+don['’]?t\\s+(?:do|celebrate|observe|mark|believe\\s+in)\\s+(?:my\\s+own\\s+)?(?:birthdays?|anniversary|anniversaries|holidays?|christmas|easter|hanukkah|halloween|new\\s+year)\\b`, 'i'),
];

// NB: the identity haystack PRESERVES CASE (unlike the medical haystack which
// lowercases) — pattern 1c and pattern 5 rely on `[A-Z]` to distinguish proper
// nouns from common words.
function identityHaystack(pref) {
  return [pref.preference_name, pref.detail, pref.verbatim_quote, pref.subcategory, pref.category]
    .filter(Boolean).join("  ");
}

export function isIdentityPreference(pref) {
  const text = identityHaystack(pref);
  for (const re of IDENTITY_PHRASES) {
    if (re.test(text)) return true;
  }
  return false;
}
