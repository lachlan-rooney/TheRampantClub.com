'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ChecklistTemplateItem } from '@/lib/checklist-templates'

// Admin / Floor / Checklist Templates
//
// Edit the opening + closing template definitions. Add / reorder /
// reword / remove items, set type (checkbox or text), set group/zone,
// mark required, edit bilingual labels. The page makes the decoupling
// rule explicit: changes affect FUTURE sheets only — sealed sheets
// snapshotted the items as they were at start and are never re-read
// against this template.

type Kind = 'opening' | 'closing'

interface Template {
  kind: Kind
  items: ChecklistTemplateItem[]
  updated_by: string | null
  updated_at: string
  source: 'db' | 'fallback'
}

export default function ChecklistTemplatesPage() {
  const [opening, setOpening] = useState<Template | null>(null)
  const [closing, setClosing] = useState<Template | null>(null)
  const [activeKind, setActiveKind] = useState<Kind>('opening')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/checklists/templates', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'failed')
      setOpening(j.opening); setClosing(j.closing)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const current = activeKind === 'opening' ? opening : closing
  const setCurrent = (t: Template) => {
    if (activeKind === 'opening') setOpening(t); else setClosing(t)
  }

  const save = async () => {
    if (!current) return
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/admin/checklists/templates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: current.kind, items: current.items }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'save failed')
      setCurrent({ ...current, items: j.template.items, updated_by: j.template.updated_by, updated_at: j.template.updated_at, source: 'db' })
      setSavedAt(new Date().toISOString())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Floor · Templates</div>
          <h1 style={pageTitle}>Checklist Templates</h1>
          <p style={lede}>
            Add, reorder, reword, or remove items in the opening and closing checklists. Changes affect <strong>future sheets only</strong>. Every sheet that has already been sealed kept a snapshot of the items at the moment it was started; those records are never re-read against this template, so a wording or item change here cannot rewrite history.
          </p>
        </div>
        <Link href="/admin/checklists" style={backLink}>← back to sheets</Link>
      </div>

      <div style={tabRow}>
        {(['opening', 'closing'] as Kind[]).map(k => (
          <button
            key={k}
            onClick={() => setActiveKind(k)}
            style={{ ...tab, ...(activeKind === k ? { ...tabActive, color: k === 'opening' ? '#D4B85A' : '#7AB07A', borderColor: (k === 'opening' ? '#D4B85A' : '#7AB07A') + '60' } : null) }}
          >
            {k.toUpperCase()} template
          </button>
        ))}
      </div>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : !current ? (
        <div style={errorBox}>Template not loaded.</div>
      ) : (
        <Editor
          template={current}
          kindColor={activeKind === 'opening' ? '#D4B85A' : '#7AB07A'}
          onItems={(items) => setCurrent({ ...current, items })}
          onSave={save}
          saving={saving}
          savedAt={savedAt}
          error={error}
        />
      )}
    </>
  )
}

