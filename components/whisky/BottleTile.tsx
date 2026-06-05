'use client'

// One letter-bottle on the shelf. The LETTER is the INVARIANT dominant element —
// identical cream label + bold deep-green letter on every bottle, so the eye
// finds "G" instantly. Variety lives ONLY in bottle SILHOUETTE (4 shapes) and
// glass TINT (a TRC-palette ramp). Empty letters render dimmed but present.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

// TRC-palette glass tints — ambers/golds/greens that read on the deep-green ground.
const TINTS = ['#8A6D3B', '#A8863F', '#6F8F7A', '#9C7A4D', '#7A8B6F', '#B59A5C', '#5E6650', '#94613A']
// 4 bottle silhouettes (body width / height / top-y / corner radius).
const SHAPES = [
  { bw: 30, bh: 56, by: 42, r: 7 },   // tall slim
  { bw: 40, bh: 50, by: 48, r: 10 },  // standard
  { bw: 46, bh: 42, by: 56, r: 13 },  // short & wide
  { bw: 40, bh: 50, by: 48, r: 19 },  // rounded / pot
]
const CX = 40

export default function BottleTile({ letter, count, onClick }: { letter: string; count: number; onClick: () => void }) {
  const empty = count === 0
  const idx = Math.max(0, letter.charCodeAt(0) - 65)
  const tint = TINTS[(idx * 3) % TINTS.length]
  const s = SHAPES[idx % SHAPES.length]
  const bx = CX - s.bw / 2
  const labelY = s.by + s.bh / 2

  return (
    <button
      onClick={empty ? undefined : onClick}
      disabled={empty}
      aria-label={empty ? `${letter} — no whiskies yet` : `${letter} — ${count} whiskies`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        background: 'transparent', border: 'none', padding: 0, width: '100%',
        cursor: empty ? 'default' : 'pointer',
      }}
      className={empty ? '' : 'bottle-tile'}
    >
      <svg viewBox="0 0 80 108" width="100%" style={{ maxWidth: 88, display: 'block', opacity: empty ? 0.26 : 1 }}>
        {/* cork */}
        <rect x={36} y={5} width={8} height={9} rx={1.5} fill="#3a2a1a" />
        {/* neck */}
        <rect x={37} y={12} width={6} height={16} fill={tint} />
        {/* shoulder neck→body */}
        <path d={`M37,28 L${bx + 2},${s.by} L${bx + s.bw - 2},${s.by} L43,28 Z`} fill={tint} />
        {/* body */}
        <rect x={bx} y={s.by} width={s.bw} height={s.bh} rx={s.r} fill={tint} stroke="rgba(0,0,0,0.22)" strokeWidth={0.8} />
        {/* glass highlight */}
        <rect x={bx + 3} y={s.by + 4} width={3} height={s.bh - 12} rx={1.5} fill="rgba(255,255,255,0.18)" />
        {/* label panel — INVARIANT (same on every bottle) */}
        <rect x={CX - 15} y={labelY - 12} width={30} height={24} rx={3} fill="#E5D4C2" stroke="rgba(5,46,32,0.25)" strokeWidth={0.6} />
        {/* the letter — INVARIANT dominant element */}
        <text x={CX} y={labelY + 1} textAnchor="middle" dominantBaseline="middle" fontFamily="'Rampant Sans', serif" fontSize={18} fontWeight={700} fill="#052E20">{letter}</text>
      </svg>
      <div style={{ fontFamily: MONO, fontSize: 9, color: empty ? 'rgba(178,170,152,0.4)' : '#B2AA98', letterSpacing: '0.04em' }}>
        {empty ? '—' : count}
      </div>
      {/* shelf ledge — full tile width so adjacent tiles form a continuous shelf */}
      <div style={{ width: '100%', height: 6, marginTop: 2, borderRadius: 1, background: 'linear-gradient(180deg, rgba(229,212,194,0.55), rgba(150,120,80,0.4))', boxShadow: '0 3px 7px rgba(0,0,0,0.4)' }} />
    </button>
  )
}
