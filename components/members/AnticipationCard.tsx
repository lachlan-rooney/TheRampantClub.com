'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// PASSIVE pre-visit card. Composes the member's next real booking and renders on
// the dashboard — nothing is sent, no staff action, no fabrication (it shows only
// what's true). Its one action deep-links into the concierge thread with context
// pre-filled (NOT pre-sent). No booking → renders nothing.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Booking { date: string; start_time: string | null; session_label: string | null; space: string; party_size: number | null; tables: string[] }
interface Evt { title: string; start_time: string | null }

const withArticle = (s: string) => (/^(the|a)\b/i.test(s) ? s : `the ${s}`)
function dateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
function timeLabel(b: Booking): string {
  if (b.start_time) return b.start_time.slice(0, 5)
  if (b.session_label) return b.session_label.charAt(0).toUpperCase() + b.session_label.slice(1)
  return ''
}
function relativeDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00'), today = new Date()
  const days = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  return ''
}

export default function AnticipationCard() {
  const [b, setB] = useState<Booking | null>(null)
  const [events, setEvents] = useState<Evt[]>([])

  useEffect(() => {
    fetch('/api/members/anticipation').then(r => r.ok ? r.json() : null).then(j => {
      if (j?.booking) { setB(j.booking); setEvents(j.events || []) }
    }).catch(() => { /* card simply doesn't render */ })
  }, [])

  if (!b) return null

  const when = [relativeDay(b.date), timeLabel(b)].filter(Boolean).join(' · ')
  const tableLine = b.tables.length
    ? `${withArticle(b.space)} — ${b.tables.map(withArticle).join(', ')}`
    : withArticle(b.space)
  // Prefill the composer (NOT sent) — an opener the member finishes.
  const prefill = `A note about my booking on ${dateLabel(b.date)} in ${withArticle(b.space)}: `

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={kicker}>We’re expecting you</div>
        {when && <div style={whenChip}>{when}</div>}
      </div>
      <div style={headline}>{dateLabel(b.date)}</div>
      <div style={detail}>
        {tableLine}
        {b.party_size && b.party_size > 1 ? ` · a table for ${b.party_size}` : ''}
      </div>
      {events.length > 0 && (
        <div style={eventLine}>
          Also in the house that day: {events.map(e => e.title).join(' · ')}
        </div>
      )}
      <Link href={`/members/concierge?prefill=${encodeURIComponent(prefill)}`} style={action}>
        A request for the evening? →
      </Link>
    </div>
  )
}

const card: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.32)', borderRadius: 14, background: 'linear-gradient(135deg, rgba(212,184,90,0.10), rgba(212,184,90,0.03))', padding: '20px 22px', marginBottom: 24 }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#D4B85A' }
const whenChip: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: '#052E20', background: '#D4B85A', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }
const headline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 22, color: '#E5D4C2', margin: '8px 0 4px', letterSpacing: '0.02em' }
const detail: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#E5D4C2', opacity: 0.85, lineHeight: 1.5 }
const eventLine: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginTop: 8, lineHeight: 1.5 }
const action: React.CSSProperties = { display: 'inline-block', marginTop: 14, fontFamily: MONO, fontSize: 12, color: '#D4B85A', textDecoration: 'none', letterSpacing: '0.04em', borderBottom: '1px solid rgba(212,184,90,0.4)', paddingBottom: 2 }
