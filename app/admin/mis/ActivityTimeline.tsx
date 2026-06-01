'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { vnDateTimeString } from '@/lib/datetime'

// Per-member activity timeline. Reads from the consolidated activity
// endpoint — visits, preferences, validation events, candidates, gifts,
// observations, complaints — and renders them as one descending feed.

interface TimelineEntry {
  id: string
  kind: 'visit' | 'preference_created' | 'validation_event' | 'candidate' | 'gift' | 'observation' | 'complaint'
  at: string
  title: string
  detail: string | null
  meta: Record<string, unknown>
  href: string | null
}

const KIND_META: Record<TimelineEntry['kind'], { icon: string; color: string; label: string }> = {
  visit:                { icon: '◉', color: '#7AB07A', label: 'Visit' },
  preference_created:   { icon: '＋', color: '#D4B85A', label: 'Preference' },
  validation_event:     { icon: '✓', color: '#7AB07A', label: 'Validation' },
  candidate:            { icon: '◇', color: '#9E8FC4', label: 'Candidate' },
  gift:                 { icon: '✦', color: '#D4B85A', label: 'Gift' },
  observation:          { icon: '◆', color: '#5B8FA8', label: 'Observation' },
  complaint:            { icon: '⚠', color: '#C27070', label: 'Complaint' },
}

const KIND_LABEL_FILTERS: Array<{ key: TimelineEntry['kind'] | 'all'; label: string }> = [
  { key: 'all',                 label: 'All' },
  { key: 'visit',               label: 'Visits' },
  { key: 'preference_created',  label: 'Prefs added' },
  { key: 'validation_event',    label: 'Validations' },
  { key: 'candidate',           label: 'Candidates' },
  { key: 'gift',                label: 'Gifts' },
  { key: 'observation',         label: 'Observations' },
  { key: 'complaint',           label: 'Complaints' },
]

export default function ActivityTimeline({ memberNo }: { memberNo: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TimelineEntry['kind'] | 'all'>('all')

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/mis/members/${encodeURIComponent(memberNo)}/activity`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [memberNo])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => filter === 'all' ? entries : entries.filter(e => e.kind === filter), [entries, filter])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of entries) m[e.kind] = (m[e.kind] || 0) + 1
    return m
  }, [entries])

  // Group entries by ISO date (YYYY-MM-DD in Vietnam time) for the
  // sticky date rail.
  const groups = useMemo(() => {
    const g: Array<{ date: string; entries: TimelineEntry[] }> = []
    for (const e of filtered) {
      const day = new Date(e.at).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
      const last = g[g.length - 1]
      if (last && last.date === day) last.entries.push(e)
      else g.push({ date: day, entries: [e] })
    }
    return g
  }, [filtered])

  return (
    <div style={panel}>
      <div style={panelHeader}>
        <div style={panelLabel}>Activity timeline</div>
        <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.7 }}>
          {entries.length} events on file
        </div>
      </div>

      {/* Filters */}
      <div style={filterRow}>
        {KIND_LABEL_FILTERS.map(f => {
          const count = f.key === 'all' ? entries.length : counts[f.key] || 0
          if (f.key !== 'all' && count === 0) return null
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{ ...filterChip, ...(filter === f.key ? filterChipActive : null) }}
            >
              {f.label}
              {count > 0 && <span style={miniBadge}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Feed */}
      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={emptyText}>No {filter === 'all' ? 'activity' : KIND_LABEL_FILTERS.find(f => f.key === filter)?.label.toLowerCase()} on file.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map(group => (
            <div key={group.date}>
              <div style={dateHeader}>{prettyDay(group.date)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.entries.map(e => {
                  const meta = KIND_META[e.kind]
                  const body = (
                    <div style={{ ...entryRow, borderLeftColor: meta.color }}>
                      <div style={{ ...iconBubble, color: meta.color, borderColor: meta.color + '50' }}>{meta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span style={entryTitle}>{e.title}</span>
                          <span style={entryTime}>{vnDateTimeString(e.at)}</span>
                        </div>
                        {e.detail && <div style={entryDetail}>{e.detail}</div>}
                      </div>
                    </div>
                  )
                  return e.href ? (
                    <Link key={e.id} href={e.href} style={entryLink}>{body}</Link>
                  ) : (
                    <div key={e.id}>{body}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function prettyDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00+07:00')
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── styles ────────────────────────────────────────────────────────────
const panel: React.CSSProperties = {
  marginBottom: 32, padding: 22,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
}
const panelHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 14, gap: 12, flexWrap: 'wrap',
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap',
}
const filterChip: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '5px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 5,
}
const filterChipActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)',
}
const miniBadge: React.CSSProperties = {
  background: 'rgba(229,212,194,0.10)', color: '#E5D4C2',
  borderRadius: 8, padding: '0 5px',
  fontSize: 9, fontWeight: 600,
}
const dateHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 8,
}
const entryLink: React.CSSProperties = {
  textDecoration: 'none', color: 'inherit', display: 'block',
}
const entryRow: React.CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  padding: '10px 12px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderLeft: '3px solid',
  borderRadius: 4,
}
const iconBubble: React.CSSProperties = {
  flexShrink: 0,
  width: 24, height: 24,
  borderRadius: '50%',
  background: 'rgba(5,46,32,0.6)',
  border: '1px solid',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12, fontWeight: 600,
}
const entryTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', fontWeight: 500,
}
const entryTime: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em',
}
const entryDetail: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.55,
  overflow: 'hidden', textOverflow: 'ellipsis',
  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
