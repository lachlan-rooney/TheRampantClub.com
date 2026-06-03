'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { vnDateString } from '@/lib/datetime'

// Per-member visit log + inline "Log a visit" form. Drops onto the member
// profile page. Every successful POST is what slowly turns M from 1.0 into
// a real value via member_stats.avg_visits_per_month.

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
  archived_at: string | null
  phase?: 'overture' | 'accord' | 'continuum' | 'closed' | null
}

const SPACES = [
  '', 'Library Bar', 'The Studio', 'The Dining Room',
  'The Rampant Room', 'Source & Origin Lab', 'Sports Club', 'Other',
]

const todayISO = vnDateString

export default function VisitsPanel({ memberNo, onAfterChange }: { memberNo: string; onAfterChange?: () => void }) {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // form draft
  const [visitDate, setVisitDate] = useState(todayISO())
  const [space, setSpace] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [emotional, setEmotional] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({
      member_no: memberNo,
      limit: '20',
      ...(showArchived ? { include_archived: 'true' } : {}),
    })
    fetch(`/api/admin/mis/visits?${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.visits) setVisits(d.visits); setLoading(false) })
      .catch(() => setLoading(false))
  }, [memberNo, showArchived])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setVisitDate(todayISO())
    setSpace(''); setDurationMin(''); setEmotional(''); setNotes('')
  }

  const submit = async () => {
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/admin/mis/visits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_no: memberNo,
          visit_date: visitDate,
          space: space || null,
          duration_min: durationMin === '' ? null : Number(durationMin),
          emotional_state: emotional || null,
          notes: notes || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      resetForm(); setFormOpen(false); load()
      onAfterChange?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const [confirmArchive, setConfirmArchive] = useState<Visit | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const closeArchive = () => { if (!archiveBusy) setConfirmArchive(null) }
  const runArchive = async () => {
    if (!confirmArchive) return
    setArchiveBusy(true)
    try {
      const r = await fetch(`/api/admin/mis/visits?visit_id=${encodeURIComponent(confirmArchive.visit_id)}`, { method: 'DELETE' })
      if (r.ok) { setConfirmArchive(null); load(); onAfterChange?.() }
    } finally {
      setArchiveBusy(false)
    }
  }
  const restore = async (visit_id: string) => {
    const r = await fetch(`/api/admin/mis/visits?visit_id=${encodeURIComponent(visit_id)}&restore=true`, { method: 'DELETE' })
    if (r.ok) { load(); onAfterChange?.() }
  }

  return (
    <div style={panel}>
      <div style={panelHeader}>
        <div style={panelLabel}>Recent visits</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <label style={archivedToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show archived
          </label>
          <button onClick={() => setFormOpen(o => !o)} style={addBtn}>
            {formOpen ? 'Cancel' : '+ Log a visit'}
          </button>
        </div>
      </div>

      {formOpen && (
        <div style={formBlock}>
          <div style={formGrid}>
            <div>
              <div style={fieldLabel}>Date</div>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={fieldInput} />
            </div>
            <div>
              <div style={fieldLabel}>Space</div>
              <select value={space} onChange={e => setSpace(e.target.value)} style={fieldInput}>
                {SPACES.map(s => <option key={s} value={s}>{s || '— select —'}</option>)}
              </select>
            </div>
            <div>
              <div style={fieldLabel}>Duration (min)</div>
              <input
                type="number" min={0} max={1440} step={15}
                value={durationMin}
                onChange={e => setDurationMin(e.target.value)}
                placeholder="e.g. 90"
                style={fieldInput}
              />
            </div>
            <div>
              <div style={fieldLabel}>Emotional state</div>
              <input
                type="text" value={emotional} onChange={e => setEmotional(e.target.value)}
                placeholder="Relaxed · Celebratory · Quiet …"
                style={fieldInput}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={fieldLabel}>Notes</div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional — what happened, who they were with, anything to flag for the next visit."
              style={{ ...fieldInput, width: '100%', resize: 'vertical' }}
            />
          </div>

          {error && (
            <div style={errorBox}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={submit} disabled={submitting} style={btnPrimary}>
              {submitting ? '…' : 'Save visit'}
            </button>
            <button onClick={() => { resetForm(); setFormOpen(false) }} disabled={submitting} style={btnGhost}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div style={emptyText}>Loading…</div>
        ) : visits.length === 0 ? (
          <div style={emptyText}>No visits logged yet.</div>
        ) : (
          visits.map(v => {
            const isArchived = !!v.archived_at
            return (
              <Link
                key={v.visit_id}
                href={`/admin/mis/visits/${v.visit_id}`}
                style={{ ...visitRow, ...(isArchived ? archivedRow : {}), textDecoration: 'none', color: 'inherit' }}
              >
                <div style={visitDateCol}>{fmtDate(v.visit_date)}</div>
                <div style={visitBody}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    {v.space && <span style={visitSpace}>{v.space}</span>}
                    {v.duration_min != null && <span style={visitMeta}>{v.duration_min} min</span>}
                    {v.emotional_state && <span style={visitEmotion}>· {v.emotional_state}</span>}
                    {v.phase && <span style={phasePill(v.phase)}>{v.phase}</span>}
                    {isArchived && <span style={archivedTag}>archived</span>}
                  </div>
                  {v.notes && <div style={visitNotes}>{v.notes}</div>}
                  <div style={visitFooter}>
                    Logged by {v.logged_by || '—'} · {new Date(v.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {isArchived && v.archived_at && (
                      <> · Archived {new Date(v.archived_at).toLocaleString('en-GB', { day: 'numeric', month: 'short' })}</>
                    )}
                  </div>
                </div>
                {isArchived ? (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); restore(v.visit_id) }}
                    title="Restore visit" style={restoreBtn}
                  >↩</button>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmArchive(v) }}
                    title="Archive visit" style={archiveBtn}
                  >×</button>
                )}
              </Link>
            )
          })
        )}
      </div>

      {/* ── Confirm modal (branded, replaces native window.confirm) ──── */}
      {confirmArchive && (
        <>
          <div style={confirmBackdrop} onClick={closeArchive} />
          <div style={confirmModalBox} role="dialog">
            <div style={confirmEyebrow}>⚠ ARCHIVE VISIT</div>
            <div style={confirmTitle}>Archive this visit?</div>
            <div style={confirmSubject}>
              {fmtDate(confirmArchive.visit_date)}{confirmArchive.space ? ` · ${confirmArchive.space}` : ''}
            </div>
            <p style={confirmBody}>
              Hides the visit from the live log and stops it counting toward M (visit cadence). The row is preserved and can be restored from “Show archived”.
            </p>
            <div style={confirmActions}>
              <button onClick={closeArchive} disabled={archiveBusy} style={confirmCancelBtn}>Cancel</button>
              <button
                onClick={runArchive}
                disabled={archiveBusy}
                style={{ ...confirmGoBtn, opacity: archiveBusy ? 0.5 : 1 }}
              >
                {archiveBusy ? 'Archiving…' : 'Archive visit'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function fmtDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function phasePill(p: 'overture' | 'accord' | 'continuum' | 'closed'): React.CSSProperties {
  const palette = {
    overture:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)', bd: 'rgba(212,184,90,0.40)' },
    accord:    { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)', bd: 'rgba(212,184,90,0.30)' },
    continuum: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.10)', bd: 'rgba(122,176,122,0.30)' },
    closed:    { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
  }[p]
  return {
    background: palette.bg, color: palette.fg, border: `1px solid ${palette.bd}`,
    borderRadius: 3, padding: '1px 7px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}

// ── styles ──────────────────────────────────────────────────────────
const panel: React.CSSProperties = {
  marginBottom: 32, padding: 22,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
}
const panelHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  marginBottom: 8,
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const addBtn: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '8px 14px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer',
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
}
const formBlock: React.CSSProperties = {
  marginTop: 12, padding: 16,
  background: 'rgba(5,46,32,0.5)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
}
const formGrid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
}
const fieldLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const fieldInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const errorBox: React.CSSProperties = {
  marginTop: 10, padding: '8px 12px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '10px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer', color: '#E5D4C2',
}
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#5E6650' }
const btnGhost: React.CSSProperties = { ...btnBase, background: 'rgba(229,212,194,0.10)' }
const visitRow: React.CSSProperties = {
  display: 'flex', gap: 14, alignItems: 'flex-start',
  padding: '12px 0', borderTop: '1px solid rgba(229,212,194,0.06)',
}
const visitDateCol: React.CSSProperties = {
  flex: '0 0 110px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', paddingTop: 2,
}
const visitBody: React.CSSProperties = { flex: 1, minWidth: 0 }
const visitSpace: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 13, color: '#E5D4C2',
}
const visitMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98',
}
const visitEmotion: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98',
}
const visitNotes: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', opacity: 0.85, lineHeight: 1.6, marginTop: 4,
}
const visitFooter: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.55, letterSpacing: '0.06em', marginTop: 6,
}
const archiveBtn: React.CSSProperties = {
  flex: '0 0 28px', width: 28, height: 28, marginTop: 2,
  background: 'transparent', border: '1px solid rgba(229,212,194,0.10)',
  color: '#B2AA98', borderRadius: 4, cursor: 'pointer',
  fontSize: 14, lineHeight: 1, opacity: 0.6,
}
const restoreBtn: React.CSSProperties = {
  flex: '0 0 28px', width: 28, height: 28, marginTop: 2,
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.30)',
  color: '#D4B85A', borderRadius: 4, cursor: 'pointer',
  fontSize: 12, lineHeight: 1,
}
const archivedRow: React.CSSProperties = {
  opacity: 0.55,
}
const archivedTag: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', background: 'rgba(229,212,194,0.10)',
  padding: '1px 6px', borderRadius: 3, letterSpacing: '0.08em',
  textTransform: 'uppercase',
}
const archivedToggle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.06em',
  cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center',
}
const emptyText: React.CSSProperties = {
  padding: '20px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}

// ── Confirm modal styles ────────────────────────────────────────────
const confirmBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300,
}
const confirmModalBox: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(480px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 301,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const confirmEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#C27070', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
  marginBottom: 8,
}
const confirmTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.02em', marginBottom: 6,
}
const confirmSubject: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', marginBottom: 12,
}
const confirmBody: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, marginBottom: 14,
}
const confirmActions: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
}
const confirmCancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const confirmGoBtn: React.CSSProperties = {
  background: '#C27070', color: '#FFFFFF',
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}
