'use client'

import { type Cat, RADAR_GOLD, hexToRgba, catLabel } from './flavour-data'
import { useLang } from '@/lib/lang'

// Interactive flavour radar for the Finder. Each spoke is a big tappable wedge
// (mobile-friendly); tapping cycles its intensity 0→1→2→3→4→0. Unset (0) spokes
// are "don't care" (and simply absent from `value`). The gold shape updates live.
// Geometry mirrors RadarChart so the drawn shape reads the same as the static one.

const FAMILY = "'Google Sans Code', monospace"

// Wrap a long family name into ~2 balanced lines.
function wrapName(name: string): string[] {
  if (name.length <= 14) return [name]
  const words = name.split(' ')
  if (words.length === 1) return [name]
  let best = [name], bestDiff = Infinity
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ')
    const diff = Math.abs(a.length - b.length)
    if (diff < bestDiff) { bestDiff = diff; best = [a, b] }
  }
  return best
}

export default function FinderRadar({ cats, value, onChange, size = 340 }: {
  cats: Cat[]
  value: Record<string, number>           // slug -> level 1..4 (set spokes only)
  onChange: (v: Record<string, number>) => void
  size?: number
}) {
  const { t, lang } = useLang()
  const N = cats.length
  const R = Math.round(size * 0.36)
  // THE WORDS GROW WITH THE WHEEL (owner, 2026-09-25: "make the wheel on the
  // flavour finder and the labels bigger. It's hard to read."). Everything here
  // is in user units and the drawing is scaled to its container, so a FIXED
  // label size means the type shrinks exactly as much as the wheel does — which
  // is how a 1280px tablet ended up with 8.5px family names read across a table.
  //
  // Tied to R, then, and floored at what it always was: a phone lands back on
  // 8.5 with the gutters it had, and only a big screen gets the bigger type.
  // The gutters follow the type, or "Leather & Polished Oak" runs off the edge.
  const LABEL = Math.min(14, Math.max(8.5, R * 0.062))
  const SIDE = Math.round(8.5 * LABEL + 30), VERT = Math.round(3.4 * LABEL + 20)
  const W = 2 * R + 2 * SIDE
  const H = 2 * R + 2 * VERT
  const cx = W / 2, cy = H / 2
  const ang = (i: number) => (-90 + i * 360 / N) * Math.PI / 180
  const pt = (i: number, v: number): [number, number] => [cx + (R * v / 4) * Math.cos(ang(i)), cy + (R * v / 4) * Math.sin(ang(i))]
  const poly = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'
  const rings = [1, 2, 3, 4].map(r => poly(cats.map((_, i) => pt(i, r))))
  const LINE_H = Math.round(LABEL * 1.2 * 10) / 10

  const cycle = (slug: string) => {
    const cur = value[slug] || 0
    const next = cur >= 4 ? 0 : cur + 1
    const nv = { ...value }
    if (next === 0) delete nv[slug]; else nv[slug] = next
    onChange(nv)
  }

  // A wedge hit-area for spoke i (centre → out past the rim, half-gap each side).
  const wedge = (i: number) => {
    const half = Math.PI / N
    const rr = R * 1.16
    const [x0, y0] = [cx + rr * Math.cos(ang(i) - half), cy + rr * Math.sin(ang(i) - half)]
    const [x1, y1] = [cx + rr * Math.cos(ang(i) + half), cy + rr * Math.sin(ang(i) + half)]
    return `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`
  }

  const dataPts = cats.map((c, i) => pt(i, value[c.slug] || 0))
  const anySet = Object.keys(value).length > 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('Set your flavour profile', 'Chọn hồ sơ hương vị của bạn')}style={{ display: 'block', width: '100%', maxWidth: W, height: 'auto', margin: '0 auto', touchAction: 'manipulation' }}>
      {/* grid + axes */}
      {rings.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(229,212,194,0.16)" style={{ stroke: 'var(--rc-grid, rgba(229,212,194,0.16))' }} strokeWidth={LABEL > 10 ? 1.25 : 1} />)}
      {cats.map((c, i) => { const [x, y] = pt(i, 4); return <line key={c.slug} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(229,212,194,0.13)" style={{ stroke: 'var(--rc-axis, rgba(229,212,194,0.13))' }} strokeWidth={1} /> })}

      {/* tappable wedges (under the shape; the shape itself ignores pointers) */}
      {cats.map((c, i) => (
        <path key={'w' + c.slug} d={wedge(i)} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => cycle(c.slug)}>
          <title>{catLabel(c, lang)}</title>
        </path>
      ))}

      {/* the live drawn shape (only if something is set) */}
      {anySet && (
        <path d={poly(dataPts)} fill={hexToRgba(RADAR_GOLD, 0.22)} stroke={RADAR_GOLD} strokeWidth={1.5} strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
      )}
      {dataPts.map((p, i) => (value[cats[i].slug] || 0) > 0
        ? <circle key={'d' + i} cx={p[0]} cy={p[1]} r={3} fill={RADAR_GOLD} style={{ pointerEvents: 'none' }} /> : null)}

      {/* labels (also tappable) — show the set level brightly */}
      {cats.map((c, i) => {
        const a = ang(i), cos = Math.cos(a), sin = Math.sin(a)
        const lr = R + 12
        const lx = cx + lr * cos, ly = cy + lr * sin
        const anchor: 'start' | 'middle' | 'end' = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle'
        const lvl = value[c.slug] || 0
        // CSS hooks (--rc-label-set / -unset) default to the colours they have always been.
        const fill = lvl > 0 ? 'var(--rc-label-set, #D4B85A)' : 'var(--rc-label-unset, rgba(229,212,194,0.55))'
        const lines = wrapName(catLabel(c, lang))
        if (lvl > 0) lines[lines.length - 1] += ` · ${lvl}`
        const y0 = sin > 0.35 ? ly + 6 : sin < -0.35 ? ly - 6 - (lines.length - 1) * LINE_H : ly - (lines.length - 1) * LINE_H / 2
        return lines.map((ln, k) => (
          <text key={c.slug + k} x={lx} y={y0 + k * LINE_H} textAnchor={anchor} dominantBaseline="middle" fontSize={LABEL} fontFamily={FAMILY} style={{ fill, cursor: 'pointer' }} onClick={() => cycle(c.slug)}>{ln}</text>
        ))
      })}
    </svg>
  )
}
