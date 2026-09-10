// ═══════════════════════════════════════════════════════════════════════════
// THE FIVE SENSES — DATA, NOT COMPONENT.
// ───────────────────────────────────────────────────────────────────────────
// This file exists so commissioned artwork can arrive without anybody opening
// StudioSenses.tsx, exactly as `mark` works for the floor lions on /spaces.
//
// HOW TO DROP IN COMMISSIONED MARKS:
//   1. Put the five files in /public/images/senses/ (svg preferred, png fine).
//   2. Give each sense below an `art` path. That's the whole change.
//      e.g.  art: '/images/senses/sight.svg'
//
// `art` WINS over `path` when both are set. A commissioned mark renders as an
// image and does NOT stroke-dash reveal — you cannot draw on an <img>, and a
// finished drawing being "sketched in" would look wrong anyway. The inline
// `path` marks below animate; art does not.
//
// COMMISSION ALL FIVE AT ONCE. Half a set animating while the other half simply
// appears reads as a fault, and five drawings at five scales don't read as a set
// whatever each one is individually — that was the stand-ins' real failure,
// worse than any single weak mark.

// ANSWERED is the verb, deliberately. The club does not decorate a show with
// sound and food — it responds to it. "Combines", "brings together" and
// "immerses" describe something else, and the difference is the whole point of
// the room. Don't let it drift in future edits.
//
// THE ROOM'S METHOD, not one exhibition's. It lives on the hub because it is
// how The Studio works every time. Any single show's specifics already live in
// that exhibition's own food and drinks prose; repeating them here would be a
// worse version of what is already written.
//
// EVERY ENGLISH LINE BELOW IS THE CLUB'S OWN. Four are quoted from "The Studio
// x Octave Launch F&B Brief", checked against the source rather than
// paraphrased; the fifth is Lachlan's own wording, because the brief has no
// real description of the scent. Provenance is noted per line. If you add or
// change one, quote the brief or ask him — don't compose it.

interface Sense {
  en: string
  vn: string          // the fixed Sino-Vietnamese term, not a rendering choice
  line: string | null // null renders NOTHING at all — kept so a future sense can
                      // be added mute rather than guessed at, which is how Scent
                      // shipped while it was waiting for real words
  /** Inline geometry for a stand-in mark: one continuous path, dash-revealed. */
  path: string
  /** A commissioned file in /public. Set this and it wins; no animation. */
  art?: string
}

// THE MARKS ARE OBJECTS, the way the floor lions on /spaces hold an object
// rather than depict a floor: a book, a flask, a tumbler. So these hold what the
// room hands you — a candle, a canapé, a dram, a bell, a sprig. Never a sense
// organ: an eye, a nose or a tongue off an icon set is exactly the generic
// pictogram this page exists to avoid, and it would sit badly beside drawn lions.
// Each mark is ONE path (subpaths inside a single `d`) so the stroke-dash reveal
// runs through it in one continuous draw.
export const SENSES: Sense[] = [
  // "Lighting, directed, soft and warm, designed to complement both the
  //  artworks and the whisky's amber tones." — brief, Practical Requirements
  { en: 'Sight', vn: 'Thị giác', line: 'Lighting, directed, soft and warm.',
    // a candle — "directed, soft and warm" is candlelight, not a lamp icon
    path: 'M32 12 C 27 18, 28 24, 32 27 C 36 24, 37 18, 32 12 Z M24 31 Q32 28 40 31 L40 52 L24 52 Z' },

  // "All canapés must be one-bite, no cutlery required." — brief, F&B Programme
  { en: 'Touch', vn: 'Xúc giác', line: 'One bite. No cutlery.',
    // a canapé on its base — the one bite you pick up, no cutlery
    path: 'M18 51 L46 51 M25 51 C 25 34, 39 34, 39 51 M32 34 L32 26 M32 29 L37 25' },

  // "Colour palette in stone, blush, and dusk tones, reminiscent of the piece
  //  of art itself." — brief, Canapé — Twilight / Threshold
  { en: 'Taste', vn: 'Vị giác', line: 'Reminiscent of the piece of art itself.',
    // the dram — a rocks glass and the line of whisky in it. A tulip
    // bowl came out reading as a martini, which is the wrong drink entirely.
    path: 'M23 17 L26 51 L38 51 L41 17 M24.7 33 L39.3 33' },

  // "Soft ambient music." — Programme Flow. "Soundscape controlled." — Environment
  { en: 'Sound', vn: 'Thính giác', line: 'Soft ambient. Soundscape controlled.',
    // a bell — something that SOUNDS, not a speaker that reproduces
    path: 'M21 46 C 21 29, 25 20, 32 20 C 39 20, 43 29, 43 46 M18 46 L46 46 M32 46 L32 51 M32 20 L32 15' },

  // SCENT IS THE ODD ONE OUT, AND IT IS THE STRONGEST OF THE FIVE.
  // This line is NOT from the brief — the brief says only "Aroma controlled",
  // which reads as a plant setting and badly understates what actually happens.
  // These are Lachlan's own words, given 2026-09-10: the aroma is composed per
  // exhibition, tailored to the artist or to a particular piece, decided WITH
  // the artist. Held deliberately blank until he supplied them rather than
  // filled with a plausible guess; do not "improve" it now without asking him,
  // for the same reason it was blank before.
  { en: 'Scent', vn: 'Khứu giác',
    line: 'Composed with the artist. A place, a memory, an environment.',
    // a sprig, giving off — stem, two leaves, one rising wisp
    path: 'M32 52 L32 26 M32 38 C 39 38, 43 33, 42 27 C 36 27, 32 32, 32 38 Z M32 46 C 25 46, 21 41, 22 35 C 28 35, 32 40, 32 46 Z M29 21 C 31 17, 35 19, 33 14' },
]
