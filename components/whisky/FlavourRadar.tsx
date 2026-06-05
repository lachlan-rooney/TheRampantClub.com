'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// TRC flavour radar — renders a whisky's 13 intensity spokes (0-4) as a spider
// chart. HONEST by construction: absent families sit at the centre (spoke 0), so
// a sparse whisky shows a small honest shape and a whisky with no mapped flavour
// shows the "not yet mapped" state — never a padded full flower. Low-confidence
// spokes (<0.6) are flagged, not hidden. Reads ONLY confirmed/derived data.

interface Cat { slug: string; name: string; sort_order: number }
interface Spoke { category_slug: string; intensity: number; confidence: number }

const FAMILY = "'Google Sans Code', monospace"
let _catsCache: Cat[] | null = null

// Wrap a long family name into ~2 balanced lines so it fits the label gutter
// (we keep the full names — just make them fit). Short names stay one line.
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

export default function FlavourRadar({ whiskyId, size = 300 }: { whiskyId: string; size?: number }) {
  const supabase = createBrowserSupabaseClient()
  const [cats, setCats] = useState<Cat[] | null>(_catsCache)
  const [spokes, setSpokes] = useState<Spoke[] | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!_catsCache) {
        const { data } = await supabase.from('flavour_categories').select('slug,name,sort_order').order('sort_order')
        if (data) _catsCache = data as Cat[]
      }
      const { data: sp } = await supabase
        .from('whisky_flavour_intensities')
        .select('category_slug,intensity,confidence')
        .eq('whisky_id', whiskyId)
      if (active) { setCats(_catsCache); setSpokes((sp || []) as Spoke[]) }
    })()
    return () => { active = false }
  }, [whiskyId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!cats || spokes === null) return <div style={stateBox}>…</div>
  if (spokes.length === 0) return (
    <div style={stateBox}>
      <div style={{ color: '#B2AA98' }}>Flavour profile not yet mapped</div>
      <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>No tasting notes to derive from</div>
    </div>
  )

  const byCat: Record<string, Spoke> = Object.fromEntries(spokes.map(s => [s.category_slug, s]))
  const N = cats.length

  // Chart circle of radius R, centred in a viewBox with symmetric label gutters
  // on every side (so the chart sits CENTRED, not shoved by one side's labels).
  const R = Math.round(size * 0.36)            // spoke radius (size ≈ overall feel)
  const SIDE = 104, VERT = 44                  // label gutters (wider L/R for long names)
  const W = 2 * R + 2 * SIDE
  const H = 2 * R + 2 * VERT
  const cx = W / 2, cy = H / 2
  const ang = (i: number) => (-90 + i * 360 / N) * Math.PI / 180
  const pt = (i: number, v: number): [number, number] => [cx + (R * v / 4) * Math.cos(ang(i)), cy + (R * v / 4) * Math.sin(ang(i))]
  const poly = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'

  const dataPts = cats.map((c, i) => pt(i, byCat[c.slug]?.intensity || 0))
  const rings = [1, 2, 3, 4].map(r => poly(cats.map((_, i) => pt(i, r))))
  const LINE_H = 9.5

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flavour radar" style={{ display: 'block', width: '100%', maxWidth: W, height: 'auto', margin: '0 auto' }}>
      {/* grid rings + axes */}
      {rings.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(229,212,194,0.10)" strokeWidth={1} />)}
      {cats.map((c, i) => { const [x, y] = pt(i, 4); return <line key={c.slug} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(229,212,194,0.08)" strokeWidth={1} /> })}

      {/* data polygon */}
      <path d={poly(dataPts)} fill="rgba(212,184,90,0.20)" stroke="#D4B85A" strokeWidth={1.5} strokeLinejoin="round" />
      {dataPts.map((p, i) => byCat[cats[i].slug]?.intensity
        ? <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill="#D4B85A" /> : null)}

      {/* labels — per-side anchored so they point AWAY from the chart and stay
          in-box; top labels rise, bottom labels drop (no collision); long names
          wrap to 2 lines. Present bright, absent dim, low-confidence flagged. */}
      {cats.map((c, i) => {
        const a = ang(i), cos = Math.cos(a), sin = Math.sin(a)
        const lr = R + 12
        const lx = cx + lr * cos, ly = cy + lr * sin
        const anchor: 'start' | 'middle' | 'end' = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle'
        const s = byCat[c.slug]
        const low = s && s.confidence < 0.6
        const fill = s ? (low ? 'rgba(229,212,194,0.5)' : '#E5D4C2') : 'rgba(229,212,194,0.28)'
        const lines = wrapName(c.name)
        if (s) lines[lines.length - 1] += ` · ${s.intensity}${low ? ' ?' : ''}`
        // vertical block placement: bottom → below the point, top → above, sides → centred
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

const stateBox: React.CSSProperties = {
  width: '100%', maxWidth: 360, height: 120, margin: '0 auto',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  fontFamily: FAMILY, fontSize: 12, color: '#B2AA98',
  border: '1px dashed rgba(229,212,194,0.12)', borderRadius: 8,
}