function Editor({ template, kindColor, onItems, onSave, saving, savedAt, error }: {
  template: Template
  kindColor: string
  onItems: (items: ChecklistTemplateItem[]) => void
  onSave: () => void
  saving: boolean
  savedAt: string | null
  error: string | null
}) {
  const items = template.items

  // Toast for non-blocking notices (replaces alert()).
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4200)
  }
  // Confirm modal — single destructive path (remove item from template).
  const [confirmRemove, setConfirmRemove] = useState<ChecklistTemplateItem | null>(null)

  // Group by zone for the editor too (matches what staff see at runtime).
  // Use the editor-side ordering by sort_order; staff sort the same way.
  const ordered = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items])

  const updateItem = (id: string, patch: Partial<ChecklistTemplateItem>) => {
    onItems(items.map(it => it.id === id ? { ...it, ...patch } : it))
  }
  const moveItem = (id: string, dir: -1 | 1) => {
    const idx = ordered.findIndex(it => it.id === id)
    if (idx < 0) return
    const target = idx + dir
    if (target < 0 || target >= ordered.length) return
    const a = ordered[idx], b = ordered[target]
    // Swap sort orders.
    onItems(items.map(it =>
      it.id === a.id ? { ...it, sort_order: b.sort_order } :
      it.id === b.id ? { ...it, sort_order: a.sort_order } : it
    ))
  }
  const requestRemove = (item: ChecklistTemplateItem) => setConfirmRemove(item)
  const runRemove = () => {
    if (!confirmRemove) return
    onItems(items.filter(it => it.id !== confirmRemove.id))
    setConfirmRemove(null)
  }
  const addItem = (zone: string) => {
    const id = prompt('New item id (lowercase, hyphens, must be unique):')?.trim()
    if (!id) return
    if (items.some(it => it.id === id)) { showToast(`An item with id "${id}" already exists.`, 'error'); return }
    const maxSort = items.length === 0 ? 0 : Math.max(...items.map(it => it.sort_order))
    onItems([...items, {
      id,
      label_en: 'New item',
      label_vn: null,
      type: 'checkbox',
      zone: zone || 'New zone',
      required: false,
      sort_order: maxSort + 10,
    }])
  }
  const renameZone = (oldZone: string) => {
    const fresh = prompt(`Rename zone "${oldZone}" to:`, oldZone)?.trim()
    if (!fresh || fresh === oldZone) return
    onItems(items.map(it => it.zone === oldZone ? { ...it, zone: fresh } : it))
  }

  // Existing zones, in display order.
  const zones = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const it of ordered) {
      if (!seen.has(it.zone)) { seen.add(it.zone); out.push(it.zone) }
    }
    return out
  }, [ordered])

  return (
    <div>
      <div style={savedRow}>
        {template.source === 'fallback' && (
          <span style={fallbackBadge}>
            ⚠ Showing in-repo seed (DB row not yet created — first save will create it)
          </span>
        )}
        {template.updated_at && template.source === 'db' && (
          <span style={updatedHint}>
            Last edited {fmtTimestamp(template.updated_at)}{template.updated_by ? ` by ${template.updated_by}` : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {savedAt && <span style={{ ...updatedHint, color: '#7AB07A' }}>✓ Saved {fmtTimestamp(savedAt)}</span>}
          <button onClick={onSave} disabled={saving} style={{ ...saveBtn, background: kindColor + '20', color: kindColor, borderColor: kindColor + '50' }}>
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={futureBanner}>
        Edits here apply to <strong>new sheets only</strong>. Sealed sheets keep the items they were started with — even renaming or removing an item here will not rewrite them.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {zones.map(zone => (
          <div key={zone} style={zoneBlock}>
            <div style={zoneHeaderRow}>
              <div style={{ ...zoneTitle, color: kindColor }}>{zone}</div>
              <button onClick={() => renameZone(zone)} style={tinyBtn}>rename</button>
              <button onClick={() => addItem(zone)} style={tinyBtn}>＋ add item</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ordered.filter(it => it.zone === zone).map(it => (
                <ItemEditor
                  key={it.id}
                  item={it}
                  kindColor={kindColor}
                  onPatch={(patch) => updateItem(it.id, patch)}
                  onUp={() => moveItem(it.id, -1)}
                  onDown={() => moveItem(it.id, 1)}
                  onRemove={() => requestRemove(it)}
                />
              ))}
            </div>
          </div>
        ))}

        <div style={addZoneRow}>
          <button onClick={() => {
            const zone = prompt('New zone name:')?.trim()
            if (!zone) return
            addItem(zone)
          }} style={tinyBtn}>＋ add zone</button>
        </div>
      </div>

      {/* ── Confirm modal (branded, replaces native window.confirm) ──── */}
      {confirmRemove && (
        <>
          <div style={confirmBackdrop} onClick={() => setConfirmRemove(null)} />
          <div style={confirmModalBox} role="dialog">
            <div style={confirmEyebrow}>⚠ TEMPLATE CHANGE</div>
            <div style={confirmTitle}>Remove this item?</div>
            <div style={confirmSubject}>{confirmRemove.label_en} · {confirmRemove.zone}</div>
            <p style={confirmBody}>
              Future sheets won&apos;t include it. Already-sealed sheets keep their snapshot and are unaffected. The change only takes effect once you save the template.
            </p>
            <div style={confirmActions}>
              <button onClick={() => setConfirmRemove(null)} style={confirmCancelBtn}>Cancel</button>
              <button onClick={runRemove} style={confirmGoBtn}>Remove item</button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div style={toast.tone === 'error' ? toastErrorBox : toastInfoBox} role="status">
          <span style={{ marginRight: 8, color: toast.tone === 'error' ? '#C27070' : '#7AB07A' }}>
            {toast.tone === 'error' ? '✕' : '✓'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  )
}

function ItemEditor({ item, kindColor, onPatch, onUp, onDown, onRemove }: {
  item: ChecklistTemplateItem
  kindColor: string
  onPatch: (p: Partial<ChecklistTemplateItem>) => void
  onUp: () => void
  onDown: () => void
  onRemove: () => void
}) {
  return (
    <div style={itemEditCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={itemIdPill}>{item.id}</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={onUp} style={tinyBtn} title="Move up">↑</button>
          <button onClick={onDown} style={tinyBtn} title="Move down">↓</button>
          <button onClick={onRemove} style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(194,112,112,0.40)' }}>remove</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
        <div>
          <div style={editLabel}>EN label</div>
          <input
            value={item.label_en}
            onChange={e => onPatch({ label_en: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={editLabel}>VN label (optional)</div>
          <input
            value={item.label_vn || ''}
            onChange={e => onPatch({ label_vn: e.target.value || null })}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={inlineCheckLabel}>
          <select value={item.type} onChange={e => onPatch({ type: e.target.value as ChecklistTemplateItem['type'] })} style={{ ...inputStyle, width: 'auto' }}>
            <option value="checkbox">Checkbox</option>
            <option value="text">Text input</option>
          </select>
        </label>
        <label style={inlineCheckLabel}>
          <input
            type="checkbox"
            checked={item.required}
            onChange={e => onPatch({ required: e.target.checked })}
            style={{ accentColor: kindColor }}
          />
          <span>required (blocks sealing)</span>
        </label>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={editLabel}>Zone</div>
          <input
            value={item.zone}
            onChange={e => onPatch({ zone: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>
      {item.type === 'text' && (
        <div style={{ marginTop: 8 }}>
          <div style={editLabel}>Placeholder (hint shown inside the text field)</div>
          <input
            value={item.placeholder || ''}
            onChange={e => onPatch({ placeholder: e.target.value })}
            style={inputStyle}
          />
        </div>
      )}
    </div>
  )
}

function fmtTimestamp(iso: string | null | undefined): string {
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
  fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const backLink: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.06em',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4,
  padding: '6px 12px', textDecoration: 'none',
}
const tabRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 18,
}
const tab: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const tabActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.08)',
}
const savedRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  marginBottom: 14,
}
const fallbackBadge: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E58F4A',
  background: 'rgba(229,143,74,0.10)',
  border: '1px solid rgba(229,143,74,0.40)',
  borderRadius: 4, padding: '4px 10px',
}
const updatedHint: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const saveBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 4, border: '1px solid',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer',
}
const futureBanner: React.CSSProperties = {
  marginBottom: 16, padding: '10px 14px',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.30)',
  borderLeft: '2px solid #D4B85A', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', lineHeight: 1.55,
}
const zoneBlock: React.CSSProperties = {
  padding: 14,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 6,
}
const zoneHeaderRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap',
}
const zoneTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
  flex: 1,
}
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 3,
  padding: '4px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.06em', cursor: 'pointer',
}
const itemEditCard: React.CSSProperties = {
  padding: 12,
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const itemIdPill: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.06em',
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '6px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const inlineCheckLabel: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98',
}
const addZoneRow: React.CSSProperties = {
  marginTop: 8, display: 'flex', justifyContent: 'flex-end',
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

// ── Confirm + toast styles ──────────────────────────────────────────
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
const toastBase: React.CSSProperties = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 400,
  padding: '12px 18px',
  background: '#0A3526',
  borderRadius: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.02em',
  display: 'flex', alignItems: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
}
const toastInfoBox: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(122,176,122,0.45)',
  borderLeft: '3px solid #7AB07A',
}
const toastErrorBox: React.CSSProperties = {
  ...toastBase,
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
}
