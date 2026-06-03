'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import { vnDateString } from '@/lib/datetime'
import { createShift, updateShift, deleteShift } from '@/lib/ops/api'
import type { RotaShift, RotaShiftType, TeamMember } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Date-only maths in UTC to avoid local-tz off-by-one; the anchor is the VN day.
function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7   // 0=Mon … 6=Sun
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

interface Draft { member: string; shift_name: string; start_time: string; end_time: string; role: string; notes: string }

export default function RotaPage() {
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()

  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(vnDateString()))
  const [types, setTypes] = useState<RotaShiftType[]>([])
  const [shifts, setShifts] = useState<RotaShift[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // assign/edit modal
  const [cell, setCell] = useState<{ date: string; shift_name: string; editing: RotaShift | null } | null>(null)
  const [draft, setDraft] = useState<Draft>({ member: '', shift_name: '', start_time: '', end_time: '', role: '', notes: '' })
  const [confirmRemove, setConfirmRemove] = useState<RotaShift | null>(null)
  const [addTypeOpen, setAddTypeOpen] = useState(false)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)

  // Rows = current shift-type names PLUS any snapshotted shift_name still present
  // in the week's shifts. So a shift assigned as "Mid" stays visible even after
  // the "Mid" type is renamed/removed — the snapshot is shown, never hidden.
  const typeNames = types.map(t => t.name)
  const rowNames = [
    ...typeNames,
    ...[...new Set(shifts.map(s => s.shift_name))].filter(n => !typeNames.includes(n)),
  ]

  const load = useCallback(async () => {
    const [{ data: ty }, { data: sh }, { data: tm }] = await Promise.all([
      supabase.from('rota_shift_types').select('*').order('sort_order'),
      supabase.from('rota_shifts').select('*').gte('shift_date', weekStart).lte('shift_date', weekEnd),
      supabase.from('team_members').select('*').eq('active', true).order('display_name'),
    ])
    if (ty) setTypes(ty as RotaShiftType[])
    if (sh) setShifts(sh as RotaShift[])
    if (tm) setTeam(tm as TeamMember[])
    setLoading(false)
  }, [weekStart])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const memberName = (id: string) => team.find(t => t.id === id)?.display_name ?? '—'
  const inCell = (date: string, name: string) => shifts.filter(s => s.shift_date === date && s.shift_name === name)

  const wrap = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    try { await fn(); after?.(); load() }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setBusy(false) }
  }

  const openAssign = (date: string, shift_name: string, editing: RotaShift | null) => {
    setCell({ date, shift_name, editing })
    setDraft(editing
      ? { member: editing.member, shift_name: editing.shift_name, start_time: editing.start_time?.slice(0, 5) || '', end_time: editing.end_time?.slice(0, 5) || '', role: editing.role || '', notes: editing.notes || '' }
      : { member: team[0]?.id || '', shift_name, start_time: '', end_time: '', role: '', notes: '' })
  }
  const saveAssign = () => {
    if (!cell || !draft.member) { showToast('Pick a team member.', 'error'); return }
    const common = {
      member: draft.member, shift_name: draft.shift_name,
      start_time: draft.start_time || null, end_time: draft.end_time || null,
      role: draft.role.trim() || null, notes: draft.notes.trim() || null,
    }
    if (cell.editing) {
      wrap(() => updateShift({ id: cell.editing!.id, ...common }), () => setCell(null))
    } else {
      wrap(() => createShift({ ...common, shift_date: cell.date }), () => setCell(null))
    }
  }

  // Shift-name list — editable, persistent, shared. Direct client writes (admin RLS); no events (config).
  const addType = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const sort = types.length ? Math.max(...types.map(t => t.sort_order)) + 1 : 0
    const { error } = await supabase.from('rota_shift_types').insert({ name: trimmed, sort_order: sort })
    setAddTypeOpen(false)
    if (error) { showToast(error.message, 'error'); return }
    load()
  }
  const removeType = async (name: string) => {
    const { error } = await supabase.from('rota_shift_types').delete().eq('name', name)
    if (error) { showToast(error.message, 'error'); return }
    load()
  }

  return (
    <>
      <Link href="/admin/ops" style={backLink}>← Boards</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 4px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={eyebrow}>Operations Hub</div>
          <h1 style={pageTitle}>Rota</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setWeekStart(w => addDays(w, -7))} style={tinyBtn}>‹ Prev</button>
          <button onClick={() => setWeekStart(mondayOf(vnDateString()))} style={tinyBtn}>This week</button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} style={tinyBtn}>Next ›</button>
        </div>
      </div>
      <p style={lede}>Club-wide weekly rota — who&apos;s on which shift. Week of {dayLabel(weekStart)} – {dayLabel(weekEnd)}.</p>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: 90 }}>Shift</th>
                {days.map((d, i) => (
                  <th key={d} style={{ ...th, background: d === vnDateString() ? 'rgba(212,184,90,0.10)' : undefined }}>
                    <div>{DOW[i]}</div>
                    <div style={{ ...metaText, opacity: 0.6 }}>{dayLabel(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowNames.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, ...metaText, opacity: 0.6, fontStyle: 'italic' }}>No shift names yet — add one below.</td></tr>
              ) : rowNames.map(name => {
                const isType = typeNames.includes(name)
                return (
                <tr key={name}>
                  <td style={{ ...td, fontFamily: FAMILY, fontSize: 12, color: isType ? '#E5D4C2' : '#7E7864' }}>
                    {name}{!isType && <span title="retired shift name — kept on existing shifts" style={{ ...metaText, opacity: 0.5 }}> · retired</span>}
                  </td>
                  {days.map(d => (
                    <td key={d} style={{ ...td, verticalAlign: 'top', background: d === vnDateString() ? 'rgba(212,184,90,0.04)' : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {inCell(d, name).map(s => (
                          <button key={s.id} onClick={() => openAssign(d, name, s)} style={chip} title={[s.start_time && `${s.start_time.slice(0,5)}–${s.end_time?.slice(0,5) || ''}`, s.role].filter(Boolean).join(' · ')}>
                            {memberName(s.member)}
                            {s.role ? <span style={{ opacity: 0.6 }}> · {s.role}</span> : null}
                          </button>
                        ))}
                        {isType && <button onClick={() => openAssign(d, name, null)} style={addCellBtn}>+ assign</button>}
                      </div>
                    </td>
                  ))}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editable shift names */}
      <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...metaText, opacity: 0.7 }}>Shift names:</span>
        {types.map(t => (
          <span key={t.name} style={typePill}>
            {t.name}
            <button onClick={() => removeType(t.name)} title="Remove" style={typeRemove}>×</button>
          </span>
        ))}
        <button onClick={() => setAddTypeOpen(true)} style={tinyBtn}>+ add</button>
      </div>

      {/* Assign / edit modal */}
      {cell && (
        <>
          <div style={modalBackdrop} onClick={() => { if (!busy) setCell(null) }} />
          <div style={modalBox} role="dialog">
            <div style={eyebrow}>{cell.editing ? 'Edit shift' : 'Assign shift'}</div>
            <div style={{ ...metaText, marginBottom: 12 }}>{cell.shift_name} · {dayLabel(cell.date)}</div>
            <div style={fieldLabel}>Team member</div>
            <select style={input} value={draft.member} onChange={e => setDraft(d => ({ ...d, member: e.target.value }))}>
              <option value="" style={opt}>— pick —</option>
              {team.map(m => <option key={m.id} value={m.id} style={opt}>{m.display_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Shift</div>
                <select style={input} value={draft.shift_name} onChange={e => setDraft(d => ({ ...d, shift_name: e.target.value }))}>
                  {types.map(t => <option key={t.name} value={t.name} style={opt}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Role (optional)</div>
                <input style={input} value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} placeholder="Bar, Floor…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Start (optional)</div>
                <input type="time" style={input} value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>End (optional)</div>
                <input type="time" style={input} value={draft.end_time} onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={fieldLabel}>Notes (optional)</div>
              <input style={input} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={saveAssign} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : cell.editing ? 'Save' : 'Assign'}</button>
              <button onClick={() => setCell(null)} style={tinyBtn}>Cancel</button>
              {cell.editing && (
                <button onClick={() => { const s = cell.editing; setCell(null); setConfirmRemove(s) }} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Remove</button>
              )}
            </div>
          </div>
        </>
      )}

      <PromptModal
        open={addTypeOpen}
        eyebrow="＋ SHIFT NAME"
        title="Add a shift name"
        label="Name (e.g. Brunch, Late) — editable anytime, no migration"
        confirmLabel="Add"
        onCancel={() => setAddTypeOpen(false)}
        onConfirm={addType}
      />
      <ConfirmModal
        open={!!confirmRemove}
        eyebrow="⚠ REMOVE SHIFT"
        title="Remove this shift?"
        subject={confirmRemove ? `${memberName(confirmRemove.member)} · ${confirmRemove.shift_name} · ${dayLabel(confirmRemove.shift_date)}` : undefined}
        body="Removes the assignment from the rota. The change is recorded in the activity log."
        confirmLabel="Remove shift"
        busyLabel="Removing…"
        busy={busy}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => { const s = confirmRemove; if (s) wrap(() => deleteShift(s.id), () => setConfirmRemove(null)) }}
      />
      {toastNode}
    </>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }
const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', textDecoration: 'none', opacity: 0.7 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: 0 }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, margin: '8px 0 0' }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const fieldLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }
const th: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2', fontWeight: 500, padding: '8px 10px', borderBottom: '1px solid rgba(229,212,194,0.12)', textAlign: 'left' }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(229,212,194,0.06)', borderLeft: '1px solid rgba(229,212,194,0.04)' }
const chip: React.CSSProperties = { textAlign: 'left', background: 'rgba(94,102,80,0.35)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4, padding: '4px 8px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const addCellBtn: React.CSSProperties = { textAlign: 'left', background: 'transparent', color: '#7E7864', border: '1px dashed rgba(229,212,194,0.18)', borderRadius: 4, padding: '3px 8px', fontFamily: FAMILY, fontSize: 10, cursor: 'pointer' }
const typePill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4, padding: '3px 4px 3px 9px', fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2' }
const typeRemove: React.CSSProperties = { background: 'transparent', border: 'none', color: '#C27070', cursor: 'pointer', fontFamily: FAMILY, fontSize: 13, lineHeight: 1, padding: '0 2px' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4, padding: '5px 10px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.06em' }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '8px 10px', fontFamily: FAMILY, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }
const opt: React.CSSProperties = { background: '#052E20' }
const emptyText: React.CSSProperties = { padding: '24px 0', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500 }
const modalBox: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px, 92vw)', background: '#0A3526', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 8, padding: '22px 24px', zIndex: 501, boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }
