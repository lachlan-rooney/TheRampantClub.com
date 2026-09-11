'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import RadarChart from './RadarChart'
import { type Cat, type ShapeValues, fetchCategories, fetchSpokes, valuesFromSpokes, RADAR_GOLD } from './flavour-data'
import { useLang } from '@/lib/lang'

// Single-whisky flavour radar — thin wrapper: fetches one whisky's spokes and
// renders a one-shape RadarChart (gold). HONEST: a whisky with no mapped flavour
// shows "not yet mapped" rather than a padded shape. API unchanged ({whiskyId, size}).

const FAMILY = "'Google Sans Code', monospace"

export default function FlavourRadar({ whiskyId, size = 300 }: { whiskyId: string; size?: number }) {
  const { t } = useLang()
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

  if (!cats || values === null) return <div style={stateBox} aria-busy="true">…</div>
  if (Object.keys(values).length === 0) return (
    <div style={stateBox}>
      <div style={{ opacity: 0.9 }}>{t('Flavour profile not yet mapped', 'Chưa có hồ sơ hương vị')}</div>
      <div style={{ fontSize: 11.5, opacity: 0.66, marginTop: 6 }}>{t('Not yet tagged for the flavour map', 'Chưa được gắn thẻ trên bản đồ hương vị')}</div>
    </div>
  )

  return <RadarChart cats={cats} shapes={[{ values, color: RADAR_GOLD, label: '' }]} size={size} />
}

// The honest empty state: a hairline and a line of mono, not a dashed box.
const stateBox: React.CSSProperties = {
  width: '100%', maxWidth: 360, minHeight: 96, margin: 0, boxSizing: 'border-box',
  display: 'flex', flexDirection: 'column', justifyContent: 'center',
  fontFamily: FAMILY, fontSize: 12.5, lineHeight: 1.7, color: '#E5D4C2',
  borderTop: '1px solid rgba(229,212,194,0.16)', padding: '16px 0',
}
