'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import RecResults, { type RecItem } from './RecResults'
import FinderRadar from './FinderRadar'
import { fetchCategories, type Cat } from './flavour-data'

// Staff hospitality tool on the MIS member page. Seeds recs from THIS member's
// stored taste profile; if their profile is empty (no mapped loves on file),
// staff taps a flavour shape and recommends from that instead — never invents a
// taste. Delight-first, honest strength, stock note where known.

const FAMILY = "'Google Sans Code', monospace"
interface RecResp { recs: RecItem[]; target: Record<string, number>; bestIsClose: boolean; profileEmpty: boolean; sources?: { loved_bottles?: string[] } }

export default function SuggestAPour({ memberNo }: { memberNo: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RecResp | null>(null)
  const [cats, setCats] = useState<Cat[]>([])
  const [shape, setShape] = useState<Record<string, number>>({})
  useEffect(() => { fetchCategories(createBrowserSupabaseClient()).then(setCats) }, [])

  const run = async (body: object) => {
    setLoading(true)
    try {
      const r = await fetch('/api/whisky/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setData(await r.json())
    } finally { setLoading(false) }
  }

  return (
    <div style={panel}>
      <div style={headRow}>
        <div style={label}>Suggest a pour</div>
        {!open && <button onClick={() => { setOpen(true); run({ member_no: memberNo, limit: 5 }) }} style={btn}>◆ Suggest →</button>}
        {open && <button onClick={() => { setOpen(false); setData(null); setShape({}) }} style={btnGhost}>Close</button>}
      </div>
      {open && (loading ? <div style={muted}>Finding…</div> : data && (
        data.profileEmpty ? (
          <div>
            <div style={muted}>No taste profile for {memberNo} yet (no flavour-mapped loves on file). Tap a flavour shape to suggest from:</div>
            {cats.length > 0 && <FinderRadar cats={cats} value={shape} onChange={setShape} />}
            <button onClick={() => run({ set: shape, limit: 5 })} disabled={!Object.keys(shape).length} style={{ ...btn, marginTop: 8, opacity: Object.keys(shape).length ? 1 : 0.5 }}>Suggest from this shape</button>
          </div>
        ) : (
          <>
            {data.sources?.loved_bottles?.length ? <div style={muted}>From their loves: {data.sources.loved_bottles.slice(0, 4).join(' · ')}</div> : null}
            <RecResults recs={data.recs} target={data.target} bestIsClose={data.bestIsClose} />
          </>
        )
      ))}
    </div>
  )
}

const panel: React.CSSProperties = { marginTop: 16, padding: 16, background: 'rgba(212,184,90,0.05)', border: '1px solid rgba(212,184,90,0.18)', borderRadius: 10 }
const headRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }
const label: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase' }
const btn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#D4B85A', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 6, padding: '6px 12px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '6px 12px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', opacity: 0.85, marginBottom: 10, lineHeight: 1.5 }
