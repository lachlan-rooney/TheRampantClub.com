'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// Admin / Floor / Evening Recap
//
// Chronological list of past shift logs. Headline metric per row is the
// AI extraction summary: total extractions, applied, pending review.

interface HarmonyLog {
  id: string
  shift_date: string
  shift_label: string
  attendee_count: number | null
  weather: string | null
  room_state: string | null
  narrative: string
  status: string
  submitted_by: string | null
  created_at: string
  extraction_count: number
  pending_count: number
  accepted_count: number
  applied_count: number
  rejected_count: number
}

export default function HarmonyListPage() {
  const [logs, setLogs] = useState<HarmonyLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/recap', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Floor</div>
          <h1 style={pageTitle}>Evening Recap</h1>
          <p style={lede}>
            End-of-shift narrative — type what happened tonight in plain English. Claude reads it back and proposes structured updates (visits, preferences, bottle pours, walk-ins, complaints, card charges). Tick the ones you want, accept, done. Everything fans out to the right place.
          </p>
        </div>
        <Link href="/admin/recap/new" style={btnPrimary}>＋ New shift</Link>
      </div>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={emptyBlock}>
          <div style={{ marginBottom: 16 }}>No shifts logged yet.</div>
          <Link href="/admin/recap/new" style={btnPrimary}>＋ Log tonight</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map(l => {
            const d = new Date(l.shift_date)
            const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
            const datePretty = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            const totalReviewable = l.pending_count + l.accepted_count
            const preview = l.narrative.slice(0, 240) + (l.narrative.length > 240 ? '…' : '')
            return (
              <Link key={l.id} href={`/admin/recap/${l.id}`} style={row}>
                <div style={dateBox}>
                  <div style={dateWeekday}>{weekday}</div>
                  <div style={dateNum}>{d.getDate()}</div>
                  <div style={dateMonth}>{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={shiftLabel}>{l.shift_label}</span>
                    <span style={statusPill(l.status)}>{l.status}</span>
                    {l.attendee_count != null && (
                      <span style={metaPill}>{l.attendee_count} in</span>
                    )}
                    {l.weather && <span style={metaPill}>{l.weather.slice(0, 24)}</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
                      {datePretty}
                    </span>
                  </div>
                  <div style={narrativePreview}>{preview}</div>
                  <div style={statsRow}>
                    <span style={statlet}>
                      <strong style={{ color: '#E5D4C2' }}>{l.extraction_count}</strong> extracted
                    </span>
                    {l.applied_count > 0 && (
                      <span style={statlet}>
                        <strong style={{ color: '#7AB07A' }}>{l.applied_count}</strong> applied
                      </span>
                    )}
                    {totalReviewable > 0 && (
                      <span style={statlet}>
                        <strong style={{ color: '#D4B85A' }}>{totalReviewable}</strong> awaiting review
                      </span>
                    )}
                    {l.rejected_count > 0 && (
                      <span style={statlet}>
                        <strong style={{ color: '#7E7864' }}>{l.rejected_count}</strong> rejected
                      </span>
                    )}
                    <span style={{ ...statlet, marginLeft: 'auto' }}>{l.submitted_by || 'unknown'}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

function statusPill(s: string): React.CSSProperties {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    draft:     { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.16)' },
    extracted: { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)',  bd: 'rgba(212,184,90,0.40)' },
    reviewed:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)',  bd: 'rgba(212,184,90,0.30)' },
    applied:   { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
  }
  const p = map[s] || map.draft
  return {
    background: p.bg, color: p.fg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '2px 8px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}

const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 24,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const row: React.CSSProperties = {
  display: 'flex', gap: 14,
  padding: 16,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, textDecoration: 'none',
}
const dateBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  width: 60, padding: '8px 0',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.18)',
  borderRadius: 6,
}
const dateWeekday: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const dateNum: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 600,
  color: '#E5D4C2', lineHeight: 1, margin: '2px 0',
}
const dateMonth: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.08em',
}
const shiftLabel: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, fontWeight: 500,
  color: '#E5D4C2', textTransform: 'capitalize', letterSpacing: '0.04em',
}
const metaPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '1px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.04em',
}
const narrativePreview: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6,
  overflow: 'hidden', textOverflow: 'ellipsis',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
}
const statsRow: React.CSSProperties = {
  display: 'flex', gap: 14, flexWrap: 'wrap',
  marginTop: 10, paddingTop: 8,
  borderTop: '1px solid rgba(229,212,194,0.05)',
}
const statlet: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textDecoration: 'none', textAlign: 'center',
}
const emptyBlock: React.CSSProperties = {
  padding: '60px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
