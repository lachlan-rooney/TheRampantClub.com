'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// Admin / Intelligence / Members / Preference Candidates
//
// Review queue for new preferences proposed by AI extractions and on-visit
// observations. Accepting fires the promote_preference_candidate RPC (write
// contract B) which inserts into preferences and links the candidate back
// to the new preference_id.

interface Candidate {
  candidate_id: string
  member_no: string
  source_observation_id: string | null
  suggested_category: string | null
  suggested_name: string | null
  detail: string | null
  verbatim_quote: string | null
  suggested_s0: number | null
  suggested_confidence: number | null
  suggested_lambda: number | null
  suggested_frequency: number | null
  source: string
  status: 'pending' | 'accepted' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  promoted_preference_id: string | null
  created_at: string
  member: { member_no: string; full_name: string; nickname: string | null; tier: string } | null
  source_observation: {
    observation_id: string
    visit_id: string
    observation: string
    sentiment: string
    category: string | null
    created_at: string
  } | null
}

const CATEGORIES = [
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
]
const ALLOWED_CONFIDENCE = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_LAMBDA     = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_FREQUENCY  = [0.8, 1.0, 1.2, 1.5]

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'accepted' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<Candidate>>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    fetch(`/api/admin/mis/candidates${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setCandidates(d.candidates || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter])
  useEffect(() => { load() }, [load])

  const draftFor = (c: Candidate): Partial<Candidate> => drafts[c.candidate_id] || {
    suggested_category: c.suggested_category,
    suggested_name: c.suggested_name,
    detail: c.detail,
    suggested_s0: c.suggested_s0 ?? 3,
    suggested_confidence: c.suggested_confidence ?? 0.75,
    suggested_lambda: c.suggested_lambda ?? 0.010,
    suggested_frequency: c.suggested_frequency ?? 1.0,
  }

  const setDraft = (id: string, partial: Partial<Candidate>) => {
    setDrafts(d => ({ ...d, [id]: { ...draftFor(candidates.find(c => c.candidate_id === id)!), ...partial } }))
  }

  const accept = async (c: Candidate) => {
    setBusyId(c.candidate_id); setError(null)
    try {
      const d = draftFor(c)
      const r = await fetch(`/api/admin/mis/candidates/${c.candidate_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          overrides: {
            category:        d.suggested_category,
            preference_name: d.suggested_name,
            detail:          d.detail,
            s0:              d.suggested_s0,
            confidence:      d.suggested_confidence,
            lambda:          d.suggested_lambda,
            frequency:       d.suggested_frequency,
          },
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Accept failed')
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (c: Candidate) => {
    if (!confirm(`Reject this candidate? No preference will be created. ${c.suggested_name || ''}`)) return
    setBusyId(c.candidate_id); setError(null)
    try {
      const r = await fetch(`/api/admin/mis/candidates/${c.candidate_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Reject failed')
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    pending:  candidates.filter(c => c.status === 'pending').length,
    accepted: candidates.filter(c => c.status === 'accepted').length,
    rejected: candidates.filter(c => c.status === 'rejected').length,
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>Intelligence · Members</div>
        <h1 style={pageTitle}>Preference Candidates</h1>
        <p style={lede}>
          New preferences proposed by the on-visit observation log and AI shift-narrative extractions. Accepting one fires write contract B — the preference lands in <code>preferences</code> with <code>validation_count=1</code> and the candidate row marks the moment it was promoted.
        </p>
      </div>

      <div style={filterRow}>
        {(['pending', 'accepted', 'rejected', 'all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              ...filterChip,
              ...(statusFilter === s ? filterChipActive : null),
            }}
          >
            {s} {s === 'pending' && counts.pending ? `· ${counts.pending}` : ''}
          </button>
        ))}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : candidates.length === 0 ? (
        <div style={emptyBlock}>
          {statusFilter === 'pending'
            ? 'Queue is clear — no candidates awaiting review.'
            : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}candidates yet.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {candidates.map(c => {
            const isExpanded = expandedId === c.candidate_id
            const d = draftFor(c)
            return (
              <div key={c.candidate_id} style={card}>
                {/* Summary row */}
                <div style={summaryRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={statusPill(c.status)}>{c.status}</span>
                      <span style={sourcePill}>{c.source}</span>
                      {c.suggested_category && <span style={categoryPill}>{c.suggested_category}</span>}
                    </div>
                    <div style={candidateName}>{c.suggested_name || '(unnamed)'}</div>
                    <div style={candidateMember}>
                      {c.member ? (
                        <Link href={`/admin/mis/${c.member_no}`} style={memberLink}>
                          {c.member.full_name}
                        </Link>
                      ) : c.member_no}
                      <span style={{ color: '#7E7864', marginLeft: 6 }}>{c.member_no}{c.member?.tier ? ` · ${c.member.tier}` : ''}</span>
                    </div>
                    {c.detail && !isExpanded && <div style={candidateDetail}>{c.detail}</div>}
                  </div>

                  {c.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
                      <button onClick={() => setExpandedId(isExpanded ? null : c.candidate_id)} style={btnGhost}>
                        {isExpanded ? 'Hide' : 'Review'}
                      </button>
                      <button onClick={() => accept(c)} disabled={busyId === c.candidate_id} style={btnAccept}>
                        {busyId === c.candidate_id ? '…' : 'Accept'}
                      </button>
                      <button onClick={() => reject(c)} disabled={busyId === c.candidate_id} style={btnReject}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Source observation snippet */}
                {c.source_observation && (
                  <div style={obsBlock}>
                    <div style={obsLabel}>From observation:</div>
                    <div style={obsText}>&ldquo;{c.source_observation.observation}&rdquo;</div>
                    <Link href={`/admin/mis/visits/${c.source_observation.visit_id}`} style={obsLink}>
                      open visit →
                    </Link>
                  </div>
                )}

                {/* Expanded edit form */}
                {isExpanded && c.status === 'pending' && (
                  <div style={editBlock}>
                    <div style={editGrid}>
                      <div>
                        <div style={editLabel}>Preference name *</div>
                        <input
                          value={d.suggested_name || ''}
                          onChange={e => setDraft(c.candidate_id, { suggested_name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <div style={editLabel}>Category *</div>
                        <select
                          value={d.suggested_category || ''}
                          onChange={e => setDraft(c.candidate_id, { suggested_category: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">—</option>
                          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={editLabel}>Detail</div>
                      <textarea
                        value={d.detail || ''}
                        onChange={e => setDraft(c.candidate_id, { detail: e.target.value })}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ ...editGrid, marginTop: 10 }}>
                      <div>
                        <div style={editLabel}>S₀ (1–5)</div>
                        <select
                          value={d.suggested_s0 ?? 3}
                          onChange={e => setDraft(c.candidate_id, { suggested_s0: Number(e.target.value) })}
                          style={inputStyle}
                        >
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>Confidence</div>
                        <select
                          value={d.suggested_confidence ?? 0.75}
                          onChange={e => setDraft(c.candidate_id, { suggested_confidence: Number(e.target.value) })}
                          style={inputStyle}
                        >
                          {ALLOWED_CONFIDENCE.map(v => <option key={v} value={v}>{v.toFixed(2)}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>λ (decay)</div>
                        <select
                          value={d.suggested_lambda ?? 0.010}
                          onChange={e => setDraft(c.candidate_id, { suggested_lambda: Number(e.target.value) })}
                          style={inputStyle}
                        >
                          {ALLOWED_LAMBDA.map(v => <option key={v} value={v}>{v.toFixed(3)}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={editLabel}>Frequency</div>
                        <select
                          value={d.suggested_frequency ?? 1.0}
                          onChange={e => setDraft(c.candidate_id, { suggested_frequency: Number(e.target.value) })}
                          style={inputStyle}
                        >
                          {ALLOWED_FREQUENCY.map(v => <option key={v} value={v}>{v.toFixed(1)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resolved meta */}
                {c.status !== 'pending' && (
                  <div style={resolvedMeta}>
                    {c.status === 'accepted' && c.promoted_preference_id && (
                      <span>→ preference {c.promoted_preference_id.slice(0, 8)}</span>
                    )}
                    {c.reviewed_by && <span>· by {c.reviewed_by}</span>}
                    {c.reviewed_at && <span>· {new Date(c.reviewed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function statusPill(s: 'pending' | 'accepted' | 'rejected'): React.CSSProperties {
  const palette = {
    pending:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)', bd: 'rgba(212,184,90,0.40)' },
    accepted: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
    rejected: { fg: '#7E7864', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.16)' },
  }[s]
  return {
    background: palette.bg, color: palette.fg, border: `1px solid ${palette.bd}`,
    borderRadius: 3, padding: '2px 8px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
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
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 18,
}
const filterChip: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const filterChipActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)',
}
const card: React.CSSProperties = {
  padding: 16,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const summaryRow: React.CSSProperties = {
  display: 'flex', gap: 14, alignItems: 'flex-start',
}
const sourcePill: React.CSSProperties = {
  background: 'rgba(158,143,196,0.10)', color: '#9E8FC4',
  border: '1px solid rgba(158,143,196,0.30)', borderRadius: 3,
  padding: '1px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.04em',
}
const categoryPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '1px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
}
const candidateName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', marginTop: 6,
}
const candidateMember: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', marginTop: 4,
}
const memberLink: React.CSSProperties = {
  color: '#E5D4C2', textDecoration: 'none', borderBottom: '1px dotted rgba(229,212,194,0.30)',
}
const candidateDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6, marginTop: 6,
}
const btnAccept: React.CSSProperties = {
  background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 4,
  padding: '6px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnReject: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
}
const obsBlock: React.CSSProperties = {
  marginTop: 10, padding: '10px 12px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderLeft: '2px solid #9E8FC4', borderRadius: 4,
}
const obsLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#9E8FC4', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const obsText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.6, fontStyle: 'italic',
}
const obsLink: React.CSSProperties = {
  display: 'inline-block', marginTop: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#9E8FC4', textDecoration: 'none', letterSpacing: '0.06em',
}
const editBlock: React.CSSProperties = {
  marginTop: 12, padding: 14,
  background: 'rgba(212,184,90,0.04)', border: '1px solid rgba(212,184,90,0.18)',
  borderRadius: 6,
}
const editGrid: React.CSSProperties = {
  display: 'grid', gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const resolvedMeta: React.CSSProperties = {
  marginTop: 10, paddingTop: 8,
  borderTop: '1px solid rgba(229,212,194,0.06)',
  display: 'flex', gap: 8, flexWrap: 'wrap',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyBlock: React.CSSProperties = {
  padding: '60px 20px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98',
  background: 'rgba(229,212,194,0.02)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 8,
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
