'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import FlavourRadar from './FlavourRadar'
import RadarChart from './RadarChart'
import { type Cat, type ShapeValues, fetchCategories, fetchSpokes, valuesFromSpokes, RADAR_GOLD, RADAR_SAGE } from './flavour-data'

// Staff-side flavour panel: the single radar + a Compare flow. Pick a second
// (flavour-MAPPED) whisky → side-by-side by default, or toggle to overlay (gold
// vs sage on one radar). Honest: only the mapped whiskies are pickable, and the
// Compare affordance only appears when THIS whisky is itself mapped.

const FAMILY = "'Google Sans Code', monospace"
interface Picked { id: string; name: string }

export default function WhiskyFlavourPanel({ whiskyId, whiskyName }: { whiskyId: string; whiskyName: string }) {
  const supabase = createBrowserSupabaseClient()
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [baseVals, setBaseVals] = useState<ShapeValues | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [mapped, setMapped] = useState<Picked[] | null>(null)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [pickedVals, setPickedVals] = useState<ShapeValues | null>(null)
  const [overlay, setOverlay] = useState(false)
  const [busy, setBusy] = useState(false)

  // Fetch this whisky's spokes once (to gate Compare + feed the overlay).
  useEffect(() => {
    let active = true
    ;(async () => {
      const c = await fetchCategories(supabase)
      const sp = await fetchSpokes(supabase, whiskyId)
      if (active) { setCats(c); setBaseVals(valuesFromSpokes(sp)) }
    })()
    return () => { active = false }
  }, [whiskyId])  // eslint-disable-line react-hooks/exhaustive-deps

  const baseMapped = baseVals !== null && Object.keys(baseVals).length > 0

  const openCompare = async () => {
    setPickerOpen(true)
    if (mapped) return
    const { data: ints } = await supabase.from('whisky_flavour_intensities').select('whisky_id')
    const ids = [...new Set((ints || []).map((r: { whisky_id: string }) => r.whisky_id))]
    const { data: ws } = await supabase.from('whiskies').select('id,name').in('id', ids)
    const list = ((ws || []) as Picked[])
      .filter(w => w.id !== whiskyId)
      .sort((a, b) => a.name.localeCompare(b.name))
    setMapped(list)
  }

  const pick = async (p: Picked) => {
    setBusy(true)
    const ps = await fetchSpokes(supabase, p.id)
    setPickedVals(valuesFromSpokes(ps))
    setPicked(p)
    setPickerOpen(false); setSearch(''); setOverlay(false); setBusy(false)
  }
  const clear = () => { setPicked(null); setPickedVals(null); setOverlay(false) }

  const filtered = (mapped || []).filter(w => {
    const toks = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return toks.every(t => w.name.toLowerCase().includes(t))
  })

  // ── Comparison active ──
  if (picked && cats && baseVals && pickedVals) {
    return (
      <div>
        <div style={headRow}>
          <div style={labelStyle}>Flavour comparison</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setOverlay(o => !o)} style={btn}>{overlay ? '▣ Side by side' : '◎ Overlay'}</button>
            <button onClick={clear} style={btn}>✕ Clear</button>
          </div>
        </div>
        <div style={legendRow}>
          <span style={{ ...swatch, background: RADAR_GOLD }} /><span style={legName}>{whiskyName}</span>
          <span style={{ ...swatch, background: RADAR_SAGE, marginLeft: 16 }} /><span style={legName}>{picked.name}</span>
        </div>
        {overlay ? (
          <RadarChart cats={cats} shapes={[
            { values: baseVals, color: RADAR_GOLD, label: whiskyName },
            { values: pickedVals, color: RADAR_SAGE, label: picked.name },
          ]} />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            <div style={col}>
              <div style={{ ...capName, color: RADAR_GOLD }}>{whiskyName}</div>
              <RadarChart cats={cats} shapes={[{ values: baseVals, color: RADAR_GOLD, label: whiskyName }]} />
            </div>
            <div style={col}>
              <div style={{ ...capName, color: RADAR_SAGE }}>{picked.name}</div>
              <RadarChart cats={cats} shapes={[{ values: pickedVals, color: RADAR_SAGE, label: picked.name }]} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Default: single radar + Compare ──
  return (
    <div>
      <div style={headRow}>
        <div style={labelStyle}>Flavour radar</div>
        {baseMapped && (
          <button onClick={pickerOpen ? () => setPickerOpen(false) : openCompare} style={btn}>
            {pickerOpen ? 'Close' : 'Compare ⇆'}
          </button>
        )}
      </div>

      {pickerOpen && (
        <div style={pickerBox}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a whisky to compare…" style={input} autoFocus />
          {mapped === null ? (
            <div style={hint}>Loading…</div>
          ) : (
            <div style={pickerList}>
              {filtered.length === 0 ? <div style={hint}>No flavour-mapped whisky matches.</div> : filtered.slice(0, 40).map(w => (
                <button key={w.id} onClick={() => pick(w)} disabled={busy} style={pickRow}>{w.name}</button>
              ))}
              {filtered.length > 40 && <div style={hint}>+{filtered.length - 40} more — keep typing</div>}
            </div>
          )}
          <div style={{ ...hint, marginTop: 6, opacity: 0.6 }}>
            Only the {mapped?.length ?? '…'} flavour-mapped whiskies can be compared.
          </div>
        </div>
      )}

      <FlavourRadar whiskyId={whiskyId} />
    </div>
  )
}

const headRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }
const labelStyle: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.12em', textTransform: 'uppercase' }
const btn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#D4B85A', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 5, padding: '5px 11px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const pickerBox: React.CSSProperties = { marginBottom: 12, padding: 10, background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 6, padding: '8px 10px', fontFamily: FAMILY, fontSize: 12, outline: 'none' }
const pickerList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto', marginTop: 8 }
const pickRow: React.CSSProperties = { textAlign: 'left', background: 'transparent', color: '#E5D4C2', border: 'none', borderBottom: '1px solid rgba(229,212,194,0.05)', padding: '7px 6px', fontFamily: FAMILY, fontSize: 12, cursor: 'pointer' }
const hint: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', padding: '4px 6px' }
const legendRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontFamily: FAMILY }
const swatch: React.CSSProperties = { width: 12, height: 12, borderRadius: 3, display: 'inline-block' }
const legName: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2' }
const col: React.CSSProperties = { flex: '1 1 300px', maxWidth: 440 }
const capName: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, textAlign: 'center', marginBottom: 4 }
