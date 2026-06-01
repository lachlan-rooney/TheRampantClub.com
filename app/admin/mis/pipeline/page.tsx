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

// Used by the hover quick-actions to figure out where → forwards a prospect.
const NEXT_STAGE: Record<string, string | null> = {
  'Lead':                  'Initial Contact',
  'Initial Contact':       'Interview Scheduled',
  'Interview Scheduled':   'Interview Complete',
  'Interview Complete':    'Application Received',
  'Application Received':  'Onboarded',
  'Onboarded':             null,
  'Declined':              null,
  'Withdrawn':             null,
  'On Hold':               'Lead',
}

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

      {/* Kanban — grid (fits viewport) when 6 active stages, scrollable flex when off-ramps visible */}
      {loading ? (
        <div style={emptyText}>Loading prospects…</div>
      ) : (
        <div style={showOfframps ? kanbanScroll : { ...kanbanGrid, gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
          {stages.map(stage => {
            const inStage = filtered.filter(p => p.stage === stage)
            const accent = STAGE_ACCENT[stage] || '#5E6650'
            return (
              <div key={stage} style={showOfframps ? kanbanColScroll : kanbanCol}>
                <div style={{ ...kanbanHead, borderTopColor: accent }}>
                  <div style={kanbanStage}>{stage}</div>
                  <div style={kanbanCount}>{inStage.length}</div>
                </div>
                <div style={kanbanList}>
                  {inStage.length === 0 ? (
                    <div style={kanbanEmpty}>—</div>
                  ) : inStage.map(p => <ProspectCard key={p.prospect_id} p={p} onChange={load} />)}
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

function ProspectCard({ p, onChange }: { p: Prospect; onChange: () => void }) {
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)
  const nextStage = NEXT_STAGE[p.stage]

  const fire = async (action: () => Promise<Response>) => {
    setBusy(true)
    try {
      const r = await action()
      if (r.ok) onChange()
    } finally {
      setBusy(false)
    }
  }
  const stop = (e: React.MouseEvent | React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const moveNext = (e: React.MouseEvent) => {
    stop(e)
    if (!nextStage) return
    fire(() => fetch(`/api/admin/mis/prospects/${p.prospect_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage }),
    }))
  }
  const toggleLetter = (e: React.MouseEvent) => {
    stop(e)
    fire(() => fetch(`/api/admin/mis/prospects/${p.prospect_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter_sent: !p.letter_sent }),
    }))
  }
  const archive = (e: React.MouseEvent) => {
    stop(e)
    if (!confirm(`Archive ${p.full_name}?`)) return
    fire(() => fetch(`/api/admin/mis/prospects/${p.prospect_id}`, { method: 'DELETE' }))
  }

  return (
    <Link
      href={`/admin/mis/pipeline/${p.prospect_id}`}
      style={cardLink}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ ...card, ...(hover ? cardHover : {}), opacity: busy ? 0.6 : 1 }}>
        {/* Quick-action overlay on hover */}
        {hover && (
          <div style={quickActions}>
            {nextStage && (
              <button onClick={moveNext} title={`Move to ${nextStage}`} style={quickBtn}>→</button>
            )}
            <button
              onClick={toggleLetter}
              title={p.letter_sent ? 'Mark letter not-sent' : 'Mark letter sent'}
              style={{ ...quickBtn, color: p.letter_sent ? '#D4B85A' : '#B2AA98' }}
            >
              ✉
            </button>
            <button onClick={archive} title="Archive prospect" style={{ ...quickBtn, color: '#C27070' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <div style={cardName}>{p.full_name}</div>
          {p.letter_sent && !hover && <span style={letterDot} title="Letter sent">✉</span>}
        </div>
        {p.nickname && <div style={cardSub}>{p.nickname}</div>}

        <div style={cardChipsRow}>
          {p.source_channel && (
            <span style={cardChip}>
              {p.source_channel === 'Referral' ? '↳' : p.source_channel === 'Event' ? '◇' : '→'}
              <span style={{ marginLeft: 4 }}>{p.source_channel.slice(0, 3)}</span>
            </span>
          )}
          {p.overall_score != null && (
            <span style={{ ...cardChip, background: 'rgba(212,184,90,0.14)', color: '#D4B85A' }}>
              ★ {Number(p.overall_score).toFixed(1)}
            </span>
          )}
          {p.days_in_pipeline != null && (
            <span style={cardChipMuted}>{p.days_in_pipeline}d</span>
          )}
        </div>

        {p.profession && (
          <div style={cardLine}>
            {p.profession}
          </div>
        )}
        {p.next_action && (
          <div style={cardNextAction}>
            <span style={{ color: '#D4B85A' }}>→</span> {p.next_action}
            {p.next_action_date && <span style={{ marginLeft: 4, opacity: 0.55 }}>· {fmtShort(p.next_action_date)}</span>}
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
const kanbanGrid: React.CSSProperties = {
  display: 'grid', gap: 10, paddingBottom: 12,
}
const kanbanScroll: React.CSSProperties = {
  display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12,
}
const kanbanCol: React.CSSProperties = {
  minWidth: 0,                                 // critical: allows grid cells to shrink below content width
  minHeight: 400,
  background: 'rgba(229,212,194,0.025)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10,
  display: 'flex', flexDirection: 'column',
}
const kanbanColScroll: React.CSSProperties = {
  flex: '0 0 240px',
  minHeight: 400,
  background: 'rgba(229,212,194,0.025)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10,
  display: 'flex', flexDirection: 'column',
}
const kanbanHead: React.CSSProperties = {
  padding: '12px 12px 10px',
  borderTop: '3px solid #5E6650',
  borderRadius: '10px 10px 0 0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  gap: 8,
}
const kanbanStage: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#E5D4C2', letterSpacing: '0.10em', textTransform: 'uppercase',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const kanbanCount: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#D4B85A', fontWeight: 600,
}
const kanbanList: React.CSSProperties = {
  flex: 1, padding: '4px 8px 10px',
  display: 'flex', flexDirection: 'column', gap: 6,
  maxHeight: '75vh', overflowY: 'auto',
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
  position: 'relative',
  padding: 10,
  background: 'rgba(5,46,32,0.45)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s',
}
const cardHover: React.CSSProperties = {
  background: 'rgba(5,46,32,0.75)',
  borderColor: 'rgba(212,184,90,0.40)',
  transform: 'translateY(-1px)',
  boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
}
const quickActions: React.CSSProperties = {
  position: 'absolute', top: 6, right: 6,
  display: 'flex', gap: 4,
  background: 'rgba(5,46,32,0.95)',
  border: '1px solid rgba(212,184,90,0.30)', borderRadius: 5,
  padding: 2,
  boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
  zIndex: 5,
}
const quickBtn: React.CSSProperties = {
  width: 22, height: 22, padding: 0,
  background: 'transparent', border: 'none',
  color: '#E5D4C2', fontSize: 13, lineHeight: 1,
  cursor: 'pointer', borderRadius: 3,
}
const cardName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 13, color: '#E5D4C2',
  fontWeight: 500, lineHeight: 1.2, paddingRight: 18,  // room for letter dot / hover overlay
}
const cardSub: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.75, marginTop: 3, lineHeight: 1.3,
  overflow: 'hidden', textOverflow: 'ellipsis',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
}
const cardChipsRow: React.CSSProperties = {
  display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8,
}
const cardChip: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', background: 'rgba(229,212,194,0.06)',
  padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em',
  display: 'inline-flex', alignItems: 'center',
}
const cardChipMuted: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.6,
  padding: '1px 5px', letterSpacing: '0.04em',
}
const cardLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.65, marginTop: 6, lineHeight: 1.4,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const cardLineLabel: React.CSSProperties = {
  color: '#B2AA98', opacity: 0.7, letterSpacing: '0.06em',
  textTransform: 'uppercase', fontSize: 8, marginRight: 4,
}
const cardNextAction: React.CSSProperties = {
  marginTop: 8, padding: '5px 7px',
  background: 'rgba(212,184,90,0.06)', borderLeft: '2px solid rgba(212,184,90,0.30)',
  borderRadius: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E5D4C2',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const letterDot: React.CSSProperties = {
  fontSize: 11, color: '#D4B85A', flexShrink: 0,
}
const emptyText: React.CSSProperties = {
  padding: '60px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
