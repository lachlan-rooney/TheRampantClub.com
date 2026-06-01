'use client'

import { use, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Member {
  member_no: string
  full_name: string
  nickname: string | null
  tier: string
  status: string
  join_date: string | null
  birthday: string | null
  email: string | null
  phone: string | null
  referred_by: string | null
}

interface Preference {
  preference_id: string
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  last_validated: string
  validation_count: number
  days_since: number
  ps_t: number
  score_health_pct: number
  needs_revalidation: string
  source: string | null
  contradiction: boolean
  logged_by: string | null
  created_date: string | null
}

const CATEGORIES = [
  'All categories',
  'Personal & Lifestyle',
  'Food & Beverage',
  'Whisky & Beverage',
  'Social & Networking',
  'Business & Productivity',
  'Wellness & Comfort',
  'Cultural & Intellectual',
  'Family & Personal',
  'Travel & Global',
]

export default function MisMemberProfile({ params }: { params: Promise<{ member_no: string }> }) {
  const { member_no } = use(params)
  const [member, setMember] = useState<Member | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All categories')
  const [revalOnly, setRevalOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/mis/preferences?member_no=${encodeURIComponent(member_no)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.member) setMember(d.member)
        if (d.preferences) setPreferences(d.preferences)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [member_no])

  const score5s = useMemo(() => preferences.filter(p => p.s0 === 5), [preferences])

  const filtered = useMemo(() => {
    return preferences.filter(p => {
      if (category !== 'All categories' && p.category !== category) return false
      if (revalOnly && !p.needs_revalidation.includes('REVALIDATE')) return false
      return true
    })
  }, [preferences, category, revalOnly])

  if (loading) return <div style={emptyText}>Loading…</div>
  if (!member) return <div style={emptyText}>Member not found.</div>

  return (
    <>
      <Link href="/admin/mis" style={backLink}>← Back to members</Link>

      <div style={profileHeader}>
        <div>
          <div style={memberNoBadge}>{member.member_no}</div>
          <h1 style={pageTitle}>{member.full_name}</h1>
          {member.nickname && <div style={nicknameText}>“{member.nickname}”</div>}
        </div>
        <div style={metaPanel}>
          <div style={metaItem}><span style={metaLabel}>Tier</span><span style={metaValue}>{member.tier}</span></div>
          <div style={metaItem}><span style={metaLabel}>Status</span><span style={metaValue}>{member.status}</span></div>
          <div style={metaItem}><span style={metaLabel}>Joined</span><span style={metaValue}>{fmtDate(member.join_date)}</span></div>
          {member.birthday && <div style={metaItem}><span style={metaLabel}>Birthday</span><span style={metaValue}>{fmtDate(member.birthday)}</span></div>}
          {member.referred_by && <div style={metaItem}><span style={metaLabel}>Referred by</span><span style={metaValue}>{member.referred_by}</span></div>}
        </div>
      </div>

      {score5s.length > 0 && (
        <div style={score5Panel}>
          <div style={panelLabel}>The non-negotiables · S₀ = 5</div>
          <div style={score5Grid}>
            {score5s.map(p => (
              <div key={p.preference_id} style={score5Card}>
                <div style={score5Category}>{p.category}</div>
                <div style={score5Name}>{p.preference_name}</div>
                {p.detail && <div style={score5Detail}>{p.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={filterRow}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setRevalOnly(v => !v)}
          style={{ ...inputStyle, cursor: 'pointer', background: revalOnly ? 'rgba(212,184,90,0.18)' : 'rgba(229,212,194,0.06)' }}
        >
          {revalOnly ? '✓ Needs revalidation only' : 'Filter: needs revalidation'}
        </button>
        <div style={{ marginLeft: 'auto', alignSelf: 'center', fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.7 }}>
          {filtered.length} of {preferences.length}
        </div>
      </div>

      <div>
        <div style={prefListHeader}>
          <span style={{ ...prefColCategory, color: '#B2AA98' }}>Category</span>
          <span style={{ ...prefColName, color: '#B2AA98' }}>Preference</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>S₀</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>C</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>λ</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>F</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>Days</span>
          <span style={{ ...prefColScoreWide, color: '#B2AA98' }}>PS(t)</span>
          <span style={{ ...prefColScore, color: '#B2AA98' }}>Health</span>
          <span style={{ ...prefColFlag, color: '#B2AA98' }}>Flag</span>
        </div>

        {filtered.length === 0 ? (
          <div style={emptyText}>No preferences match.</div>
        ) : filtered.map(p => {
          const expanded = expandedId === p.preference_id
          const flag = p.needs_revalidation.includes('REVALIDATE')
          return (
            <div key={p.preference_id} style={{ borderBottom: '1px solid rgba(229,212,194,0.08)' }}>
              <div onClick={() => setExpandedId(expanded ? null : p.preference_id)} style={{ ...prefRow, cursor: 'pointer' }}>
                <span style={prefColCategory}>{p.category}</span>
                <span style={prefColName}>
                  <div style={{ color: '#E5D4C2', fontFamily: "'Rampant Sans', serif", fontSize: 14 }}>{p.preference_name}</div>
                  {p.subcategory && <div style={{ color: '#B2AA98', fontFamily: "'Google Sans Code', monospace", fontSize: 10, opacity: 0.7, marginTop: 2 }}>{p.subcategory}</div>}
                </span>
                <span style={{ ...prefColScore, color: p.s0 === 5 ? '#D4B85A' : '#E5D4C2' }}>{p.s0}</span>
                <span style={prefColScore}>{p.confidence.toFixed(2)}</span>
                <span style={prefColScore}>{p.lambda.toFixed(3)}</span>
                <span style={prefColScore}>{p.frequency.toFixed(1)}</span>
                <span style={prefColScore}>{p.days_since}</span>
                <span style={{ ...prefColScoreWide, color: '#E5D4C2', fontWeight: 600 }}>{Number(p.ps_t).toFixed(2)}</span>
                <span style={{ ...prefColScore, color: p.score_health_pct >= 100 ? '#D4B85A' : p.score_health_pct >= 70 ? '#E5D4C2' : '#C27070' }}>
                  {p.score_health_pct}%
                </span>
                <span style={{ ...prefColFlag, color: flag ? '#D4B85A' : '#7AB07A' }}>{flag ? '⚠' : '✓'}</span>
              </div>
              {expanded && (
                <div style={prefExpanded}>
                  {p.detail && (
                    <div style={prefSection}>
                      <div style={prefSectionLabel}>Detail</div>
                      <div style={prefSectionBody}>{p.detail}</div>
                    </div>
                  )}
                  {p.verbatim_quote && (
                    <div style={prefSection}>
                      <div style={prefSectionLabel}>Verbatim</div>
                      <div style={{ ...prefSectionBody, fontStyle: 'italic' }}>“{p.verbatim_quote}”</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>Last validated</span>{fmtDate(p.last_validated)}</div>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>Validations</span>{p.validation_count}</div>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>Source</span>{p.source || '—'}</div>
                    <div style={prefMetaItem}><span style={prefMetaLabel}>Logged by</span>{p.logged_by || '—'}</div>
                    {p.contradiction && <div style={prefMetaItem}><span style={prefMetaLabel}>Contradiction</span>YES</div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 24, textDecoration: 'none',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '8px 0 0',
}
const profileHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  marginBottom: 32, gap: 32, flexWrap: 'wrap',
}
const memberNoBadge: React.CSSProperties = {
  display: 'inline-block', padding: '4px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.10em',
  background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 4,
}
const nicknameText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.7, marginTop: 6, letterSpacing: '0.04em',
}
const metaPanel: React.CSSProperties = {
  display: 'flex', gap: 24, flexWrap: 'wrap',
  padding: '14px 20px',
  background: 'rgba(229,212,194,0.04)', borderRadius: 8,
}
const metaItem: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const metaLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
}
const metaValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2',
}
const score5Panel: React.CSSProperties = {
  marginBottom: 28, padding: 20,
  background: 'rgba(212,184,90,0.06)',
  border: '1px solid rgba(212,184,90,0.20)', borderRadius: 10,
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 14,
}
const score5Grid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
}
const score5Card: React.CSSProperties = {
  padding: 14,
  background: 'rgba(5,46,32,0.4)', borderRadius: 6,
  border: '1px solid rgba(212,184,90,0.10)',
}
const score5Category: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const score5Name: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2',
  marginBottom: 6,
}
const score5Detail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.5,
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, boxSizing: 'border-box', outline: 'none',
}
const prefListHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '12px 0 8px',
  borderBottom: '1px solid rgba(229,212,194,0.08)',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  letterSpacing: '0.10em', textTransform: 'uppercase',
}
const prefRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '14px 0',
}
const prefColCategory: React.CSSProperties = {
  flex: '0 0 150px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98',
}
const prefColName: React.CSSProperties = { flex: 1, minWidth: 180, color: '#E5D4C2', paddingRight: 12 }
const prefColScore: React.CSSProperties = {
  flex: '0 0 50px', textAlign: 'right',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2',
}
const prefColScoreWide: React.CSSProperties = {
  flex: '0 0 60px', textAlign: 'right',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2',
}
const prefColFlag: React.CSSProperties = {
  flex: '0 0 36px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 14,
}
const prefExpanded: React.CSSProperties = {
  padding: '0 0 18px 150px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2',
}
const prefSection: React.CSSProperties = { marginBottom: 10 }
const prefSectionLabel: React.CSSProperties = {
  fontSize: 10, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const prefSectionBody: React.CSSProperties = {
  color: '#E5D4C2', lineHeight: 1.6,
}
const prefMetaItem: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  fontSize: 11, color: '#E5D4C2',
}
const prefMetaLabel: React.CSSProperties = {
  fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
