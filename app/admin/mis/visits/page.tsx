'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'

// Global visits log. Read-only browse across all members. Logging new visits
// happens on the member profile (you almost always know who you're logging
// for at the moment of logging).

interface Visit {
  visit_id: string
  member_no: string
  visit_date: string
  space: string | null
  duration_min: number | null
  emotional_state: string | null
  logged_by: string | null
  notes: string | null
  created_at: string
}

interface MemberLite {
  member_no: string
  full_name: string
}

export default function MisVisitsLog() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [members, setMembers] = useState<MemberLite[]>([])
  const [memberFilter, setMemberFilter] = useState('All members')
  const [loading, setLoading] = useState(true)

  const memberByNo = useMemo(() => {
    const m: Record<string, string> = {}
    for (const x of members) m[x.member_no] = x.full_name
    return m
  }, [members])

  const load = useCallback(() => {
    setLoading(true)
    const qs = memberFilter !== 'All members' ? `?member_no=${encodeURIComponent(memberFilter)}` : ''
    Promise.all([
      fetch(`/api/admin/mis/visits${qs}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/mis/members', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([v, m]) => {
      if (v.visits) setVisits(v.visits)
      if (m.members) setMembers(m.members.map((x: { member_no: string; full_name: string }) => ({ member_no: x.member_no, full_name: x.full_name })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [memberFilter])

  useEffect(() => { load() }, [load])

  return (
    <>
      <Link href="/admin/mis" style={backLink}>← Members</Link>

      <div style={headerRow}>
        <h1 style={pageTitle}>Visits log</h1>
        <div style={countText}>{visits.length} {visits.length === 1 ? 'visit' : 'visits'}</div>
      </div>

      <p style={lede}>
        Every visit logged here feeds the <b style={{ color: '#E5D4C2' }}>M</b> term inside PS(t). A
        member with two or more visits per month starts to amplify their preference scores; a
        lapsed member floors to 0.8. New visits are logged from each member&rsquo;s profile.
      </p>

      <div style={filterRow}>
        <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} style={inputStyle}>
          <option value="All members">All members</option>
          {members.map(m => (
            <option key={m.member_no} value={m.member_no}>{m.member_no} · {m.full_name}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={listHeader}>
          <span style={{ ...colDate, color: '#B2AA98' }}>Date</span>
          <span style={{ ...colMember, color: '#B2AA98' }}>Member</span>
          <span style={{ ...colSpace, color: '#B2AA98' }}>Space</span>
          <span style={{ ...colMeta, color: '#B2AA98' }}>Duration</span>
          <span style={{ ...colMeta, color: '#B2AA98' }}>State</span>
          <span style={{ ...colLogged, color: '#B2AA98' }}>Logged by</span>
        </div>

        {loading ? (
          <div style={emptyText}>Loading…</div>
        ) : visits.length === 0 ? (
          <div style={emptyText}>
            No visits logged yet. Open a member profile and click &ldquo;Log a visit&rdquo; to begin.
          </div>
        ) : visits.map(v => (
          <Link key={v.visit_id} href={`/admin/mis/${v.member_no}`} style={rowLink}>
            <div style={listRow}>
              <span style={colDate}>{fmtDate(v.visit_date)}</span>
              <span style={colMember}>
                <span style={{ color: '#E5D4C2', fontFamily: "'Rampant Sans', serif", fontSize: 14 }}>
                  {memberByNo[v.member_no] || v.member_no}
                </span>
                <span style={{ marginLeft: 8, color: '#B2AA98', fontFamily: "'Google Sans Code', monospace", fontSize: 10, opacity: 0.7 }}>{v.member_no}</span>
              </span>
              <span style={colSpace}>{v.space || '—'}</span>
              <span style={colMeta}>{v.duration_min != null ? `${v.duration_min} min` : '—'}</span>
              <span style={colMeta}>{v.emotional_state || '—'}</span>
              <span style={colLogged}>{v.logged_by || '—'}</span>
            </div>
            {v.notes && (
              <div style={notesRow}>{v.notes}</div>
            )}
          </Link>
        ))}
      </div>
    </>
  )
}

function fmtDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── styles ──────────────────────────────────────────────────────────
const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 24, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  marginBottom: 12,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: 0,
}
const countText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.7,
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720,
  margin: '0 0 24px',
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, boxSizing: 'border-box', outline: 'none', minWidth: 240,
}
const listHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '12px 0 8px',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.10em', textTransform: 'uppercase',
}
const listRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '16px 0',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
}
const rowLink: React.CSSProperties = {
  display: 'block', textDecoration: 'none', color: 'inherit',
}
const colDate: React.CSSProperties = {
  flex: '0 0 110px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const colMember: React.CSSProperties = { flex: '1 1 180px', minWidth: 160 }
const colSpace: React.CSSProperties = {
  flex: '0 0 150px',
  fontFamily: "'Rampant Sans', serif", fontSize: 13, color: '#E5D4C2',
}
const colMeta: React.CSSProperties = {
  flex: '0 0 100px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98',
}
const colLogged: React.CSSProperties = {
  flex: '0 0 160px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7, letterSpacing: '0.04em',
}
const notesRow: React.CSSProperties = {
  marginTop: -8, marginBottom: 8, paddingLeft: 110,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', opacity: 0.7, lineHeight: 1.6,
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
