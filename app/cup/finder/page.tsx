'use client'

import { useEffect, useState } from 'react'
import FinderRadar from '@/components/whisky/FinderRadar'
import RadarChart from '@/components/whisky/RadarChart'
import { RADAR_GOLD, RADAR_SAGE, type ShapeValues, type Cat, fetchCategories } from '@/components/whisky/flavour-data'
import { STRENGTH_LABEL, type Match } from '@/lib/whisky/flavour-match'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// ─────────────────────────────────────────────────────────────────────────────
// THE RAMPANT CUP — the Flavour Finder for the event.
// The SAME engine as the members' finder: the Flavour Compass wheel + the shared
// /api/whisky/flavour-match match, over the FULL live catalogue (hard-filtered to
// what the bar can pour). Public, no login, touch/tablet-first. Was a baked
// 40-bottle file for Ho Tram; now it inherits the whole library from the DB.
// ─────────────────────────────────────────────────────────────────────────────

const toShape = (m: Record<string, number>): ShapeValues =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { intensity: v, confidence: 1 }]))

export default function CupFinder() {
  const [cats, setCats] = useState<Cat[]>([])
  const [value, setValue] = useState<Record<string, number>>({})
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [close, setClose] = useState(true)
  const [finding, setFinding] = useState(false)
  const [size, setSize] = useState(360)

  useEffect(() => {
    const fit = () => setSize(Math.max(300, Math.min(440, window.innerWidth - 44)))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])
  useEffect(() => { fetchCategories(createBrowserSupabaseClient()).then(setCats) }, [])

  const anySet = Object.keys(value).length > 0
  const meShape = toShape(value)

  const find = async () => {
    if (!anySet || finding) return
    setFinding(true)
    try {
      const res = await fetch('/api/whisky/flavour-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set: value, in_stock_only: true }),
      })
      const j = await res.json()
      setMatches((j.matches || []) as Match[]); setClose(!!j.bestIsClose)
      setTimeout(() => document.getElementById('cf-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } finally { setFinding(false) }
  }
  const reset = () => { setValue({}); setMatches(null) }

  return (
    <div className="cf-page" style={wrap}>
      <style dangerouslySetInnerHTML={{ __html: `
        .cf-page, .cf-page * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
        .cf-page { touch-action: manipulation; }
        .cf-page button, .cf-page a, .cf-page svg * { outline: none; }
        /* Instant press feedback (replaces the default tap highlight we removed). */
        .cf-page button, .cf-page a { transition: transform 0.08s ease, opacity 0.08s ease; }
        .cf-page button:active, .cf-page a:active { transform: scale(0.96); opacity: 0.9; }
      ` }} />
      <div style={{ width: 'min(560px, 94vw)', margin: '0 auto', textAlign: 'center' }}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/cup/rampant-lion-cream.webp" alt="The Rampant Club" style={{ height: 84, width: 'auto', display: 'block', margin: '0 auto 18px' }} />
        <div style={eyebrow}>The Rampant Cup</div>
        <h1 style={title}>The Flavour Finder</h1>
        <p style={prompt}>
          Tap a flavour to add it, tap again to turn it up. Set only the notes you&rsquo;re after —
          we&rsquo;ll pour you the closest match on the table tonight.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
          {cats.length > 0
            ? <FinderRadar cats={cats} value={value} onChange={setValue} size={size} />
            : <div style={{ ...muted, height: size, display: 'flex', alignItems: 'center' }}>Loading the compass…</div>}
        </div>

        <div style={actions}>
          <button onClick={find} disabled={!anySet || finding} style={{ ...primaryBtn, opacity: anySet && !finding ? 1 : 0.4 }}>{finding ? 'Finding…' : 'Find my dram'}</button>
          {anySet && <button onClick={reset} style={ghostBtn}>Reset</button>}
        </div>
        {!anySet && <div style={muted}>Tap the compass to begin.</div>}

        {matches && (
          <div id="cf-results" style={{ marginTop: 40, scrollMarginTop: 20 }}>
            {!close && <div style={banner}>Nothing&rsquo;s an exact match for that — but here&rsquo;s the nearest we&rsquo;re pouring.</div>}
            <div style={resultsHead}>{close ? 'Your pours' : 'Nearest pours'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {matches.map(m => (
                <div key={m.id} style={card}>
                  <div style={cardHead}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={cardName}>{m.name}</div>
                    </div>
                    <div style={{ ...pill, ...tone(m.strength) }}>{STRENGTH_LABEL[m.strength]} · {m.pct}%</div>
                  </div>
                  <RadarChart cats={cats} shapes={[
                    { values: meShape, color: RADAR_GOLD, label: 'You' },
                    { values: toShape(m.spokes), color: RADAR_SAGE, label: m.name },
                  ]} size={Math.min(320, size)} />
                  <div style={legend}>
                    <span style={{ ...sw, background: RADAR_GOLD }} /><span style={legTxt}>What you set</span>
                    <span style={{ ...sw, background: RADAR_SAGE, marginLeft: 14 }} /><span style={legTxt}>This whisky</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={reset} style={{ ...ghostBtn, marginTop: 28 }}>Start over</button>
          </div>
        )}

        <div style={footer}>Show your match to any of our team, and we&rsquo;ll pour you a taste.</div>
      </div>
    </div>
  )
}

function tone(s: Match['strength']): React.CSSProperties {
  if (s === 'strong') return { color: '#7AB07A', borderColor: 'rgba(122,176,122,0.45)' }
  if (s === 'good') return { color: '#D4B85A', borderColor: 'rgba(212,184,90,0.45)' }
  if (s === 'loose') return { color: '#C49555', borderColor: 'rgba(196,149,85,0.45)' }
  return { color: '#B2AA98', borderColor: 'rgba(178,170,152,0.4)' }
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', 'Playfair Display', serif"
const wrap: React.CSSProperties = { minHeight: '100vh', background: '#052E20', padding: '48px 20px 72px' }
const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A84C' }
const title: React.CSSProperties = { fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: '#E5D4C2', letterSpacing: '0.02em', margin: '8px 0 12px' }
const prompt: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, maxWidth: 440, margin: '0 auto 8px' }
const actions: React.CSSProperties = { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }
const primaryBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 26, padding: '15px 34px', fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.24)', borderRadius: 26, padding: '15px 26px', fontFamily: MONO, fontSize: 13, cursor: 'pointer' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.7, marginTop: 14 }
const banner: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C49555', background: 'rgba(196,149,85,0.08)', border: '1px solid rgba(196,149,85,0.25)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6, marginBottom: 16 }
const resultsHead: React.CSSProperties = { fontFamily: SERIF, fontSize: 22, color: '#E5D4C2', marginBottom: 18 }
const card: React.CSSProperties = { padding: 18, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 14 }
const cardHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }
const cardName: React.CSSProperties = { fontFamily: SERIF, fontSize: 18, color: '#E5D4C2', lineHeight: 1.25 }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 10, padding: '4px 11px', borderRadius: 12, border: '1px solid', whiteSpace: 'nowrap' }
const legend: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }
const sw: React.CSSProperties = { width: 11, height: 11, borderRadius: 3, display: 'inline-block' }
const legTxt: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const footer: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', opacity: 0.55, marginTop: 44, letterSpacing: '0.04em' }
