'use client'

import { type Cat, type ShapeValues, hexToRgba } from './flavour-data'

// Presentational flavour radar — draws the frame/axes/labels ONCE and one
// polygon per shape. Single-shape mode reproduces the original FlavourRadar
// render exactly (per-spoke ` · N`, low-confidence `?`, gold fill 0.20).
// Multi-shape (overlay) drops the per-spoke number (ambiguous across whiskies)
// and colours each shape distinctly. Honest by construction: absent families
// sit at the centre; this component never pads a shape.

const FAMILY = "'Google Sans Code', monospace"

export interface RadarShape { values: ShapeValues; color: string; label: string }

// Wrap a long family name into ~2 balanced lines so it fits the label gutter.
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

export default function RadarChart({ cats, shapes, size = 300 }: { cats: Cat[]; shapes: RadarShape[]; size?: number }) {
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

  const single = shapes.length === 1
  const sv = single ? shapes[0].values : null
  const presentAny = (slug: string) => shapes.some(s => (s.values[slug]?.intensity || 0) > 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flavour radar" style={{ display: 'block', width: '100%', maxWidth: W, height: 'auto', margin: '0 auto' }}>
      {/* grid rings + axes — drawn once */}
      {rings.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(229,212,194,0.10)" strokeWidth={1} />)}
      {cats.map((c, i) => { const [x, y] = pt(i, 4); return <line key={c.slug} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(229,212,194,0.08)" strokeWidth={1} /> })}

      {/* one polygon per shape */}
      {shapes.map((sh, si) => {
        const dataPts = cats.map((c, i) => pt(i, sh.values[c.slug]?.intensity || 0))
        return (
          <g key={si}>
            <path d={poly(dataPts)} fill={hexToRgba(sh.color, single ? 0.20 : 0.18)} stroke={sh.color} strokeWidth={1.5} strokeLinejoin="round" />
            {dataPts.map((p, i) => sh.values[cats[i].slug]?.intensity
              ? <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={sh.color} /> : null)}
          </g>
        )
      })}

      {/* labels — drawn once. Single mode: per-spoke number + low-confidence ?.
          Multi mode: family name only (number ambiguous across whiskies). */}
      {cats.map((c, i) => {
        const a = ang(i), cos = Math.cos(a), sin = Math.sin(a)
        const lr = R + 12
        const lx = cx + lr * cos, ly = cy + lr * sin
        const anchor: 'start' | 'middle' | 'end' = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle'
        const lines = wrapName(c.name)
        let fill: string
        if (single && sv) {
          const s = sv[c.slug]
          const low = s && s.confidence < 0.6
          fill = s ? (low ? 'rgba(229,212,194,0.5)' : '#E5D4C2') : 'rgba(229,212,194,0.28)'
          if (s) lines[lines.length - 1] += ` · ${s.intensity}${low ? ' ?' : ''}`
        } else {
          fill = presentAny(c.slug) ? '#E5D4C2' : 'rgba(229,212,194,0.28)'
        }
        const y0 = sin > 0.35 ? ly + 6
          : sin < -0.35 ? ly - 6 - (lines.length - 1) * LINE_H
          : ly - (lines.length - 1) * LINE_H / 2
        return lines.map((ln, k) => (
          <text key={c.slug + k} x={lx} y={y0 + k * LINE_H} textAnchor={anchor} dominantBaseline="middle" fontSize={8} fontFamily={FAMILY} fill={fill}>{ln}</text>
        ))
      })}
    </svg>
  )
}
