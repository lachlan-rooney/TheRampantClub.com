'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'

// MIS Pipeline — list view.
// Kanban with one column per stage, cards within. Click a card to drill into
// the detail view. Search across name/nickname/profession; filter by source
// and assigned_to. Stats row up top shows the full distribution.

interface Prospect {
  prospect_id: string
  stage: string
  full_name: string
  nickname: string | null
  referred_by_name: string | null
  referred_by_member_no: string | null
  source_channel: string | null
  contact_info: string | null
  first_contact_date: string | null
  next_action: string | null
  next_action_date: string | null
  assigned_to: string | null
  notes: string | null
  profession: string | null
  cultural_fit: number | null
  social_compatibility: number | null
  commercial_potential: number | null
  whisky_interest: number | null
  brand_alignment: number | null
  community_value: number | null
  decision: string | null
  converted_member_no: string | null
  letter_sent: boolean
  days_in_pipeline: number | null
  overall_score: number | null
}

const ACTIVE_STAGES = [
  'Lead',
  'Initial Contact',
  'Interview Scheduled',
  'Interview Complete',
  'Application Received',
  'Onboarded',
] as const
const OFFRAMP_STAGES = ['Declined', 'Withdrawn', 'On Hold'] as const

const STAGE_ACCENT: Record<string, string> = {
  'Lead':                  '#5E6650',
  'Initial Contact':       '#7A8470',
  'Interview Scheduled':   '#D4B85A',
  'Interview Complete':    '#D4B85A',
  'Application Received':  '#C49555',
  'Onboarded':             '#7AB07A',
  'Declined':              '#C27070',
  'Withdrawn':             '#8A6B6B',
  'On Hold':               '#9E8A6A',
}

