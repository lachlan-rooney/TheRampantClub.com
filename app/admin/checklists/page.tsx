'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { vnDateString } from '@/lib/datetime'
import { CLOSING_HANDOVER_ITEM_ID, type SheetItemState } from '@/lib/checklist-templates'

// Admin / Floor / Shift Checklists
//
// Opening + closing sheets, DB-backed templates, snapshot-on-start sheets.
// Tick / fill as you go (autosaves with name + timestamp), seal at end
// of shift. Sealed sheets become a permanent point-in-time record —
// editing the template later only affects FUTURE sheets, never the
// sealed ones.
//
// Items render grouped by zone in template sort order. Checkbox items
// behave as today; text items show an input/textarea and capture answers
// into item_values. Required items (checkbox: must be ticked, text:
// must be filled) block the seal action both client- and server-side.

interface Sheet {
  id: string | null
  shift_date: string
  kind: 'opening' | 'closing'
  items: SheetItemState[]
  item_values: Record<string, string>
  free_notes: string | null
  submitted_by: string | null
  submitted_at: string | null
  template_version_at?: string | null
  // Closing-sheet only — the handover-ack receipt written by the
  // opening team via MX Daily. Stays null for opening sheets and for
  // closing sheets that haven't been acknowledged yet.
  handover_acknowledged_by?: string | null
  handover_acknowledged_at?: string | null
}

const OPENING_LABEL = 'Opening · club ready to open'
const CLOSING_LABEL = 'Closing · shift closed, handover recorded'

