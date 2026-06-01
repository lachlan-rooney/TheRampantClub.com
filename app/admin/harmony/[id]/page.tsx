'use client'

import { use, useCallback, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// Admin / Floor / Harmony Log / [id]
//
// The detail + extraction review page. If ?run=1 is in the query, kicks
// off the Claude SSE stream automatically on mount. Otherwise renders
// the existing log + extractions and lets the staff Process / Apply.

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
  extraction_started_at: string | null
  extraction_finished_at: string | null
  extraction_token_cost: number | null
}

interface Extraction {
  id: string
  log_id: string
  kind: string
  payload: Record<string, unknown>
  member_no: string | null
  member_hint: string | null
  prospect_id: string | null
  status: string
  target_table: string | null
  target_id: string | null
  failure_note: string | null
  created_at: string
}

const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  visit:            { label: 'Visit',            icon: '◉', color: '#7AB07A' },
  preference:       { label: 'Preference',       icon: '◆', color: '#D4B85A' },
  bottle_depletion: { label: 'Bottle pour',      icon: '◐', color: '#E58F4A' },
  prospect:         { label: 'Prospect',         icon: '✚', color: '#9E8FC4' },
  complaint:        { label: 'Complaint',        icon: '⚠', color: '#C27070' },
  card_charge:      { label: 'Card charge',      icon: '₫', color: '#5B8FA8' },
}