export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('All sources')
  const [assigned, setAssigned] = useState('All staff')
  const [showOfframps, setShowOfframps] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/mis/prospects', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.prospects) setProspects(d.prospects); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const sources = useMemo(() => {
    const s = new Set<string>()
    for (const p of prospects) if (p.source_channel) s.add(p.source_channel)
    return ['All sources', ...Array.from(s).sort()]
  }, [prospects])
  const staff = useMemo(() => {
    const s = new Set<string>()
    for (const p of prospects) if (p.assigned_to) s.add(p.assigned_to)
    return ['All staff', ...Array.from(s).sort()]
  }, [prospects])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return prospects.filter(p => {
      if (q && !`${p.full_name} ${p.nickname || ''} ${p.profession || ''} ${p.prospect_id}`.toLowerCase().includes(q)) return false
      if (source !== 'All sources' && p.source_channel !== source) return false
      if (assigned !== 'All staff' && p.assigned_to !== assigned) return false
      return true
    })
  }, [prospects, search, source, assigned])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of filtered) counts[p.stage] = (counts[p.stage] || 0) + 1
    return counts
  }, [filtered])

  const totalActive = ACTIVE_STAGES.reduce((sum, s) => sum + (stageCounts[s] || 0), 0)
  const totalOfframp = OFFRAMP_STAGES.reduce((sum, s) => sum + (stageCounts[s] || 0), 0)
  const totalOnboarded = stageCounts['Onboarded'] || 0
  const conversionPct = totalActive > 0 ? Math.round((totalOnboarded / totalActive) * 100) : 0

  const stages: readonly string[] = showOfframps ? [...ACTIVE_STAGES, ...OFFRAMP_STAGES] : ACTIVE_STAGES

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Member Intelligence</div>
          <h1 style={pageTitle}>Pipeline</h1>
        </div>
        <Link href="/admin/mis/pipeline/new" style={addBtn}>+ New prospect</Link>
      </div>

      {/* Stats strip */}
      <div style={statsStrip}>
        <Stat label="In pipeline" value={String(filtered.length)} accent="#E5D4C2" />
        <Stat label="Onboarded" value={String(totalOnboarded)} accent="#7AB07A" />
        <Stat label="Off-ramps" value={String(totalOfframp)} accent="#C27070" />
        <Stat label="Conversion" value={`${conversionPct}%`} accent="#D4B85A" />
      </div>

      {/* Filter row */}
      <div style={filterRow}>
        <input
          type="text"
          placeholder="Search name, profession, ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        <select value={source} onChange={e => setSource(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assigned} onChange={e => setAssigned(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          {staff.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={offrampToggle}>
          <input type="checkbox" checked={showOfframps} onChange={e => setShowOfframps(e.target.checked)} />
          Show off-ramps
        </label>
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={emptyText}>Loading prospects…</div>
      ) : (
        <div style={kanban}>
          {stages.map(stage => {
            const inStage = filtered.filter(p => p.stage === stage)
            const accent = STAGE_ACCENT[stage] || '#5E6650'
            return (
              <div key={stage} style={kanbanCol}>
                <div style={{ ...kanbanHead, borderTopColor: accent }}>
                  <div style={kanbanStage}>{stage}</div>
                  <div style={kanbanCount}>{inStage.length}</div>
                </div>
                <div style={kanbanList}>
                  {inStage.length === 0 ? (
                    <div style={kanbanEmpty}>—</div>
                  ) : inStage.map(p => <ProspectCard key={p.prospect_id} p={p} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={statCard}>
      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 600, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}

function ProspectCard({ p }: { p: Prospect }) {
  return (
    <Link href={`/admin/mis/pipeline/${p.prospect_id}`} style={cardLink}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={cardName}>{p.full_name}</div>
          {p.letter_sent && <span style={letterDot} title="Letter sent">✉</span>}
        </div>
        {p.nickname && <div style={cardSub}>{p.nickname}</div>}

        <div style={cardChipsRow}>
          {p.source_channel && (
            <span style={cardChip}>
              {p.source_channel === 'Referral' ? '👤' : p.source_channel === 'Event' ? '🎪' : '✈'}
              <span style={{ marginLeft: 4 }}>{p.source_channel}</span>
            </span>
          )}
          {p.overall_score != null && (
            <span style={{ ...cardChip, background: 'rgba(212,184,90,0.12)', color: '#D4B85A' }}>
              ⭐ {Number(p.overall_score).toFixed(1)}
            </span>
          )}
          {p.days_in_pipeline != null && (
            <span style={cardChipMuted}>{p.days_in_pipeline}d</span>
          )}
        </div>

        {p.referred_by_name && (
          <div style={cardLine}>
            <span style={cardLineLabel}>Ref</span> {p.referred_by_name}
          </div>
        )}
        {p.profession && (
          <div style={cardLine}>
            <span style={cardLineLabel}>Sector</span> {p.profession}
          </div>
        )}
        {p.next_action && (
          <div style={cardNextAction}>
            <span style={{ color: '#D4B85A' }}>→</span> {p.next_action}
            {p.next_action_date && <span style={{ marginLeft: 6, opacity: 0.6 }}>· {fmtShort(p.next_action_date)}</span>}
          </div>
        )}
      </div>
    </Link>
  )
}

function fmtShort(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── styles ──────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: 0,
}
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  marginBottom: 22, gap: 24, flexWrap: 'wrap',
}
const addBtn: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  padding: '10px 18px', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.08em', textDecoration: 'none',
}
const statsStrip: React.CSSProperties = {
  display: 'grid', gap: 14, marginBottom: 22,
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
}
const statCard: React.CSSProperties = {
  padding: 16,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap',
  alignItems: 'center',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, boxSizing: 'border-box', outline: 'none',
}
const offrampToggle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', cursor: 'pointer', userSelect: 'none',
  marginLeft: 'auto',
}
const kanban: React.CSSProperties = {
  display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12,
}
const kanbanCol: React.CSSProperties = {
  flex: '0 0 280px', minHeight: 400,
  background: 'rgba(229,212,194,0.025)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10,
  display: 'flex', flexDirection: 'column',
}
const kanbanHead: React.CSSProperties = {
  padding: '14px 16px 12px',
  borderTop: '3px solid #5E6650',
  borderRadius: '10px 10px 0 0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
}
const kanbanStage: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E5D4C2', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const kanbanCount: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#D4B85A', fontWeight: 600,
}
const kanbanList: React.CSSProperties = {
  flex: 1, padding: '4px 10px 10px',
  display: 'flex', flexDirection: 'column', gap: 8,
  maxHeight: '70vh', overflowY: 'auto',
}
const kanbanEmpty: React.CSSProperties = {
  padding: '24px 8px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.4,
}
const cardLink: React.CSSProperties = {
  textDecoration: 'none', color: 'inherit',
}
const card: React.CSSProperties = {
  padding: 12,
  background: 'rgba(5,46,32,0.45)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
}
const cardName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2',
  fontWeight: 500, lineHeight: 1.2,
}
const cardSub: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.75, marginTop: 3, lineHeight: 1.3,
}
const cardChipsRow: React.CSSProperties = {
  display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10,
}
const cardChip: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', background: 'rgba(229,212,194,0.06)',
  padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em',
  display: 'inline-flex', alignItems: 'center',
}
const cardChipMuted: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.6,
  padding: '2px 6px', letterSpacing: '0.04em',
}
const cardLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E5D4C2', opacity: 0.75, marginTop: 6, lineHeight: 1.4,
}
const cardLineLabel: React.CSSProperties = {
  color: '#B2AA98', opacity: 0.7, letterSpacing: '0.06em',
  textTransform: 'uppercase', fontSize: 8, marginRight: 4,
}
const cardNextAction: React.CSSProperties = {
  marginTop: 10, padding: '6px 8px',
  background: 'rgba(212,184,90,0.06)', borderLeft: '2px solid rgba(212,184,90,0.30)',
  borderRadius: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E5D4C2',
}
const letterDot: React.CSSProperties = {
  fontSize: 11, color: '#D4B85A', flexShrink: 0,
}
const emptyText: React.CSSProperties = {
  padding: '60px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