export default function ChecklistsPage() {
  const today = vnDateString()
  const [date, setDate] = useState(today)
  const [opening, setOpening] = useState<Sheet | null>(null)
  const [closing, setClosing] = useState<Sheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [initials, setInitials] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missingNotice, setMissingNotice] = useState<string | null>(null)
  const [history, setHistory] = useState<Sheet[]>([])
  // Detail-view modal — opens when a row in Recent Shifts is clicked.
  // The audit record renders read-only from the sheet's OWN snapshotted
  // items, independent of the live template. Closing the modal does
  // nothing to the underlying state.
  const [detailDate, setDetailDate] = useState<string | null>(null)
  useEffect(() => {
    if (!detailDate) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailDate(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [detailDate])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/checklists?date=${date}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        // Defensive default — older rows might not carry item_values.
        if (d.opening) setOpening({ ...d.opening, item_values: d.opening.item_values || {} })
        if (d.closing) setClosing({ ...d.closing, item_values: d.closing.item_values || {} })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date])
  useEffect(() => { load() }, [load])

  // Recent shifts strip — last 7 days of sealed sheets.
  const loadHistory = useCallback(async () => {
    const end = new Date(date + 'T12:00:00+07:00')
    const start = new Date(end); start.setDate(start.getDate() - 7)
    try {
      const r = await fetch(`/api/admin/checklists?from=${vnDateString(start)}&to=${vnDateString(end)}`, { cache: 'no-store' })
      const j = await r.json()
      if (Array.isArray(j.checklists)) setHistory(j.checklists)
    } catch { /* ignore */ }
  }, [date])
  useEffect(() => { loadHistory() }, [loadHistory])

  // Restore initials across sessions so the team doesn't type their name on every tick.
  useEffect(() => {
    try { setInitials(localStorage.getItem('checklist_initials') || '') } catch { /* */ }
  }, [])
  const persistInitials = (v: string) => {
    setInitials(v)
    try { localStorage.setItem('checklist_initials', v) } catch { /* */ }
  }

  const upsert = useCallback(async (
    kind: 'opening' | 'closing',
    items: SheetItemState[],
    item_values: Record<string, string>,
    free_notes: string | null,
    submit = false,
  ) => {
    setBusy(kind); setError(null); setMissingNotice(null)
    try {
      const r = await fetch('/api/admin/checklists/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: date, kind, items, item_values, free_notes,
          submit,
          submitted_by: submit ? initials : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        if (j.missing && Array.isArray(j.missing)) {
          setMissingNotice(`Cannot seal yet: ${j.missing.length} required item${j.missing.length === 1 ? '' : 's'} still need${j.missing.length === 1 ? 's' : ''} attention.`)
        }
        throw new Error(j.error || 'Save failed')
      }
      const merged: Sheet = { ...j.checklist, item_values: j.checklist.item_values || {} }
      if (kind === 'opening') setOpening(merged)
      else setClosing(merged)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }, [date, initials])

  // ── Mutations ──────────────────────────────────────────────────────
  const toggleItem = useCallback((sheet: Sheet, itemId: string) => {
    if (sheet.submitted_at) return
    if (!initials.trim()) { setError('Enter your initials at the top first.'); return }
    const items = sheet.items.map(it => it.id === itemId ? {
      ...it,
      checked: !it.checked,
      name:    !it.checked ? initials.trim() : null,
      ts:      !it.checked ? new Date().toISOString() : null,
    } : it)
    const next = { ...sheet, items }
    if (sheet.kind === 'opening') setOpening(next); else setClosing(next)
    upsert(sheet.kind, items, sheet.item_values || {}, sheet.free_notes)
  }, [initials, upsert])

  const updateItemValue = useCallback((sheet: Sheet, itemId: string, value: string) => {
    const item_values = { ...(sheet.item_values || {}), [itemId]: value }
    // For closing's handover-note, keep free_notes in sync locally so
    // the seam reflects the latest value before save lands.
    const free_notes = (sheet.kind === 'closing' && itemId === CLOSING_HANDOVER_ITEM_ID)
      ? value : sheet.free_notes
    const next = { ...sheet, item_values, free_notes }
    if (sheet.kind === 'opening') setOpening(next); else setClosing(next)
  }, [])

  const persistItemValue = useCallback((sheet: Sheet) => {
    upsert(sheet.kind, sheet.items, sheet.item_values || {}, sheet.free_notes)
  }, [upsert])

  const submitSheet = useCallback((sheet: Sheet) => {
    if (!initials.trim()) { setError('Enter your initials at the top first.'); return }
    upsert(sheet.kind, sheet.items, sheet.item_values || {}, sheet.free_notes, true)
  }, [initials, upsert])

  // ── Derived: progress + required-readiness ──────────────────────────
  const summary = (sheet: Sheet | null) => {
    if (!sheet) return { done: 0, total: 0, pct: 0, missing: 0, sealable: false }
    let done = 0, total = 0, missing = 0
    for (const it of sheet.items) {
      // Checkbox items count toward progress; text items count only if required.
      if (it.type === 'text') {
        if (it.required) {
          total++
          const val = (sheet.item_values?.[it.id] || '').trim()
          if (val) done++; else missing++
        }
      } else {
        total++
        if (it.checked) done++
        else if (it.required) missing++
      }
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { done, total, pct, missing, sealable: missing === 0 }
  }
  const openingS = useMemo(() => summary(opening), [opening])
  const closingS = useMemo(() => summary(closing), [closing])

  // ── Date stepper ────────────────────────────────────────────────────
  const shiftDay = (n: number) => {
    const d = new Date(date + 'T12:00:00+07:00')
    d.setDate(d.getDate() + n)
    setDate(vnDateString(d))
  }

  return (
    <>
      {/* Print stylesheet — applies only when the user prints the sealed
          audit-record modal. Hides everything except the modal body and
          switches to a light, ink-friendly palette so the printed output
          reads as a clean compliance document (binder backup, inspector
          handover) rather than a dark-mode screenshot. The on-screen
          experience is untouched — this only fires for @media print. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Reset the page to a white sheet */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* Hide everything except the detail modal */
          body > *:not([data-print-root]) { display: none !important; }
          [data-print-root] { display: block !important; }
          [data-print-root] [data-print-hide] { display: none !important; }

          /* Modal frame becomes a flat document */
          [data-print-root] [data-print-modal] {
            position: static !important;
            transform: none !important;
            width: auto !important;
            max-height: none !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            color: #000000 !important;
            padding: 0 !important;
          }
          [data-print-root] [data-print-modal] * {
            color: #000000 !important;
            background: transparent !important;
            border-color: #888888 !important;
            box-shadow: none !important;
          }
          /* Sheet blocks: visible card outline, page-break safety */
          [data-print-root] [data-print-sheet] {
            border: 1px solid #888888 !important;
            border-radius: 4px !important;
            padding: 14px !important;
            margin-bottom: 14px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Zone headers stand out in print */
          [data-print-root] [data-print-zone] {
            font-weight: 700 !important;
            border-bottom: 1px solid #cccccc !important;
            padding-bottom: 3px !important;
            margin-top: 10px !important;
          }
          /* Text-input answers get a quoted box */
          [data-print-root] [data-print-value] {
            border: 1px solid #aaaaaa !important;
            padding: 4px 8px !important;
            margin-top: 4px !important;
            background: #fafafa !important;
          }
          /* No URLs on hyperlinks (avoids "Go to live page (http://...)") */
          [data-print-root] a[href]::after { content: "" !important; }
        }
      `}} />
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Floor</div>
          <h1 style={pageTitle}>Shift Checklists</h1>
          <p style={lede}>
            Opening and closing sheets. Tick or fill as you go — your initials and timestamp are captured. Lock &amp; sign at the end seals the sheet permanently. Editing the template only affects future sheets.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <Link href="/admin/checklists/templates" style={editTemplatesLink}>
            ✎ Edit templates
          </Link>
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

      <div style={dateStepper}>
        <button onClick={() => shiftDay(-1)} style={navBtn}>← prev</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, maxWidth: 180, textAlign: 'center' }} />
        <button onClick={() => shiftDay(1)} style={navBtn}>next →</button>
        <button onClick={() => setDate(today)} style={navBtn}>Today</button>
        {date !== today && (
          <span style={{ marginLeft: 12, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', letterSpacing: '0.08em' }}>
            VIEWING {new Date(date + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {missingNotice && <div style={warnBox}>{missingNotice}</div>}

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : (
        <div style={twoCol}>
          {opening && (
            <SheetBlock
              sheet={opening}
              summary={openingS}
              kindLabel={OPENING_LABEL}
              kindColor="#D4B85A"
              busy={busy === 'opening'}
              onToggle={(id) => toggleItem(opening, id)}
              onText={(id, v) => updateItemValue(opening, id, v)}
              onTextBlur={() => persistItemValue(opening)}
              onSubmit={() => submitSheet(opening)}
            />
          )}
          {closing && (
            <SheetBlock
              sheet={closing}
              summary={closingS}
              kindLabel={CLOSING_LABEL}
              kindColor="#7AB07A"
              busy={busy === 'closing'}
              onToggle={(id) => toggleItem(closing, id)}
              onText={(id, v) => updateItemValue(closing, id, v)}
              onTextBlur={() => persistItemValue(closing)}
              onSubmit={() => submitSheet(closing)}
            />
          )}
        </div>
      )}

      {/* ── Recent shifts ─────────────────────────────────────────── */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={historyHead}>Recent shifts</div>
          <div style={historyGrid}>
            {(() => {
              // Group by date so each row shows opening + closing side-by-side.
              const byDate = new Map<string, { opening: Sheet | null; closing: Sheet | null }>()
              for (const s of history) {
                if (!byDate.has(s.shift_date)) byDate.set(s.shift_date, { opening: null, closing: null })
                const slot = byDate.get(s.shift_date)!
                if (s.kind === 'opening') slot.opening = s; else slot.closing = s
              }
              const rows = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
              return rows.map(([d, slot]) => {
                const anySealed = !!(slot.opening?.submitted_at || slot.closing?.submitted_at)
                return (
                  <button
                    key={d}
                    onClick={() => anySealed ? setDetailDate(d) : setDate(d)}
                    title={anySealed ? 'Open sealed audit record' : 'Go to this date on the live page'}
                    style={{ ...historyRowBtn, ...(d === date ? historyRowBtnActive : null) }}
                  >
                    <span style={historyDate}>
                      {new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span style={historyChip(slot.opening?.submitted_at ? '#D4B85A' : '#7E7864')}>
                      {slot.opening?.submitted_at ? '✓ opening' : slot.opening ? '○ opening' : '— opening'}
                    </span>
                    <span style={historyChip(slot.closing?.submitted_at ? '#7AB07A' : '#7E7864')}>
                      {slot.closing?.submitted_at ? '✓ closing' : slot.closing ? '○ closing' : '— closing'}
                    </span>
                    {anySealed && (
                      <span style={{ ...historyChip('#B2AA98'), marginLeft: 'auto' }}>view record →</span>
                    )}
                  </button>
                )
              })
            })()}
          </div>
        </div>
      )}

      <div style={hintRow}>
        Reading yesterday&apos;s closing handover is part of MX Daily — open <Link href="/admin/mx-daily" style={linkStyle}>MX Daily</Link> at the start of your shift.
      </div>

      {/* ── Sealed audit record modal ────────────────────────────────
          Renders the snapshotted items from the sheet itself (NOT the
          live template), so a sheet sealed under an old template reads
          here exactly as it was signed. Closes on Esc / backdrop click. */}
      {detailDate && (() => {
        const opening = history.find(s => s.shift_date === detailDate && s.kind === 'opening') || null
        const closing = history.find(s => s.shift_date === detailDate && s.kind === 'closing') || null
        return (
          <div data-print-root>
            <div style={detailBackdrop} onClick={() => setDetailDate(null)} data-print-hide />
            <div style={detailModal} role="dialog" data-print-modal>
              <div style={detailHeader}>
                <div>
                  <div style={eyebrow}>Sealed audit record</div>
                  <h2 style={detailDateHeading}>
                    {new Date(detailDate + 'T12:00:00+07:00').toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </h2>
                  <div style={detailSubline}>
                    Read-only. Items shown are the SHEET&apos;S OWN SNAPSHOT — never the live template — so this is what the signing team actually saw and ticked that night.
                  </div>
                </div>
                <button onClick={() => setDetailDate(null)} style={detailCloseBtn} aria-label="Close" data-print-hide>✕</button>
              </div>

              <div style={detailBody}>
                {opening && <DetailSheet sheet={opening} kindLabel="Opening" kindColor="#D4B85A" />}
                {closing && <DetailSheet sheet={closing} kindLabel="Closing" kindColor="#7AB07A" />}
                {!opening && !closing && (
                  <div style={emptyText}>No sealed record for this date.</div>
                )}
              </div>

              <div style={detailFooter} data-print-hide>
                <button onClick={() => { setDate(detailDate); setDetailDate(null) }} style={detailFooterBtn}>
                  Go to this date on the live page →
                </button>
                <button onClick={() => window.print()} style={detailFooterBtn}>
                  Print
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

// ── DetailSheet ───────────────────────────────────────────────────────
// Read-only render of a sealed (or in-progress) sheet's snapshot. No
// editing, no fill controls — just the audit truth: what was ticked,
// what was written, who signed, when.
function DetailSheet({ sheet, kindLabel, kindColor }: {
  sheet: Sheet
  kindLabel: string
  kindColor: string
}) {
  const grouped = useMemo(() => {
    const byZone = new Map<string, SheetItemState[]>()
    for (const it of sheet.items) {
      const zone = it.zone || '(no zone)'
      if (!byZone.has(zone)) byZone.set(zone, [])
      byZone.get(zone)!.push(it)
    }
    const zones = [...byZone.entries()].map(([zone, items]) => ({
      zone,
      items: items.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      minSort: Math.min(...items.map(i => i.sort_order ?? 0)),
    }))
    zones.sort((a, b) => a.minSort - b.minSort)
    return zones
  }, [sheet.items])

  const total = sheet.items.length
  const ticked = sheet.items.filter(i => i.checked).length
  const sealed = !!sheet.submitted_at

  // Closing-only — render the handover-ack receipt under the seal line
  // when present. Three states the loop can be in for a closing sheet:
  //   1. sealed AND acknowledged → "✓ Sealed... · ✓ Read by X · t"
  //   2. sealed but not yet acknowledged → "✓ Sealed... · ○ awaiting handover-ack"
  //   3. not sealed → existing "in progress" state, no ack possible yet
  const isClosing = sheet.kind === 'closing'
  const ackBy = sheet.handover_acknowledged_by
  const ackAt = sheet.handover_acknowledged_at

  return (
    <div style={detailSheetBlock} data-print-sheet>
      <div style={detailSheetHeader}>
        <div style={{ ...sheetEyebrow, color: kindColor }}>{kindLabel}</div>
        <div style={detailSealLine}>
          {sealed ? (
            <>
              <strong style={{ color: kindColor }}>✓ Signed off by {sheet.submitted_by}</strong>
              <span style={{ color: '#7E7864', marginLeft: 8 }}>· {fmtTimestamp(sheet.submitted_at)}</span>
            </>
          ) : (
            <span style={{ color: '#E58F4A' }}>○ In progress — not yet sealed ({ticked}/{total} ticked)</span>
          )}
        </div>
        {isClosing && sealed && (
          <div style={detailAckLine}>
            {ackAt ? (
              <>
                <strong style={{ color: '#7AB07A' }}>✓ Handover read by {ackBy || 'unknown'}</strong>
                <span style={{ color: '#7E7864', marginLeft: 8 }}>· {fmtTimestamp(ackAt)}</span>
              </>
            ) : (
              <span style={{ color: '#B2AA98', fontStyle: 'italic' }}>
                ○ Awaiting handover-acknowledgement — opening team will tick this on MX Daily.
              </span>
            )}
          </div>
        )}
      </div>

      {grouped.map(({ zone, items }) => (
        <div key={zone} style={{ marginTop: 10 }}>
          <div style={{ ...zoneLabel, color: kindColor }} data-print-zone>{zone}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map(it => {
              const isText = it.type === 'text'
              const value  = sheet.item_values?.[it.id] ?? ''
              const filled = value.trim().length > 0
              return (
                <div key={it.id} style={detailItemRow}>
                  <span
                    style={{ fontSize: 11, marginTop: 2, color: it.checked || filled ? kindColor : '#5E6650', flexShrink: 0 }}
                  >
                    {isText ? (filled ? '✎' : '○') : (it.checked ? '✓' : '○')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...itemLabel, color: it.checked || filled ? '#E5D4C2' : '#7E7864' }}>
                      {it.label_en || it.label}
                    </div>
                    {it.label_vn && <div style={itemLabelVn}>{it.label_vn}</div>}
                    {isText && filled && (
                      <div style={detailItemValue} data-print-value>{value}</div>
                    )}
                    {it.checked && it.name && (
                      <div style={itemMeta}>Ticked by {it.name} · {fmtTimestamp(it.ts ?? null)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── SheetBlock ────────────────────────────────────────────────────────
function SheetBlock({ sheet, summary, kindLabel, kindColor, busy, onToggle, onText, onTextBlur, onSubmit }: {
  sheet: Sheet
  summary: { done: number; total: number; pct: number; missing: number; sealable: boolean }
  kindLabel: string
  kindColor: string
  busy: boolean
  onToggle: (itemId: string) => void
  onText: (itemId: string, v: string) => void
  onTextBlur: () => void
  onSubmit: () => void
}) {
  const locked = !!sheet.submitted_at

  // Group items by zone, preserving zone order via the lowest sort_order
  // in each group.
  const grouped = useMemo(() => {
    const byZone = new Map<string, SheetItemState[]>()
    for (const it of sheet.items) {
      const zone = it.zone || '(no zone)'
      if (!byZone.has(zone)) byZone.set(zone, [])
      byZone.get(zone)!.push(it)
    }
    const zones = [...byZone.entries()].map(([zone, items]) => ({
      zone,
      items: items.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      minSort: Math.min(...items.map(i => i.sort_order ?? 0)),
    }))
    zones.sort((a, b) => a.minSort - b.minSort)
    return zones
  }, [sheet.items])

  const sealDisabled = locked || !summary.sealable || busy

  return (
    <div style={{ ...sheetBlock, ...(locked ? { borderColor: kindColor + '60' } : null) }}>
      <div style={sheetHeader}>
        <div>
          <div style={{ ...sheetEyebrow, color: kindColor }}>{kindLabel}</div>
          <div style={sheetTitle}>
            {summary.done}/{summary.total} required complete · {summary.pct}%
            {summary.missing > 0 && !locked && (
              <span style={{ color: '#E58F4A', fontSize: 12, marginLeft: 8, fontFamily: "'Google Sans Code', monospace" }}>
                · {summary.missing} required item{summary.missing === 1 ? '' : 's'} pending
              </span>
            )}
          </div>
        </div>
        {locked ? (
          <div style={{ ...lockedBadge, color: kindColor, borderColor: kindColor + '60' }}>
            ✓ Signed off by {sheet.submitted_by} · {fmtTimestamp(sheet.submitted_at!)}
          </div>
        ) : (
          <button
            onClick={onSubmit}
            disabled={sealDisabled}
            title={!summary.sealable ? 'Complete all required items first' : 'Lock and sign this sheet'}
            style={{
              ...btnSign,
              background: kindColor + '18', color: kindColor, borderColor: kindColor + '40',
              opacity: sealDisabled ? 0.4 : 1,
              cursor: sealDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            Lock &amp; sign
          </button>
        )}
      </div>

      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${summary.pct}%`, background: kindColor }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
        {grouped.map(({ zone, items }) => (
          <div key={zone}>
            <div style={{ ...zoneLabel, color: kindColor }}>{zone}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(it => it.type === 'text' ? (
                <TextItem
                  key={it.id}
                  item={it}
                  value={sheet.item_values?.[it.id] ?? ''}
                  locked={locked}
                  kindColor={kindColor}
                  onChange={v => onText(it.id, v)}
                  onBlur={onTextBlur}
                />
              ) : (
                <CheckboxItem
                  key={it.id}
                  item={it}
                  locked={locked}
                  kindColor={kindColor}
                  onToggle={() => onToggle(it.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CheckboxItem({ item, locked, kindColor, onToggle }: {
  item: SheetItemState
  locked: boolean
  kindColor: string
  onToggle: () => void
}) {
  return (
    <div style={{ ...itemRow, ...(item.checked ? { background: kindColor + '08' } : null), ...(locked ? { opacity: 0.7 } : null) }}>
      <input
        type="checkbox"
        checked={!!item.checked}
        onChange={onToggle}
        disabled={locked}
        style={{ accentColor: kindColor, marginTop: 2, cursor: locked ? 'not-allowed' : 'pointer' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...itemLabel, ...(item.checked ? { color: '#E5D4C2' } : null) }}>{item.label_en || item.label}</span>
          {item.required && <span style={requiredPill} title="Required for sealing">required</span>}
        </div>
        {item.label_vn && <div style={itemLabelVn}>{item.label_vn}</div>}
        {item.checked && (
          <div style={itemMeta}>Ticked by {item.name || 'unknown'} · {fmtTimestamp(item.ts ?? null)}</div>
        )}
      </div>
    </div>
  )
}

function TextItem({ item, value, locked, kindColor, onChange, onBlur }: {
  item: SheetItemState
  value: string
  locked: boolean
  kindColor: string
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const isHandover = item.id === CLOSING_HANDOVER_ITEM_ID
  const filled = value.trim().length > 0
  return (
    <div style={{ ...itemRow, ...(filled ? { background: kindColor + '08' } : null), flexDirection: 'column', alignItems: 'stretch', ...(locked ? { opacity: 0.85 } : null) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ ...itemLabel, color: '#E5D4C2' }}>{item.label_en || item.label}</span>
        {item.required && <span style={requiredPill} title="Required for sealing">required</span>}
        {filled && !locked && <span style={filledChip(kindColor)}>✓ filled</span>}
      </div>
      {item.label_vn && <div style={{ ...itemLabelVn, marginBottom: 6 }}>{item.label_vn}</div>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={locked}
        placeholder={item.placeholder || (isHandover ? 'What does the next shift / MX need to know?' : '')}
        rows={isHandover ? 4 : 2}
        style={{ ...inputStyle, resize: 'vertical', fontSize: 12 }}
      />
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
const editTemplatesLink: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.08em',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 4,
  padding: '6px 12px', textDecoration: 'none',
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4, marginTop: 8,
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
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
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
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
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
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
const progressTrack: React.CSSProperties = {
  height: 3, background: 'rgba(229,212,194,0.08)', borderRadius: 2, overflow: 'hidden',
}
const progressFill: React.CSSProperties = {
  height: '100%', transition: 'width 0.4s ease',
}
const zoneLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 6, fontWeight: 600,
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
const itemLabelVn: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', fontStyle: 'italic', marginTop: 2,
}
const itemMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em', marginTop: 4,
}
const requiredPill: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 8,
  color: '#E58F4A',
  background: 'rgba(229,143,74,0.10)',
  border: '1px solid rgba(229,143,74,0.40)',
  borderRadius: 3, padding: '1px 6px',
  letterSpacing: '0.10em', textTransform: 'uppercase',
}
function filledChip(c: string): React.CSSProperties {
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 8,
    color: c,
    background: c + '14',
    border: `1px solid ${c}40`,
    borderRadius: 3, padding: '1px 6px',
    letterSpacing: '0.10em', textTransform: 'uppercase',
  }
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
// ── Detail-view modal ─────────────────────────────────────────────────
// Read-only audit-record renderer. Modal sits over the page so the
// editable surface stays in place behind it; close to return to live.
const detailBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200,
}
const detailModal: React.CSSProperties = {
  position: 'fixed',
  top: '5vh', left: '50%', transform: 'translateX(-50%)',
  width: 'min(1100px, 94vw)', maxHeight: '90vh',
  background: '#0A3526',
  border: '1px solid rgba(229,212,194,0.15)',
  borderRadius: 10,
  zIndex: 201,
  boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  display: 'flex', flexDirection: 'column',
}
const detailHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 14,
  padding: '22px 26px 14px',
  borderBottom: '1px solid rgba(229,212,194,0.10)',
}
const detailDateHeading: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 500,
  color: '#E5D4C2', margin: '4px 0 2px', letterSpacing: '0.03em',
}
const detailSubline: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em', lineHeight: 1.5,
  maxWidth: 720,
}
const detailCloseBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4,
  padding: '6px 10px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 13,
}
const detailBody: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
  gap: 18, padding: 22, overflowY: 'auto', flex: 1,
}
const detailSheetBlock: React.CSSProperties = {
  padding: 16,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 8,
}
const detailSheetHeader: React.CSSProperties = {
  paddingBottom: 10, marginBottom: 4,
  borderBottom: '1px solid rgba(229,212,194,0.08)',
}
const detailSealLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', marginTop: 4, letterSpacing: '0.04em',
}
const detailAckLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', marginTop: 4, letterSpacing: '0.04em',
}
const detailItemRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '6px 8px',
  borderRadius: 3,
}
const detailItemValue: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.55, marginTop: 4,
  padding: '6px 10px',
  background: 'rgba(5,46,32,0.6)',
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 4,
  whiteSpace: 'pre-wrap',
}
const detailFooter: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
  padding: '14px 22px',
  borderTop: '1px solid rgba(229,212,194,0.10)',
}
const detailFooterBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer',
}

const historyHead: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 10,
}
const historyGrid: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const historyRowBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 4,
  padding: '8px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', cursor: 'pointer', textAlign: 'left',
}
const historyRowBtnActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.08)',
  borderColor: 'rgba(212,184,90,0.30)',
}
const historyDate: React.CSSProperties = {
  flex: 1, color: '#B2AA98', letterSpacing: '0.04em',
}
function historyChip(c: string): React.CSSProperties {
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: c,
    background: c + '14',
    border: `1px solid ${c}40`,
    borderRadius: 3, padding: '2px 8px',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
}

const warnBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(229,143,74,0.12)', border: '1px solid rgba(229,143,74,0.40)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
