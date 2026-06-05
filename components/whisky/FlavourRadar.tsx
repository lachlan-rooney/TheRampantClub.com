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
  const cx = size / 2, cy = size / 2
  const R = size / 2 - 64                      // leave room for labels
  const ang = (i: number) => (-90 + i * 360 / N) * Math.PI / 180
  const pt = (i: number, v: number): [number, number] => [cx + (R * v / 4) * Math.cos(ang(i)), cy + (R * v / 4) * Math.sin(ang(i))]
  const poly = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'

  const dataPts = cats.map((c, i) => pt(i, byCat[c.slug]?.intensity || 0))
  const rings = [1, 2, 3, 4].map(r => poly(cats.map((_, i) => pt(i, r))))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Flavour radar" style={{ display: 'block', maxWidth: '100%' }}>
      {/* grid rings + axes */}
      {rings.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(229,212,194,0.10)" strokeWidth={1} />)}
      {cats.map((c, i) => { const [x, y] = pt(i, 4); return <line key={c.slug} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(229,212,194,0.08)" strokeWidth={1} /> })}

      {/* data polygon */}
      <path d={poly(dataPts)} fill="rgba(212,184,90,0.20)" stroke="#D4B85A" strokeWidth={1.5} strokeLinejoin="round" />
      {dataPts.map((p, i) => byCat[cats[i].slug]?.intensity
        ? <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill="#D4B85A" /> : null)}

      {/* labels — present families bright, absent dim, low-confidence flagged */}
      {cats.map((c, i) => {
        const [lx, ly] = pt(i, 4.62)
        const cos = Math.cos(ang(i))
        const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end'
        const s = byCat[c.slug]
        const low = s && s.confidence < 0.6
        const fill = s ? (low ? 'rgba(229,212,194,0.5)' : '#E5D4C2') : 'rgba(229,212,194,0.28)'
        return (
          <text key={c.slug} x={lx} y={ly} textAnchor={anchor as 'start'|'middle'|'end'} dominantBaseline="middle" fontSize={7.5} fontFamily={FAMILY} fill={fill}>
            {c.name}{s ? ` · ${s.intensity}` : ''}{low ? ' ?' : ''}
          </text>
        )
      })}
    </svg>
  )
}

const stateBox: React.CSSProperties = {
  width: 300, maxWidth: '100%', height: 120, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  fontFamily: FAMILY, fontSize: 12, color: '#B2AA98',
  border: '1px dashed rgba(229,212,194,0.12)', borderRadius: 8,
}
