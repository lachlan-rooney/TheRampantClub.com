// Static content for the Sports Club page. Keep the prose tongue-in-cheek.

export interface Trophy {
  id: string
  name: string
  sport: string
  established: number
  metal: 'gold' | 'silver' | 'bronze' | 'pewter'
  description: string
}

export interface Winner {
  trophy: string         // matches Trophy.id
  year: number
  winner: string
  result?: string
  notes?: string
}

export interface SportTab {
  id: string             // anchor id on the page
  label: string
  vn: string
  glyph: string          // single character / emoji shorthand
  upcoming: number       // hardcoded for now; replace with live count
}

// ── Top scrolling ticker headlines ──────────────────────────────
export const MARQUEE: string[] = [
  'BREAKING — Captain reschedules Padel for the second time. Citing rain "in the abstract".',
  '◆ Rooftop Putting Championship: first registered protest filed. Committee declines comment.',
  '◆ Tennis whites: now on advisory rather than enforcement.',
  '◆ Sports Secretary still learning the rules of padel. Members invited to be patient.',
  '◆ The Rampant Cup 2027 venue announced: undisclosed, as is tradition.',
  '◆ Hash route last week described as "creative". Distance: still 5km, allegedly.',
  '◆ Backgammon Invitational: Chairman seeks worthy opponents. Bring your own dice.',
]

// ── Sport-selector hero ────────────────────────────────────────
export const SPORTS: SportTab[] = [
  { id: 'golf',    label: 'Golf',    vn: 'Golf',     glyph: '⛳', upcoming: 1 },
  { id: 'tennis',  label: 'Tennis',  vn: 'Quần Vợt', glyph: '🎾', upcoming: 1 },
  { id: 'padel',   label: 'Padel',   vn: 'Padel',    glyph: '🟦', upcoming: 1 },
  { id: 'hash',    label: 'Hash',    vn: 'Chạy Bộ',  glyph: '🏃', upcoming: 1 },
  { id: 'misc',    label: 'Other',   vn: 'Khác',     glyph: '◆',  upcoming: 6 },
]

// ── Trophy Cabinet ─────────────────────────────────────────────
export const TROPHIES: Trophy[] = [
  {
    id: 'rampant-cup',
    name: 'The Rampant Cup',
    sport: 'Golf',
    established: 2024,
    metal: 'silver',
    description: 'Annual Ryder-Cup-style invitational. Asia XI vs Expat XV. Two days. One trophy.',
  },
  {
    id: 'saigon-open',
    name: 'The Sài Gòn Open Shield',
    sport: 'Tennis',
    established: 2024,
    metal: 'silver',
    description: 'Mixed doubles round-robin into a knockout. White attire encouraged.',
  },
  {
    id: 'padel-cup',
    name: 'The Padel Cup',
    sport: 'Padel',
    established: 2025,
    metal: 'bronze',
    description: 'Monthly ladder culminating in an end-of-year final. Ego-free zone (in theory).',
  },
  {
    id: 'rooftop-putting',
    name: 'The Rooftop Putt',
    sport: 'Golf',
    established: 2025,
    metal: 'pewter',
    description: 'Annual rooftop putting championship. Nine holes. No mulligans. No excuses.',
  },
]

// ── Hall of Champions ──────────────────────────────────────────
export const WINNERS: Winner[] = [
  { trophy: 'rampant-cup',     year: 2026, winner: 'Asia XI',       result: '14½ – 13½', notes: 'Decided on the eighteenth at Đà Lạt.' },
  { trophy: 'rampant-cup',     year: 2025, winner: 'Expat XV',      result: '15 – 13',   notes: 'A controversial line on the seventh.' },
  { trophy: 'rampant-cup',     year: 2024, winner: 'Expat XV',      result: '14 – 14 (T)', notes: 'Tie. The Cup remained at the Captain\'s for a year.' },
  { trophy: 'saigon-open',     year: 2026, winner: 'Pioneer 042 / Pioneer 011', result: '6-4, 7-5', notes: 'Mixed doubles. Tightly contested.' },
  { trophy: 'saigon-open',     year: 2025, winner: 'Legacy 003 / Legacy 008',   result: '7-6, 6-3' },
  { trophy: 'padel-cup',       year: 2026, winner: 'Pioneer 027',   result: '—',         notes: 'Returned from Barcelona insufferable.' },
  { trophy: 'rooftop-putting', year: 2026, winner: 'Legacy 014',    result: '−4 (54 putts)', notes: 'Wind: gusting. Spirits: high.' },
]

// ── Bookmaker's odds ───────────────────────────────────────────
export interface OddsRow { label: string; odds: string; commentary?: string }
export const ODDS: { tournament: string; rows: OddsRow[] }[] = [
  {
    tournament: 'The Rampant Cup 2027',
    rows: [
      { label: 'Asia XI',          odds: '11/8',  commentary: 'Defending champions. Have not lost on home soil.' },
      { label: 'Expat XV',         odds: '6/4',   commentary: 'Two new ringers from Singapore.' },
      { label: 'The Captain\'s Pick', odds: '25/1', commentary: 'A wildcard. Bring sandwiches.' },
    ],
  },
  {
    tournament: 'The Sài Gòn Open 2027',
    rows: [
      { label: 'Defending champions', odds: '5/2' },
      { label: 'The field',           odds: '3/1' },
      { label: 'Anyone in white',     odds: '8/1' },
    ],
  },
]

// ── Captain's Column rotating aphorisms ────────────────────────
export const CAPTAINS_COLUMN: string[] = [
  'A gentleman wins by margins. A Rampant wins by manners.',
  'There are two reasons to play sport: the body, and the bar afterwards.',
  'The handicap system is a covenant between honest men and themselves.',
  'White is on advisory. Decorum is on enforcement.',
  'There is no shame in losing. There is shame in losing badly.',
  'A line call is the conscience of the player who made it.',
  'You will be timed. We will pretend not to time you.',
  'The Committee declines to comment, and so should you.',
]

// ── Existing fixtures copy + details (kept for the prose section) ──
// Re-exporting from the sports page would be cleaner long-term but for
// now we leave the prose where it is and reference these constants
// where new components need a label.
