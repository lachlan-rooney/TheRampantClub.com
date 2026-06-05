'use client'

import { type Cat, RADAR_GOLD, hexToRgba } from './flavour-data'

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
  const N = cats.length
  const R = Math.round(size * 0.36)
  const SIDE = 104, VERT = 44
  const W = 2 * R + 2 * SIDE
  const H = 2 * R + 2 * VERT
  const cx = W / 2, cy = H / 2
  const ang = (i: number) => (-90 + i * 360 / N) * Math.PI / 180
  const pt = (i: number, v: number): [number, number] => [cx + (R * v / 4) * Math.cos(ang(i)), cy + (R * v / 4) * Math.sin(ang(i))]
  const poly = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'
  const rings = [1, 2, 3, 4].map(r => poly(cats.map((_, i) => pt(i, r))))
  const LINE_H = 9.5

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
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Set your flavour profile" style={{ display: 'block', width: '100%', maxWidth: W, height: 'auto', margin: '0 auto', touchAction: 'manipulation' }}>
      {/* grid + axes */}
      {rings.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(229,212,194,0.10)" strokeWidth={1} />)}
      {cats.map((c, i) => { const [x, y] = pt(i, 4); return <line key={c.slug} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(229,212,194,0.08)" strokeWidth={1} /> })}

      {/* tappable wedges (under the shape; the shape itself ignores pointers) */}
      {cats.map((c, i) => (
        <path key={'w' + c.slug} d={wedge(i)} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => cycle(c.slug)}>
          <title>{c.name}</title>
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
        const fill = lvl > 0 ? '#D4B85A' : 'rgba(229,212,194,0.55)'
        const lines = wrapName(c.name)
        if (lvl > 0) lines[lines.length - 1] += ` · ${lvl}`
        const y0 = sin > 0.35 ? ly + 6 : sin < -0.35 ? ly - 6 - (lines.length - 1) * LINE_H : ly - (lines.length - 1) * LINE_H / 2
        return lines.map((ln, k) => (
          <text key={c.slug + k} x={lx} y={y0 + k * LINE_H} textAnchor={anchor} dominantBaseline="middle" fontSize={8.5} fontFamily={FAMILY} fill={fill} style={{ cursor: 'pointer' }} onClick={() => cycle(c.slug)}>{ln}</text>
        ))
      })}
    </svg>
  )
}
