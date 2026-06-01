'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import FormulaExplainer from './FormulaExplainer'

interface MemberStats {
  active: number
  score_5s: number
  needs_revalidation: number
  avg_ps: number
}

interface Member {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  join_date: string | null
  email: string | null
  stats: MemberStats
}

const ALL_TIERS = ['All tiers', 'Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']
const ALL_STATUSES = ['All statuses', 'Active', 'Inactive', 'Suspended']

export default function MisMembersList() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('All tiers')
  const [status, setStatus] = useState('All statuses')

  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.members) setMembers(d.members); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter(m => {
      if (tier !== 'All tiers' && m.tier !== tier) return false
      if (status !== 'All statuses' && m.status !== status) return false
      if (q && !`${m.member_no} ${m.full_name} ${m.nickname || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [members, search, tier, status])

  return (
    <>
      <div style={headerRow}>
        <h1 style={pageTitle}>Member Intelligence</h1>
        <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.7 }}>
          {filtered.length} of {members.length}
        </div>
      </div>

      <FormulaExplainer />

      <div style={filterRow}>
        <input
          type="text"
          placeholder="Search by name, nickname, or member no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        <select value={tier} onChange={e => setTier(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          {ALL_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={emptyText}>No members match these filters.</div>
      ) : (
        <div>
          <div style={listHeader}>
            <span style={{ ...colMemberNo, color: '#B2AA98' }}>Member</span>
            <span style={{ ...colName, color: '#B2AA98' }}>Name</span>
            <span style={{ ...colTier, color: '#B2AA98' }}>Tier</span>
            <span style={{ ...colStats, color: '#B2AA98' }}>Prefs</span>
            <span style={{ ...colStats, color: '#B2AA98' }}>Score 5s</span>
            <span style={{ ...colStats, color: '#B2AA98' }}>Revalidate</span>
            <span style={{ ...colStats, color: '#B2AA98' }}>Avg PS</span>
          </div>
          {filtered.map(m => (
            <Link key={m.member_no} href={`/admin/mis/${m.member_no}`} style={rowLink}>
              <div style={listRow}>
                <span style={colMemberNo}>{m.member_no}</span>
                <span style={colName}>
                  <span style={{ color: '#E5D4C2', fontFamily: "'Rampant Sans', serif", fontSize: 14 }}>{m.full_name}</span>
                  {m.nickname && <span style={{ marginLeft: 8, color: '#B2AA98', fontFamily: "'Google Sans Code', monospace", fontSize: 10, opacity: 0.7 }}>“{m.nickname}”</span>}
                </span>
                <span style={colTier}>{m.tier}</span>
                <span style={colStats}>{m.stats.active}</span>
                <span style={{ ...colStats, color: m.stats.score_5s > 0 ? '#D4B85A' : '#B2AA98' }}>{m.stats.score_5s}</span>
                <span style={{ ...colStats, color: m.stats.needs_revalidation > 0 ? '#D4B85A' : '#B2AA98' }}>{m.stats.needs_revalidation}</span>
                <span style={colStats}>{m.stats.avg_ps.toFixed(2)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: 0,
}
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  marginBottom: 20,
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, boxSizing: 'border-box', outline: 'none',
}
const listHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '12px 0 8px',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  letterSpacing: '0.10em', textTransform: 'uppercase',
}
const listRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '16px 0',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  transition: 'background 0.15s ease',
}
const rowLink: React.CSSProperties = {
  display: 'block', textDecoration: 'none', color: 'inherit',
}
const colMemberNo: React.CSSProperties = {
  flex: '0 0 110px',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const colName: React.CSSProperties = {
  flex: 1, minWidth: 180, color: '#E5D4C2',
}
const colTier: React.CSSProperties = {
  flex: '0 0 110px',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const colStats: React.CSSProperties = {
  flex: '0 0 90px',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
  color: '#E5D4C2', textAlign: 'right', paddingRight: 8,
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
