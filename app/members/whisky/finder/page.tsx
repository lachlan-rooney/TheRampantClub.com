'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import FinderRadar from '@/components/whisky/FinderRadar'
import RadarChart from '@/components/whisky/RadarChart'
import { type Cat, type ShapeValues, fetchCategories, RADAR_GOLD, RADAR_SAGE } from '@/components/whisky/flavour-data'
import { STRENGTH_LABEL, type Match } from '@/lib/whisky/flavour-match'

const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

const toShape = (m: Record<string, number>): ShapeValues =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { intensity: v, confidence: 1 }]))

export default function FlavourFinderPage() {
  const [cats, setCats] = useState<Cat[]>([])
  const [value, setValue] = useState<Record<string, number>>({})
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [bestIsClose, setBestIsClose] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchCategories(createBrowserSupabaseClient()).then(setCats) }, [])

  const anySet = Object.keys(value).length > 0
  const memberShape = toShape(value)

  const find = async () => {
    if (!anySet) return
    setLoading(true); setMatches(null)
    try {
      const r = await fetch('/api/whisky/flavour-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set: value }),
      })
      const j = await r.json()
      setMatches(j.matches || [])
      setBestIsClose(!!j.bestIsClose)
    } finally { setLoading(false) }
  }
  const reset = () => { setValue({}); setMatches(null) }

  return (
    <>
      <MemberPage title="Find Your Dram" subtitle="Tìm Ly Của Bạn" icon="/images/whisky-glass-icon-opt.png" description="Set the flavours you're in the mood for, and we'll find your match">
        <p style={prompt}>
          Tap a flavour to add it, tap again to turn it up (1–4). Set only the notes you care about —
          the rest we&apos;ll leave open. Then find your match.
        </p>

        {cats.length === 0 ? <div style={muted}>Loading…</div> : (
          <>
            <FinderRadar cats={cats} value={value} onChange={setValue} />
            <div style={actions}>
              <button onClick={find} disabled={!anySet || loading} style={{ ...primaryBtn, opacity: anySet && !loading ? 1 : 0.45 }}>
                {loading ? 'Finding…' : 'Find my match'}
              </button>
              {anySet && <button onClick={reset} style={ghostBtn}>Reset</button>}
            </div>
            {!anySet && <div style={{ ...muted, textAlign: 'center' }}>Tap the compass above to begin.</div>}
          </>
        )}

        {matches && (
          <div style={{ marginTop: 36 }}>
            {matches.length === 0 ? (
              <div style={muted}>Set a flavour or two first.</div>
            ) : (
              <>
                {!bestIsClose && (
                  <div style={honestBanner}>
                    Nothing&apos;s a close match for that exact profile yet — but here&apos;s the nearest we pour.
                  </div>
                )}
                <div style={resultsHead}>{bestIsClose ? 'Your matches' : 'Nearest pours'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {matches.map(m => (
                    <div key={m.id} style={card}>
                      <div style={cardHead}>
                        <div style={cardName}>{m.name}</div>
                        <div style={{ ...strengthPill, ...strengthTone(m.strength) }}>{STRENGTH_LABEL[m.strength]} · {m.pct}%</div>
                      </div>
                      {m.in_stock === false && <div style={oos}>Not currently in stock</div>}
                      <RadarChart cats={cats} shapes={[
                        { values: memberShape, color: RADAR_GOLD, label: 'You' },
                        { values: toShape(m.spokes), color: RADAR_SAGE, label: m.name },
                      ]} />
                      <div style={legend}>
                        <span style={{ ...sw, background: RADAR_GOLD }} /><span style={legTxt}>What you set</span>
                        <span style={{ ...sw, background: RADAR_SAGE, marginLeft: 14 }} /><span style={legTxt}>This whisky</span>
                      </div>
                      <Link href={`/members/whisky?focus=${m.id}`} style={libLink}>See it in the library →</Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </MemberPage>
    </>
  )
}

function strengthTone(s: Match['strength']): React.CSSProperties {
  if (s === 'strong') return { color: '#7AB07A', borderColor: 'rgba(122,176,122,0.45)' }
  if (s === 'good') return { color: '#D4B85A', borderColor: 'rgba(212,184,90,0.45)' }
  if (s === 'loose') return { color: '#C49555', borderColor: 'rgba(196,149,85,0.45)' }
  return { color: '#B2AA98', borderColor: 'rgba(178,170,152,0.4)' }
}

const prompt: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center', maxWidth: 460, margin: '0 auto 24px' }
const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.7, marginTop: 12 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }
const primaryBtn: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 24, padding: '12px 28px', fontFamily: FAMILY, fontSize: 13, letterSpacing: '0.06em', cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.2)', borderRadius: 24, padding: '12px 22px', fontFamily: FAMILY, fontSize: 12, cursor: 'pointer' }
const honestBanner: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#C49555', background: 'rgba(196,149,85,0.08)', border: '1px solid rgba(196,149,85,0.25)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, marginBottom: 16 }
const resultsHead: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', marginBottom: 16, textAlign: 'center' }
const card: React.CSSProperties = { padding: 18, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 12 }
const cardHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }
const cardName: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 17, color: '#E5D4C2', lineHeight: 1.25 }
const strengthPill: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, padding: '3px 10px', borderRadius: 12, border: '1px solid', whiteSpace: 'nowrap' }
const oos: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', opacity: 0.7, marginBottom: 8 }
const legend: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }
const sw: React.CSSProperties = { width: 11, height: 11, borderRadius: 3, display: 'inline-block' }
const legTxt: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const libLink: React.CSSProperties = { display: 'block', textAlign: 'center', marginTop: 12, fontFamily: FAMILY, fontSize: 11, color: '#7AB07A', textDecoration: 'none' }
