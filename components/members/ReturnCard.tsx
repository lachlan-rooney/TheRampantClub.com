'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// PASSIVE post-visit card. The morning(s) after a recent visit, a quiet recap —
// composed from real visit + consumption rows (member-safe fields only). Degrades
// gracefully (visit but no drams → date + space). Dismissible (a cosmetic
// localStorage flag, per visit). No recent visit → renders nothing. Its one action
// deep-links into the concierge thread with context pre-filled (NOT pre-sent).

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Visit { date: string; space: string | null; duration_min: number | null; drams: string[] }

const withArticle = (s: string) => (/^(the|a)\b/i.test(s) ? s : `the ${s}`)
function dateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00'), today = new Date()
  const days = Math.round((new Date(today.toDateString()).getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'earlier today'
  if (days === 1) return 'last night'
  return `on ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
}
function durationLabel(min: number | null): string {
  if (!min || min < 30) return ''
  const h = Math.floor(min / 60), m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export default function ReturnCard() {
  const [v, setV] = useState<Visit | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    fetch('/api/members/return').then(r => r.ok ? r.json() : null).then(j => {
      if (j?.visit) {
        setV(j.visit)
        let seen = false
        try { seen = localStorage.getItem('trc-return-dismissed') === j.visit.date } catch { /* ignore */ }
        setDismissed(seen)
      }
    }).catch(() => { /* card simply doesn't render */ })
  }, [])

  if (!v || dismissed) return null

  const dur = durationLabel(v.duration_min)
  const where = v.space ? `in ${withArticle(v.space)}` : ''
  const dramLine = v.drams.length
    ? `You poured ${v.drams.slice(0, 3).map(withArticle).join(', ')}${v.drams.length > 3 ? `, and ${v.drams.length - 3} more` : ''}.`
    : ''
  const prefill = `A thought on my evening ${dateLabel(v.date)}: `

  const dismiss = () => {
    try { localStorage.setItem('trc-return-dismissed', v.date) } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div style={card}>
      <button onClick={dismiss} aria-label="Dismiss" style={closeBtn}>×</button>
      <div style={kicker}>Welcome back</div>
      <div style={headline}>Your visit {dateLabel(v.date)}</div>
      <div style={detail}>
        {[where, dur && `${dur} with us`].filter(Boolean).join(' · ') || 'Lovely to have had you in.'}
      </div>
      {dramLine && <div style={dramStyle}>{dramLine}</div>}
      <Link href={`/members/concierge?prefill=${encodeURIComponent(prefill)}`} style={action}>
        A thought on the evening? →
      </Link>
    </div>
  )
}

const card: React.CSSProperties = { position: 'relative', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 14, background: 'rgba(229,212,194,0.04)', padding: '20px 22px', marginBottom: 24 }
const closeBtn: React.CSSProperties = { position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: '#B2AA98', fontSize: 18, lineHeight: 1, cursor: 'pointer', opacity: 0.6 }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7AB07A' }
const headline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 22, color: '#E5D4C2', margin: '8px 0 4px', letterSpacing: '0.02em' }
const detail: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#E5D4C2', opacity: 0.82, lineHeight: 1.5 }
const dramStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#D4B85A', opacity: 0.85, marginTop: 8, lineHeight: 1.5 }
const action: React.CSSProperties = { display: 'inline-block', marginTop: 14, fontFamily: MONO, fontSize: 12, color: '#B2AA98', textDecoration: 'none', letterSpacing: '0.04em', borderBottom: '1px solid rgba(178,170,152,0.4)', paddingBottom: 2 }
