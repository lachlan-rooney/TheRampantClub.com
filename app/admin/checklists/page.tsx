'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { vnDateString } from '@/lib/datetime'

// Admin / Floor / Checklists
//
// Opening and closing shift checklists. One sheet per day, per kind.
// Items hardcoded via lib/checklist-templates.ts; ticks capture staff
// initials + timestamp. "Lock & sign" snapshots who took responsibility.

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  name: string | null
  ts: string | null
}
interface Checklist {
  id: string | null
  shift_date: string
  kind: 'opening' | 'closing'
  items: ChecklistItem[]
  free_notes: string | null
  submitted_by: string | null
  submitted_at: string | null
}

export default function ChecklistsPage() {
  const today = vnDateString()
  const [date, setDate] = useState(today)
  const [opening, setOpening] = useState<Checklist | null>(null)
  const [closing, setClosing] = useState<Checklist | null>(null)
  const [loading, setLoading] = useState(true)
  const [initials, setInitials] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/checklists?date=${date}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.opening) setOpening(d.opening)
        if (d.closing) setClosing(d.closing)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date])
  useEffect(() => { load() }, [load])

  // Restore initials across sessions so the team doesn't type their name
  // on every tick.
  useEffect(() => {
    try { setInitials(localStorage.getItem('checklist_initials') || '') } catch { /* ignore */ }
  }, [])
  const persistInitials = (v: string) => {
    setInitials(v)
    try { localStorage.setItem('checklist_initials', v) } catch { /* ignore */ }
  }

  const upsert = useCallback(async (kind: 'opening' | 'closing', items: ChecklistItem[], free_notes: string | null, submit = false) => {
    setBusy(kind); setError(null)
    try {
      const r = await fetch('/api/admin/checklists/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: date, kind, items, free_notes,
          submit,
          submitted_by: submit ? initials : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      // Mutate local state with the saved row (includes new ids/timestamps).
      if (kind === 'opening') setOpening(j.checklist)
      else setClosing(j.checklist)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }, [date, initials])

  const toggleItem = useCallback((sheet: Checklist, itemId: string) => {
    if (sheet.submitted_at) return  // locked
    if (!initials.trim()) { setError('Enter your initials at the top first.'); return }
    const items = sheet.items.map(it => it.id === itemId ? {
      ...it,
      checked: !it.checked,
      name:    !it.checked ? initials.trim() : null,
      ts:      !it.checked ? new Date().toISOString() : null,
    } : it)
    if (sheet.kind === 'opening') setOpening({ ...sheet, items })
    else setClosing({ ...sheet, items })
    upsert(sheet.kind, items, sheet.free_notes)
  }, [initials, upsert])

  const updateNotes = useCallback((sheet: Checklist, notes: string) => {
    if (sheet.kind === 'opening') setOpening({ ...sheet, free_notes: notes })
    else setClosing({ ...sheet, free_notes: notes })
  }, [])
  const saveNotes = useCallback((sheet: Checklist) => {
    upsert(sheet.kind, sheet.items, sheet.free_notes)
  }, [upsert])

  const submitSheet = useCallback((sheet: Checklist) => {
    if (!initials.trim()) { setError('Enter your initials at the top first.'); return }
    const unchecked = sheet.items.filter(i => !i.checked)
    if (unchecked.length > 0) {
      if (!confirm(`${unchecked.length} item${unchecked.length === 1 ? '' : 's'} not ticked. Lock and sign anyway?`)) return
    }
    upsert(sheet.kind, sheet.items, sheet.free_notes, true)
  }, [initials, upsert])

  const progress = (sheet: Checklist | null): { done: number; total: number } => {
    if (!sheet) return { done: 0, total: 0 }
    return { done: sheet.items.filter(i => i.checked).length, total: sheet.items.length }
  }
  const openingP = progress(opening)
  const closingP = progress(closing)

  // Date stepper
  const shiftDay = (n: number) => {
    const d = new Date(date + 'T12:00:00+07:00')
    d.setDate(d.getDate() + n)
    setDate(vnDateString(d))
  }

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Floor</div>
          <h1 style={pageTitle}>Shift Checklists</h1>
          <p style={lede}>
            Opening and closing sheets. Tick each item as you go — your name and timestamp are captured automatically. Lock & sign at the end of the shift to seal the sheet and hand over to the next team.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={editLabel}>Your initials</label>
          <input
            value={initials}
            onChange={e => persistInitials(e.target.value)}
            placeholder="e.g. CL"
            maxLength={20}
            style={{ ...inputStyle, maxWidth: 180 }}
          />
        </div>
      </div>

      {/* Date stepper */}
      <div style={dateStepper}>
        <button onClick={() => shiftDay(-1)} style={navBtn}>← prev</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, maxWidth: 180, textAlign: 'center' }} />
        <button onClick={() => shiftDay(1)} style={navBtn}>next →</button>
        <button onClick={() => setDate(today)} style={navBtn}>Today</button>
        {date !== today && (
          <span style={{ marginLeft: 12, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', letterSpacing: '0.08em' }}>
            VIEWING {date === today ? 'TODAY' : new Date(date + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : (
        <div style={twoCol}>
          {opening && (
            <SheetBlock
              sheet={opening}
              progress={openingP}
              kindLabel="Opening"
              kindColor="#D4B85A"
              busy={busy === 'opening'}
              onToggle={(id) => toggleItem(opening, id)}
              onNotes={(v) => updateNotes(opening, v)}
              onNotesBlur={() => saveNotes(opening)}
              onSubmit={() => submitSheet(opening)}
            />
          )}
          {closing && (
            <SheetBlock
              sheet={closing}
              progress={closingP}
              kindLabel="Closing"
              kindColor="#7AB07A"
              busy={busy === 'closing'}
              onToggle={(id) => toggleItem(closing, id)}
              onNotes={(v) => updateNotes(closing, v)}
              onNotesBlur={() => saveNotes(closing)}
              onSubmit={() => submitSheet(closing)}
            />
          )}
        </div>
      )}

      <div style={hintRow}>
        Reading yesterday&apos;s closing handover is part of MX Daily — open <Link href="/admin/mx-daily" style={linkStyle}>MX Daily</Link> at the start of your shift.
      </div>
    </>
  )
}

// ── SheetBlock ────────────────────────────────────────────────────────
function SheetBlock({ sheet, progress, kindLabel, kindColor, busy, onToggle, onNotes, onNotesBlur, onSubmit }: {
  sheet: Checklist
  progress: { done: number; total: number }
  kindLabel: string
  kindColor: string
  busy: boolean
  onToggle: (itemId: string) => void
  onNotes: (v: string) => void
  onNotesBlur: () => void
  onSubmit: () => void
}) {
  const locked = !!sheet.submitted_at
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div style={{ ...sheetBlock, ...(locked ? { borderColor: kindColor + '60' } : null) }}>
      <div style={sheetHeader}>
        <div>
          <div style={{ ...sheetEyebrow, color: kindColor }}>{kindLabel}</div>
          <div style={sheetTitle}>
            {progress.done}/{progress.total} ticked · {pct}%
          </div>
        </div>
        {locked ? (
          <div style={{ ...lockedBadge, color: kindColor, borderColor: kindColor + '60' }}>
            ✓ Signed off by {sheet.submitted_by} · {fmtTimestamp(sheet.submitted_at!)}
          </div>
        ) : (
          <button onClick={onSubmit} disabled={busy} style={{ ...btnSign, background: kindColor + '18', color: kindColor, borderColor: kindColor + '40' }}>
            Lock &amp; sign
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${pct}%`, background: kindColor }} />
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        {sheet.items.map(it => (
          <div key={it.id} style={{ ...itemRow, ...(it.checked ? { background: kindColor + '08' } : null), ...(locked ? { opacity: 0.7 } : null) }}>
            <input
              type="checkbox"
              checked={it.checked}
              onChange={() => onToggle(it.id)}
              disabled={locked}
              style={{ accentColor: kindColor, marginTop: 2, cursor: locked ? 'not-allowed' : 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ ...itemLabel, ...(it.checked ? { color: '#E5D4C2' } : null) }}>{it.label}</div>
              {it.checked && (
                <div style={itemMeta}>
                  Ticked by {it.name || 'unknown'} · {fmtTimestamp(it.ts)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Free notes */}
      <div style={{ marginTop: 16 }}>
        <div style={editLabel}>Notes for the handover</div>
        <textarea
          value={sheet.free_notes || ''}
          onChange={e => onNotes(e.target.value)}
          onBlur={onNotesBlur}
          rows={3}
          disabled={locked}
          placeholder={kindLabel === 'Closing' ? "What does tomorrow's opening team need to know?" : "Anything to flag from tonight?"}
          style={{ ...inputStyle, resize: 'vertical', opacity: locked ? 0.7 : 1 }}
        />
      </div>
    </div>
  )
}

function fmtTimestamp(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch { return iso }
}

// ── styles ────────────────────────────────────────────────────────────
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 20,
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
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720, margin: 0,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '8px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const dateStepper: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
}
const navBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em',
}
const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: 16,
}
const sheetBlock: React.CSSProperties = {
  padding: 18,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const sheetHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 12, marginBottom: 10, flexWrap: 'wrap',
}
const sheetEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.16em', textTransform: 'uppercase',
}
const sheetTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', margin: '4px 0 0', letterSpacing: '0.02em',
}
const lockedBadge: React.CSSProperties = {
  padding: '4px 12px', borderRadius: 3, border: '1px solid',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  alignSelf: 'flex-start',
}
const btnSign: React.CSSProperties = {
  padding: '6px 14px', border: '1px solid', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 600,
}
const progressTrack: React.CSSProperties = {
  height: 3, background: 'rgba(229,212,194,0.08)', borderRadius: 2, overflow: 'hidden',
}
const progressFill: React.CSSProperties = {
  height: '100%', transition: 'width 0.4s ease',
}
const itemRow: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'flex-start',
  padding: '10px 12px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const itemLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', lineHeight: 1.5,
}
const itemMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em', marginTop: 4,
}
const hintRow: React.CSSProperties = {
  marginTop: 22, padding: '10px 14px',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.18)',
  borderLeft: '2px solid #D4B85A', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', lineHeight: 1.55,
}
const linkStyle: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
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
