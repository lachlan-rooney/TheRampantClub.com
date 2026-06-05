'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import RadarChart from './RadarChart'
import { type Cat, type ShapeValues, fetchCategories, fetchSpokes, valuesFromSpokes, RADAR_GOLD } from './flavour-data'

// Single-whisky flavour radar — thin wrapper: fetches one whisky's spokes and
// renders a one-shape RadarChart (gold). HONEST: a whisky with no mapped flavour
// shows "not yet mapped" rather than a padded shape. API unchanged ({whiskyId, size}).

const FAMILY = "'Google Sans Code', monospace"

export default function FlavourRadar({ whiskyId, size = 300 }: { whiskyId: string; size?: number }) {
  const supabase = createBrowserSupabaseClient()
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [values, setValues] = useState<ShapeValues | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const c = await fetchCategories(supabase)
      const sp = await fetchSpokes(supabase, whiskyId)
      if (active) { setCats(c); setValues(valuesFromSpokes(sp)) }
    })()
    return () => { active = false }
  }, [whiskyId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!cats || values === null) return <div style={stateBox}>…</div>
  if (Object.keys(values).length === 0) return (
    <div style={stateBox}>
      <div style={{ color: '#B2AA98' }}>Flavour profile not yet mapped</div>
      <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>No tasting notes to derive from</div>
    </div>
  )

  return <RadarChart cats={cats} shapes={[{ values, color: RADAR_GOLD, label: '' }]} size={size} />
}

const stateBox: React.CSSProperties = {
  width: '100%', maxWidth: 360, height: 120, margin: '0 auto',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  fontFamily: FAMILY, fontSize: 12, color: '#B2AA98',
  border: '1px dashed rgba(229,212,194,0.12)', borderRadius: 8,
}
