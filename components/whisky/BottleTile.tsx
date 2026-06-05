'use client'

// One letter-bottle on the shelf — ELEGANT LINE-ART, coherent with TRC's ink
// illustration set: a fine cream outline on the deep-green ground, NO flat fill
// (the flat tint is what read childish), elegant tall proportions, sparing gold
// hairline accents. The LETTER is the invariant dominant element — a bold cream
// initial on a constant baseline, identical on every bottle, so scanning for
// "G" stays instant. Variety lives only in the (subtle, elegant) silhouette.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const LINE = 'rgba(229,212,194,0.72)'   // cream ink line
const GOLD = '#D4B85A'
const LABEL_Y = 74                       // constant across shapes → letters on one even line

// 4 refined bottle silhouettes (fine outlines, symmetric around x=32, viewBox 64×124).
const SHAPES = [
  // tall slim
  'M27,12 L37,12 L37,18 C37,24 36,28 36,35 C36,41 45,43 45,53 L45,104 Q45,110 39,110 L25,110 Q19,110 19,104 L19,53 C19,43 28,41 28,35 C28,28 27,24 27,18 Z',
  // classic — sloped shoulder, fuller body
  'M27,12 L37,12 L37,33 C37,39 47,41 47,55 L47,104 Q47,110 41,110 L23,110 Q17,110 17,104 L17,55 C17,41 27,39 27,33 Z',
  // square shoulder — angular, refined
  'M28,12 L36,12 L36,34 L43,45 L43,106 Q43,110 39,110 L25,110 Q21,110 21,106 L21,45 L28,34 Z',
  // rounded / pot still
  'M28,13 L36,13 L36,34 C36,40 46,45 46,64 C46,91 40,110 32,110 C24,110 18,91 18,64 C18,45 28,40 28,34 Z',
]

export default function BottleTile({ letter, count, onClick }: { letter: string; count: number; onClick: () => void }) {
  const empty = count === 0
  const idx = Math.max(0, letter.charCodeAt(0) - 65)
  const d = SHAPES[idx % SHAPES.length]

  return (
    <button
      onClick={empty ? undefined : onClick}
      disabled={empty}
      aria-label={empty ? `${letter} — no whiskies yet` : `${letter} — ${count} whiskies`}
      className={empty ? '' : 'bottle-tile'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', border: 'none', padding: 0, width: '100%', cursor: empty ? 'default' : 'pointer' }}
    >
      <svg viewBox="0 0 64 124" width="100%" style={{ maxWidth: 72, display: 'block', opacity: empty ? 0.3 : 1 }}>
        {/* bottle silhouette — fine line, no fill */}
        <path d={d} fill="none" stroke={LINE} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
        {/* cork hairline — sparing gold accent */}
        {!empty && <line x1={27} y1={18} x2={37} y2={18} stroke={GOLD} strokeWidth={1.1} opacity={0.85} />}
        {/* the letter — invariant dominant, bold cream initial */}
        <text x={32} y={LABEL_Y} textAnchor="middle" dominantBaseline="middle" fontFamily="'Rampant Sans', serif" fontSize={22} fontWeight={600} fill={empty ? 'rgba(229,212,194,0.4)' : '#E5D4C2'} style={{ letterSpacing: '0.02em' }}>{letter}</text>
        {/* fine gold rule under the letter — editorial restraint */}
        {!empty && <line x1={26} y1={LABEL_Y + 12} x2={38} y2={LABEL_Y + 12} stroke={GOLD} strokeWidth={0.9} opacity={0.7} />}
      </svg>
      <div style={{ fontFamily: MONO, fontSize: 9, color: empty ? 'rgba(178,170,152,0.4)' : '#B2AA98', letterSpacing: '0.04em' }}>
        {empty ? '—' : count}
      </div>
      {/* shelf ledge — a fine line, not a chunky bar */}
      <div style={{ width: '100%', height: 1, marginTop: 5, background: 'rgba(229,212,194,0.32)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </button>
  )
}
