'use client'

import { useEffect, useState } from 'react'
import FinderRadar from '@/components/whisky/FinderRadar'
import RadarChart from '@/components/whisky/RadarChart'
import { RADAR_GOLD, RADAR_SAGE, type ShapeValues, type Cat, fetchCategories } from '@/components/whisky/flavour-data'
import { STRENGTH_LABEL, type Match } from '@/lib/whisky/flavour-match'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { PublicPage, Rise } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

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
    <PublicPage ground="#052E20" ink="#E5D4C2">
    <div className="cf-page">
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

        /* ── The finder, set like the house ──────────────────────────────
           The ask on the left, large; the compass on the right, where a hand
           reaches for it on a tablet. Results flow beneath as a run of pours
           on hairlines — no cards. */
        .cf-top { display: grid; grid-template-columns: .9fr 1.1fr; gap: 48px; align-items: center;
                  padding-top: 72px; padding-bottom: 24px; }
        .cf-words { position: relative; }
        .cf-eyebrow { color: #D4B85A; opacity: 1; }
        .cf-title { font-size: clamp(52px, 7.4vw, 108px); }
        .cf-lion { width: clamp(170px, 17vw, 250px); margin: 30px 0 0 clamp(40px, 8vw, 120px); }
        .cf-tool { display: flex; flex-direction: column; align-items: center; }
        .cf-compass { width: 100%; display: flex; justify-content: center; }
        .cf-actions { display: flex; gap: 34px; align-items: baseline; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
        .cf-btn { background: none; border: none; border-bottom: 1px solid currentColor; border-radius: 0; cursor: pointer;
                  padding: 14px 0 7px; font-family: ${MONO}; letter-spacing: .12em; text-transform: uppercase; }
        .cf-btn-go { color: #D4B85A; font-size: 14px; }
        .cf-btn-ghost { color: #E5D4C2; font-size: 12px; opacity: .85; }
        .cf-btn .pk-go { margin-left: 4px; }
        .cf-btn:hover:not(:disabled) .pk-go { transform: translateX(7px); }
        .cf-btn:disabled { cursor: not-allowed; }
        .cf-hint { font-family: ${MONO}; font-size: 12px; margin-top: 16px; opacity: .72; text-align: center; }

        .cf-results { padding-top: 88px; scroll-margin-top: 20px; }
        .cf-banner { font-family: ${MONO}; font-size: 12.5px; line-height: 1.8; color: #D9A866; max-width: 560px; margin: 0 0 6px; }
        .cf-rhead { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
        .cf-glass { margin-right: 4%; }
        .cf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0 40px; margin-top: 34px; }
        .cf-pour { border-top: 1px solid rgba(229,212,194,.16); padding: 22px 0 30px; }
        .cf-pour-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .cf-pour-name { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 2.2vw, 28px); line-height: 1.08; margin: 0; }
        .cf-strength { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
        .cf-legend { display: flex; align-items: center; gap: 8px; justify-content: center; margin-top: 4px; flex-wrap: wrap; }
        .cf-legend span.t { font-family: ${MONO}; font-size: 11px; opacity: .8; }
        .cf-sw { width: 14px; height: 2px; display: inline-block; }
        .cf-foot { font-family: ${MONO}; font-size: 12px; line-height: 1.8; opacity: .75; padding-top: 64px; padding-bottom: 72px; }

        @media (max-width: 1000px) {
          .cf-top { grid-template-columns: 1fr; gap: 20px; padding-top: 56px; }
          .cf-lion { position: absolute; top: 0; right: -4px; width: clamp(100px, 20vw, 170px); margin: 0; }
          .cf-words .pk-lede { max-width: 72%; }
        }
        @media (max-width: 600px) {
          .cf-top { padding-top: 40px; }
          .cf-words .pk-lede { max-width: none; }
          .cf-words > :first-child, .cf-words > :nth-child(2) { max-width: 70%; }
          .cf-results { padding-top: 64px; }
          .cf-grid { grid-template-columns: 1fr; }
        }
      ` }} />
      <CreamInkDefs />

      <header className="pk-wrap cf-top">
        <div className="cf-words">
          <Rise><div className="pk-eyebrow cf-eyebrow">The Rampant Cup</div></Rise>
          <Rise delay={.06}><h1 className="pk-h1 cf-title">The Flavour Finder</h1></Rise>
          <Rise delay={.12}>
            <p className="pk-lede">
              Tap a flavour to add it, tap again to turn it up. Set only the notes you&rsquo;re after —
              we&rsquo;ll pour you the closest match on the table tonight.
            </p>
          </Rise>
          <Rise delay={.2} className="cf-lion"><CreamInk name="lion-suit" width="100%" rot={4} dur={8} /></Rise>
        </div>

        <Rise delay={.14} className="cf-tool">
          <div className="cf-compass">
            {cats.length > 0
              ? <FinderRadar cats={cats} value={value} onChange={setValue} size={size} />
              : <div className="cf-hint" style={{ height: size, display: 'flex', alignItems: 'center', marginTop: 0 }}>Loading the compass…</div>}
          </div>

          <div className="cf-actions">
            <button onClick={find} disabled={!anySet || finding} className="cf-btn cf-btn-go" style={{ opacity: anySet && !finding ? 1 : 0.4 }}>
              {finding ? 'Finding…' : <>Find my dram <span className="pk-go" aria-hidden="true">→</span></>}
            </button>
            {anySet && <button onClick={reset} className="cf-btn cf-btn-ghost">Reset</button>}
          </div>
          {!anySet && <div className="cf-hint">Tap the compass to begin.</div>}
        </Rise>
      </header>

      {matches && (
        <section id="cf-results" className="pk-wrap cf-results">
          {!close && <p className="cf-banner">Nothing&rsquo;s an exact match for that — but here&rsquo;s the nearest we&rsquo;re pouring.</p>}
          <div className="cf-rhead">
            <h2 className="pk-h2" style={{ marginTop: 0 }}>{close ? 'Your pours' : 'Nearest pours'}</h2>
            <CreamInk name="glass" width="clamp(84px, 9vw, 124px)" rot={-6} dur={7} className="cf-glass" />
          </div>
          <div className="cf-grid">
            {matches.map(m => (
              <article key={m.id} className="cf-pour">
                <div className="cf-pour-head">
                  <h3 className="cf-pour-name">{m.name}</h3>
                  <div className="cf-strength" style={{ color: tone(m.strength).color }}>{STRENGTH_LABEL[m.strength]} · {m.pct}%</div>
                </div>
                <RadarChart cats={cats} shapes={[
                  { values: meShape, color: RADAR_GOLD, label: 'You' },
                  { values: toShape(m.spokes), color: RADAR_SAGE, label: m.name },
                ]} size={Math.min(320, size)} />
                <div className="cf-legend">
                  <span className="cf-sw" style={{ background: RADAR_GOLD }} /><span className="t">What you set</span>
                  <span className="cf-sw" style={{ background: RADAR_SAGE, marginLeft: 14 }} /><span className="t">This whisky</span>
                </div>
              </article>
            ))}
          </div>
          <button onClick={reset} className="cf-btn cf-btn-ghost" style={{ marginTop: 18 }}>Start over</button>
        </section>
      )}

      <footer className="pk-wrap cf-foot">Show your match to any of our team, and we&rsquo;ll pour you a taste.</footer>
    </div>
    </PublicPage>
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