export default function HarmonyLogDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const autoRun = searchParams?.get('run') === '1'

  const [log, setLog] = useState<HarmonyLog | null>(null)
  const [extractions, setExtractions] = useState<Extraction[]>([])
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [streamProgress, setStreamProgress] = useState<string>('')
  const [streamPartial, setStreamPartial] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ranOnce = useRef(false)

  const load = useCallback(() => {
    fetch(`/api/admin/harmony/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.log) setLog(d.log)
        if (d.extractions) {
          setExtractions(d.extractions)
          // Auto-select every pending extraction by default.
          setSelected(new Set(d.extractions.filter((x: Extraction) => x.status === 'pending').map((x: Extraction) => x.id)))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load])

  const startExtraction = useCallback(async () => {
    if (streaming) return
    setStreaming(true)
    setStreamProgress('Starting…')
    setStreamPartial('')
    setError(null)
    // Clear any previously-pending extractions client-side so the stream
    // doesn't visually double up while the server wipes them.
    setExtractions(prev => prev.filter(x => x.status !== 'pending'))
    setSelected(new Set())

    try {
      const r = await fetch(`/api/admin/harmony/${id}/extract`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `extract failed: ${r.status}`)
      }
      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        // SSE frames: events separated by \n\n.
        let split = buf.indexOf('\n\n')
        while (split !== -1) {
          const frame = buf.slice(0, split)
          buf = buf.slice(split + 2)
          const lines = frame.split('\n')
          let event = 'message', data = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7).trim()
            else if (line.startsWith('data: ')) data += line.slice(6)
          }
          if (!data) { split = buf.indexOf('\n\n'); continue }
          try {
            const obj = JSON.parse(data)
            if (event === 'status')         setStreamProgress(`Reading: ${obj.shift_label} of ${obj.shift_date}…`)
            else if (event === 'thinking')  setStreamProgress(prev => prev.startsWith('Reasoning') ? prev : 'Reasoning…')
            else if (event === 'partial')   setStreamPartial(p => (p + (obj.text || '')).slice(-400))
            else if (event === 'extraction') {
              const x = obj.extraction as Extraction
              if (x && x.id) {
                setExtractions(prev => [...prev, x])
                setSelected(prev => { const n = new Set(prev); n.add(x.id); return n })
                setStreamProgress(`Extracted ${obj.index} so far…`)
              }
            }
            else if (event === 'done')      setStreamProgress(`Done — ${obj.count} extractions.`)
            else if (event === 'error')     setError(obj.message || 'extraction error')
          } catch { /* ignore malformed frame */ }
          split = buf.indexOf('\n\n')
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStreaming(false)
      // Pull fresh data (incl. usage, status flip).
      load()
    }
  }, [id, streaming, load])

  // Auto-run on first mount if ?run=1.
  useEffect(() => {
    if (autoRun && !ranOnce.current && log && extractions.length === 0 && !streaming) {
      ranOnce.current = true
      startExtraction()
    }
  }, [autoRun, log, extractions.length, streaming, startExtraction])

  const reject = useCallback(async (xid: string) => {
    await fetch(`/api/admin/harmony/extractions/${xid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    setExtractions(prev => prev.map(x => x.id === xid ? { ...x, status: 'rejected' } : x))
    setSelected(prev => { const n = new Set(prev); n.delete(xid); return n })
  }, [])

  const apply = useCallback(async () => {
    if (selected.size === 0) return
    setApplying(true); setError(null)
    try {
      const r = await fetch(`/api/admin/harmony/${id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraction_ids: Array.from(selected) }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'apply failed')
      load()
      setSelected(new Set())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }, [id, selected, load])

  if (loading || !log) return <div style={emptyText}>Loading…</div>

  const pendingExtractions = extractions.filter(x => x.status === 'pending')
  const settledExtractions = extractions.filter(x => x.status !== 'pending')
  const d = new Date(log.shift_date)
  const datePretty = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <Link href="/admin/harmony" style={backLink}>← Harmony Log</Link>

      {/* Hero */}
      <div style={hero}>
        <div>
          <div style={eyebrow}>Floor · Harmony Log</div>
          <h1 style={pageTitle}>
            {datePretty}
            <span style={{ marginLeft: 14, fontSize: 18, color: '#D4B85A', textTransform: 'capitalize', letterSpacing: '0.06em' }}>· {log.shift_label}</span>
          </h1>
          <div style={metaStrip}>
            {log.attendee_count != null && <span style={metaPill}>{log.attendee_count} in</span>}
            {log.weather && <span style={metaPill}>{log.weather}</span>}
            {log.room_state && <span style={metaPill}>{log.room_state}</span>}
            <span style={metaPill}>{log.submitted_by || 'unknown'}</span>
            <span style={statusPill(log.status)}>{log.status}</span>
          </div>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={twoCol}>
        {/* LEFT — narrative + actions */}
        <div>
          <div style={panelTitle}>The night</div>
          <div style={narrativeBox}>{log.narrative}</div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={startExtraction} disabled={streaming} style={{ ...btnPrimary, opacity: streaming ? 0.6 : 1 }}>
              {streaming ? '◌ Processing…' : extractions.length === 0 ? '◆ Process with Claude' : '↻ Re-process'}
            </button>
          </div>

          {streaming && (
            <div style={streamBox}>
              <div style={streamLabel}>{streamProgress}</div>
              {streamPartial && (
                <div style={streamPartialBox}>{streamPartial}</div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — extractions */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={panelTitle}>
              Proposed updates
              {pendingExtractions.length > 0 && <span style={panelBadge}>{pendingExtractions.length}</span>}
            </div>
            {selected.size > 0 && (
              <button onClick={apply} disabled={applying} style={btnAccent}>
                {applying ? 'Applying…' : `Apply ${selected.size} →`}
              </button>
            )}
          </div>

          {pendingExtractions.length === 0 && settledExtractions.length === 0 && (
            <div style={emptyHint}>
              {streaming ? 'Streaming…' : 'Hit Process to extract structured updates from the narrative.'}
            </div>
          )}

          {/* Pending checklist */}
          {pendingExtractions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingExtractions.map(x => (
                <ExtractionRow
                  key={x.id}
                  x={x}
                  checked={selected.has(x.id)}
                  onToggle={() => setSelected(prev => {
                    const n = new Set(prev)
                    if (n.has(x.id)) n.delete(x.id); else n.add(x.id)
                    return n
                  })}
                  onReject={() => reject(x.id)}
                />
              ))}
            </div>
          )}

          {/* Settled (applied / rejected / failed) */}
          {settledExtractions.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={settledLabel}>Resolved · {settledExtractions.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {settledExtractions.map(x => (
                  <SettledRow key={x.id} x={x} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Extraction row (pending) ─────────────────────────────────────────
function ExtractionRow({ x, checked, onToggle, onReject }: {
  x: Extraction; checked: boolean; onToggle: () => void; onReject: () => void
}) {
  const meta = KIND_META[x.kind] || { label: x.kind, icon: '•', color: '#B2AA98' }
  const p = x.payload || {}
  return (
    <div style={{
      ...extractionRow,
      borderColor: checked ? meta.color + '60' : 'rgba(229,212,194,0.08)',
      background: checked ? meta.color + '10' : 'rgba(229,212,194,0.03)',
    }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', flex: 1 }}>
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ marginTop: 3, accentColor: meta.color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ ...kindPill, color: meta.color, borderColor: meta.color + '50', background: meta.color + '14' }}>
              {meta.icon} {meta.label}
            </span>
            {x.member_hint && <span style={hintPill}>{x.member_hint}</span>}
          </div>
          <div style={extractionBody}>{summarizePayload(x.kind, p)}</div>
        </div>
      </label>
      <button onClick={onReject} style={rejectBtn}>×</button>
    </div>
  )
}

function SettledRow({ x }: { x: Extraction }) {
  const meta = KIND_META[x.kind] || { label: x.kind, icon: '•', color: '#B2AA98' }
  const statusColor =
    x.status === 'applied'  ? '#7AB07A'
    : x.status === 'rejected' ? '#7E7864'
    : x.status === 'failed'   ? '#C27070'
    : '#B2AA98'
  return (
    <div style={{ ...settledRow, borderLeft: `2px solid ${statusColor}` }}>
      <span style={{ ...kindPill, color: meta.color, borderColor: meta.color + '40', background: meta.color + '0E', opacity: 0.7 }}>
        {meta.icon}
      </span>
      <span style={settledText}>{summarizePayload(x.kind, x.payload || {})}</span>
      <span style={{ ...settledStatus, color: statusColor }}>
        {x.status}
        {x.status === 'applied' && x.target_id && (
          <span style={{ marginLeft: 6, opacity: 0.6 }}>· {x.target_id.slice(0, 8)}</span>
        )}
      </span>
      {x.failure_note && (
        <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#C27070', marginLeft: 8, opacity: 0.8 }}>
          ⚠ {x.failure_note}
        </span>
      )}
    </div>
  )
}

function summarizePayload(kind: string, p: Record<string, unknown>): string {
  switch (kind) {
    case 'visit': {
      const space = p.space ? ` · ${p.space}` : ''
      const dur = p.duration_min ? ` · ${p.duration_min}m` : ''
      const notes = p.notes ? ` — ${String(p.notes)}` : ''
      return `Visit${space}${dur}${notes}`
    }
    case 'preference': {
      const cat = p.category ? `${p.category} · ` : ''
      const name = p.preference_name || 'preference'
      const s0 = p.s0 ? ` (S₀=${p.s0})` : ''
      const detail = p.detail ? ` — ${p.detail}` : ''
      return `${cat}${name}${s0}${detail}`
    }
    case 'bottle_depletion': {
      const fill = p.estimated_new_fill_pct != null ? ` → ${p.estimated_new_fill_pct}%` : ''
      const note = p.note ? ` — ${p.note}` : ''
      return `${p.bottle_name || 'bottle'}${fill}${note}`
    }
    case 'prospect': {
      const ref = p.referred_by_hint ? ` (ref: ${p.referred_by_hint})` : ''
      const prof = p.profession ? ` · ${p.profession}` : ''
      const notes = p.notes ? ` — ${p.notes}` : ''
      return `${p.full_name || 'prospect'}${prof}${ref}${notes}`
    }
    case 'complaint': {
      const sev = p.severity ? `S${p.severity} · ` : ''
      const status = p.status ? ` · ${p.status}` : ''
      return `${sev}${p.summary || 'complaint'}${status}`
    }
    case 'card_charge': {
      const amt = Number(p.amount_vnd) || 0
      const formatted = amt >= 1_000_000 ? `${(amt / 1_000_000).toFixed(1)}M ₫` : amt >= 1000 ? `${Math.round(amt / 1000)}k ₫` : `${amt} ₫`
      const note = p.note ? ` — ${p.note}` : ''
      return `${formatted}${note}`
    }
    default:
      return JSON.stringify(p).slice(0, 200)
  }
}

function statusPill(s: string): React.CSSProperties {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    draft:     { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.16)' },
    extracted: { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)',  bd: 'rgba(212,184,90,0.40)' },
    reviewed:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)',  bd: 'rgba(212,184,90,0.30)' },
    applied:   { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
  }
  const pal = map[s] || map.draft
  return {
    background: pal.bg, color: pal.fg, border: `1px solid ${pal.bd}`,
    borderRadius: 3, padding: '2px 8px',
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}

// ── styles ─────────────────────────────────────────────────────────────
const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 18, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const hero: React.CSSProperties = { marginBottom: 22 }
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 12px',
  display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
}
const metaStrip: React.CSSProperties = {
  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
}
const metaPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.04em',
}
const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
  gap: 20, marginTop: 14,
}
const panelTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
}
const panelBadge: React.CSSProperties = {
  background: 'rgba(212,184,90,0.20)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 10,
  padding: '0 8px', fontSize: 9, fontWeight: 600,
}
const narrativeBox: React.CSSProperties = {
  padding: '16px 18px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  lineHeight: 1.8, whiteSpace: 'pre-wrap',
}
const streamBox: React.CSSProperties = {
  marginTop: 14, padding: 14,
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 6,
}
const streamLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', letterSpacing: '0.04em',
}
const streamPartialBox: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px',
  background: 'rgba(5,46,32,0.6)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', lineHeight: 1.5, whiteSpace: 'pre-wrap',
  maxHeight: 120, overflow: 'auto',
}
const extractionRow: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'flex-start',
  padding: 12,
  border: '1px solid', borderRadius: 6,
  transition: 'background 0.15s ease, border-color 0.15s ease',
}
const kindPill: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px',
  border: '1px solid', borderRadius: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
const hintPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '1px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
}
const extractionBody: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.6,
  wordBreak: 'break-word',
}
const rejectBtn: React.CSSProperties = {
  background: 'transparent', color: '#7E7864',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 14,
  cursor: 'pointer', lineHeight: 1,
}
const settledLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.12em', textTransform: 'uppercase',
  marginBottom: 6,
}
const settledRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 10px',
  background: 'rgba(229,212,194,0.02)',
}
const settledText: React.CSSProperties = {
  flex: 1, fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const settledStatus: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 20px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnAccent: React.CSSProperties = {
  background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 6,
  padding: '8px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
}
const emptyHint: React.CSSProperties = {
  padding: '24px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
