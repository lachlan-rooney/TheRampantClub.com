'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { vnDateString } from '@/lib/datetime'
import { CLOSING_HANDOVER_ITEM_ID, type SheetItemState } from '@/lib/checklist-templates'
import { useLang } from '@/lib/admin-lang'

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

interface Staff { id: string; display_name: string; role_title?: string | null }

const OPENING_LABEL = 'Opening · club ready to open'
const CLOSING_LABEL = 'Closing · shift closed, handover recorded'

export default function ChecklistsPage() {
  const { t } = useLang()
  const today = vnDateString()
  const [date, setDate] = useState(today)
  // Deep-link from an Ops Hub card link (?date=YYYY-MM-DD) → open that day.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('date')
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d)
  }, [])
  const [opening, setOpening] = useState<Sheet | null>(null)
  const [closing, setClosing] = useState<Sheet | null>(null)
  const [loading, setLoading] = useState(true)
  // `initials` holds the SELECTED staff member's display name — every tick and
  // the final seal are attributed to this person, so each sheet answers "who
  // did it / who's responsible" with a real name, not free-typed initials.
  const [initials, setInitials] = useState('')
  const [staffList, setStaffList] = useState<Staff[]>([])
  // Set when Lock & sign is pressed — drives the confirm-before-seal modal.
  const [confirmSheet, setConfirmSheet] = useState<Sheet | null>(null)
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

  // Load the staff roster for the "who are you" dropdown, then pre-select:
  // (1) whoever is already ACTING on this device (the trc_admin_staff identity),
  // else (2) the last person remembered on this device. We only accept a value
  // that's actually in the current roster, so a stale/removed name never stamps.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rr = await fetch('/api/admin/acting', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'roster' }),
        })
        const roster: Staff[] = rr.ok ? ((await rr.json()).staff || []) : []
        if (cancelled) return
        setStaffList(roster)
        const names = new Set(roster.map(s => s.display_name))

        let pick = ''
        try {
          const gr = await fetch('/api/admin/acting', { cache: 'no-store' })
          if (gr.ok) { const acting = (await gr.json()).staff; if (acting?.display_name && names.has(acting.display_name)) pick = acting.display_name }
        } catch { /* acting is best-effort */ }
        if (!pick) {
          try { const saved = localStorage.getItem('checklist_initials') || ''; if (names.has(saved)) pick = saved } catch { /* */ }
        }
        if (pick && !cancelled) setInitials(pick)
      } catch { /* roster is best-effort; the field simply stays empty */ }
    })()
    return () => { cancelled = true }
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
          setMissingNotice(`${t('Cannot seal yet','Chưa thể niêm phong')}: ${j.missing.length} ${t('required item','mục bắt buộc')}${j.missing.length === 1 ? '' : 's'} ${t('still need','vẫn cần')}${j.missing.length === 1 ? 's' : ''} ${t('attention','được hoàn thành')}.`)
        }
        throw new Error(j.error || t('Save failed', 'Lưu thất bại'))
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
    if (!initials.trim()) { setError(t('Select your name at the top first.', 'Vui lòng chọn tên của bạn ở trên trước.')); return }
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

  // Lock & sign is a permanent, attributed action → confirm first (naming the
  // responsible person) rather than sealing on a single click.
  const submitSheet = useCallback((sheet: Sheet) => {
    if (!initials.trim()) { setError(t('Select your name at the top first.', 'Vui lòng chọn tên của bạn ở trên trước.')); return }
    setError(null)
    setConfirmSheet(sheet)
  }, [initials])

  const confirmAndSeal = useCallback(() => {
    const sheet = confirmSheet
    if (!sheet || !initials.trim()) { setConfirmSheet(null); return }
    setConfirmSheet(null)
    upsert(sheet.kind, sheet.items, sheet.item_values || {}, sheet.free_notes, true)
  }, [confirmSheet, initials, upsert])

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
          <div style={eyebrow}>{t('Floor', 'Sàn')}</div>
          <h1 style={pageTitle}>{t('Shift Checklists', 'Danh sách kiểm tra ca')}</h1>
          <p style={lede}>
            {t('Opening and closing sheets. Pick your name, then tick or fill as you go — your name and timestamp are captured on every item. Lock & sign at the end seals the sheet permanently under whoever signs it. Editing the template only affects future sheets.', 'Phiếu mở cửa và đóng cửa. Chọn tên của bạn, sau đó đánh dấu hoặc điền trong khi làm — tên và thời gian của bạn được ghi lại trên mỗi mục. Khoá & ký ở cuối sẽ niêm phong phiếu vĩnh viễn dưới tên người ký. Chỉnh sửa mẫu chỉ ảnh hưởng đến các phiếu sau này.')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <Link href="/admin/checklists/templates" style={editTemplatesLink}>
            ✎ {t('Edit templates', 'Chỉnh sửa mẫu')}
          </Link>
          <label style={editLabel}>{t('You are', 'Bạn là')}</label>
          {staffList.length > 0 ? (
            <select
              value={initials}
              onChange={e => persistInitials(e.target.value)}
              style={{ ...inputStyle, maxWidth: 220, cursor: 'pointer' }}
            >
              <option value="">{t('— select your name —', '— chọn tên của bạn —')}</option>
              {staffList.map(s => (
                <option key={s.id} value={s.display_name}>
                  {s.display_name}{s.role_title ? ` · ${s.role_title}` : ''}
                </option>
              ))}
            </select>
          ) : (
            // Fallback if the roster can't be loaded — never leave the sheet unusable.
            <input
              value={initials}
              onChange={e => persistInitials(e.target.value)}
              placeholder={t('Your name', 'Tên của bạn')}
              maxLength={40}
              style={{ ...inputStyle, maxWidth: 220 }}
            />
          )}
        </div>
      </div>

      <div style={dateStepper}>
        <button onClick={() => shiftDay(-1)} style={navBtn}>← {t('prev', 'trước')}</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, maxWidth: 180, textAlign: 'center' }} />
        <button onClick={() => shiftDay(1)} style={navBtn}>{t('next', 'sau')} →</button>
        <button onClick={() => setDate(today)} style={navBtn}>{t('Today', 'Hôm nay')}</button>
        {date !== today && (
          <span style={{ marginLeft: 12, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', letterSpacing: '0.08em' }}>
            {t('VIEWING', 'ĐANG XEM')} {new Date(date + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {missingNotice && <div style={warnBox}>{missingNotice}</div>}

      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : (
        <div style={twoCol}>
          {opening && (
            <SheetBlock
              sheet={opening}
              summary={openingS}
              kindLabel={t(OPENING_LABEL, 'Mở cửa · câu lạc bộ sẵn sàng mở cửa')}
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
              kindLabel={t(CLOSING_LABEL, 'Đóng cửa · ca đã đóng, đã ghi bàn giao')}
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
          <div style={historyHead}>{t('Recent shifts', 'Các ca gần đây')}</div>
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
                    title={anySealed ? t('Open sealed audit record', 'Mở hồ sơ kiểm toán đã niêm phong') : t('Go to this date on the live page', 'Đến ngày này trên trang trực tiếp')}
                    style={{ ...historyRowBtn, ...(d === date ? historyRowBtnActive : null) }}
                  >
                    <span style={historyDate}>
                      {new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span style={historyChip(slot.opening?.submitted_at ? '#D4B85A' : '#7E7864')}>
                      {slot.opening?.submitted_at ? `✓ ${t('opening', 'mở cửa')}` : slot.opening ? `○ ${t('opening', 'mở cửa')}` : `— ${t('opening', 'mở cửa')}`}
                    </span>
                    <span style={historyChip(slot.closing?.submitted_at ? '#7AB07A' : '#7E7864')}>
                      {slot.closing?.submitted_at ? `✓ ${t('closing', 'đóng cửa')}` : slot.closing ? `○ ${t('closing', 'đóng cửa')}` : `— ${t('closing', 'đóng cửa')}`}
                    </span>
                    {anySealed && (
                      <span style={{ ...historyChip('#B2AA98'), marginLeft: 'auto' }}>{t('view record', 'xem hồ sơ')} →</span>
                    )}
                  </button>
                )
              })
            })()}
          </div>
        </div>
      )}

      <div style={hintRow}>
        {t("Reading yesterday's closing handover is part of MX Daily — open ", 'Đọc bàn giao đóng ca của hôm qua là một phần của MX Daily — mở ')}<Link href="/admin/mx-daily" style={linkStyle}>MX Daily</Link>{t(' at the start of your shift.', ' vào đầu ca của bạn.')}
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
                  <div style={eyebrow}>{t('Sealed audit record', 'Hồ sơ kiểm toán đã niêm phong')}</div>
                  <h2 style={detailDateHeading}>
                    {new Date(detailDate + 'T12:00:00+07:00').toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </h2>
                  <div style={detailSubline}>
                    {t("Read-only. Items shown are the SHEET'S OWN SNAPSHOT — never the live template — so this is what the signing team actually saw and ticked that night.", 'Chỉ đọc. Các mục hiển thị là ẢNH CHỤP CỦA CHÍNH PHIẾU — không bao giờ là mẫu trực tiếp — nên đây chính là những gì đội ký duyệt thực sự đã thấy và đánh dấu đêm đó.')}
                  </div>
                </div>
                <button onClick={() => setDetailDate(null)} style={detailCloseBtn} aria-label={t('Close', 'Đóng')} data-print-hide>✕</button>
              </div>

              <div style={detailBody}>
                {opening && <DetailSheet sheet={opening} kindLabel={t('Opening', 'Mở cửa')} kindColor="#D4B85A" />}
                {closing && <DetailSheet sheet={closing} kindLabel={t('Closing', 'Đóng cửa')} kindColor="#7AB07A" />}
                {!opening && !closing && (
                  <div style={emptyText}>{t('No sealed record for this date.', 'Không có hồ sơ đã niêm phong cho ngày này.')}</div>
                )}
              </div>

              <div style={detailFooter} data-print-hide>
                <button onClick={() => { setDate(detailDate); setDetailDate(null) }} style={detailFooterBtn}>
                  {t('Go to this date on the live page', 'Đến ngày này trên trang trực tiếp')} →
                </button>
                <button onClick={() => window.print()} style={detailFooterBtn}>
                  {t('Print', 'In')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Confirm-before-seal ───────────────────────────────────────
          Lock & sign is permanent and attributed. Confirm names the
          responsible person and the sheet, so no one seals by mis-click. */}
      {confirmSheet && (
        <div>
          <div style={detailBackdrop} onClick={() => setConfirmSheet(null)} />
          <div style={confirmModal} role="dialog" aria-modal="true">
            <div style={eyebrow}>{t('Lock & sign', 'Khoá & ký')}</div>
            <h2 style={confirmHeading}>
              {confirmSheet.kind === 'opening'
                ? t('Seal the opening sheet?', 'Niêm phong phiếu mở cửa?')
                : t('Seal the closing sheet?', 'Niêm phong phiếu đóng cửa?')}
            </h2>
            <p style={confirmBody}>
              {t('This permanently seals the sheet — no further edits. It will be signed and recorded as your responsibility:', 'Thao tác này niêm phong phiếu vĩnh viễn — không thể chỉnh sửa thêm. Phiếu sẽ được ký và ghi nhận là trách nhiệm của bạn:')}
            </p>
            <div style={confirmSigner}>
              <span style={{ color: '#7E7864' }}>{t('Signed by', 'Ký bởi')}</span>
              <span style={{ color: '#E5D4C2', fontSize: 15 }}>{initials || '—'}</span>
            </div>
            <div style={confirmActions}>
              <button onClick={() => setConfirmSheet(null)} style={confirmCancelBtn}>
                {t('Cancel', 'Huỷ')}
              </button>
              <button onClick={confirmAndSeal} style={confirmSealBtn}>
                {t('Confirm & seal', 'Xác nhận & niêm phong')}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const { t } = useLang()
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
              <strong style={{ color: kindColor }}>✓ {t('Signed off by', 'Ký duyệt bởi')} {sheet.submitted_by}</strong>
              <span style={{ color: '#7E7864', marginLeft: 8 }}>· {fmtTimestamp(sheet.submitted_at)}</span>
            </>
          ) : (
            <span style={{ color: '#E58F4A' }}>○ {t('In progress — not yet sealed', 'Đang thực hiện — chưa niêm phong')} ({ticked}/{total} {t('ticked', 'đã đánh dấu')})</span>
          )}
        </div>
        {isClosing && sealed && (
          <div style={detailAckLine}>
            {ackAt ? (
              <>
                <strong style={{ color: '#7AB07A' }}>✓ {t('Handover read by', 'Bàn giao được đọc bởi')} {ackBy || t('unknown', 'không rõ')}</strong>
                <span style={{ color: '#7E7864', marginLeft: 8 }}>· {fmtTimestamp(ackAt)}</span>
              </>
            ) : (
              <span style={{ color: '#B2AA98', fontStyle: 'italic' }}>
                ○ {t('Awaiting handover-acknowledgement — opening team will tick this on MX Daily.', 'Đang chờ xác nhận bàn giao — đội mở cửa sẽ đánh dấu mục này trên MX Daily.')}
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
                      <div style={itemMeta}>{t('Ticked by', 'Đánh dấu bởi')} {it.name} · {fmtTimestamp(it.ts ?? null)}</div>
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
  const { t } = useLang()
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
            {summary.done}/{summary.total} {t('required complete', 'mục bắt buộc hoàn thành')} · {summary.pct}%
            {summary.missing > 0 && !locked && (
              <span style={{ color: '#E58F4A', fontSize: 12, marginLeft: 8, fontFamily: "'Google Sans Code', monospace" }}>
                · {summary.missing} {t(`required item${summary.missing === 1 ? '' : 's'} pending`, 'mục bắt buộc chưa hoàn thành')}
              </span>
            )}
          </div>
        </div>
        {locked ? (
          <div style={{ ...lockedBadge, color: kindColor, borderColor: kindColor + '60' }}>
            ✓ {t('Signed off by', 'Ký duyệt bởi')} {sheet.submitted_by} · {fmtTimestamp(sheet.submitted_at!)}
          </div>
        ) : (
          <button
            onClick={onSubmit}
            disabled={sealDisabled}
            title={!summary.sealable ? t('Complete all required items first', 'Hoàn thành tất cả mục bắt buộc trước') : t('Lock and sign this sheet', 'Khoá và ký phiếu này')}
            style={{
              ...btnSign,
              background: kindColor + '18', color: kindColor, borderColor: kindColor + '40',
              opacity: sealDisabled ? 0.4 : 1,
              cursor: sealDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {t('Lock', 'Khoá')} &amp; {t('sign', 'ký')}
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
  const { t } = useLang()
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
          {item.required && <span style={requiredPill} title={t('Required for sealing', 'Bắt buộc để niêm phong')}>{t('required', 'bắt buộc')}</span>}
        </div>
        {item.label_vn && <div style={itemLabelVn}>{item.label_vn}</div>}
        {item.checked && (
          <div style={itemMeta}>{t('Ticked by', 'Đánh dấu bởi')} {item.name || t('unknown', 'không rõ')} · {fmtTimestamp(item.ts ?? null)}</div>
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
  const { t } = useLang()
  const isHandover = item.id === CLOSING_HANDOVER_ITEM_ID
  const filled = value.trim().length > 0
  return (
    <div style={{ ...itemRow, ...(filled ? { background: kindColor + '08' } : null), flexDirection: 'column', alignItems: 'stretch', ...(locked ? { opacity: 0.85 } : null) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ ...itemLabel, color: '#E5D4C2' }}>{item.label_en || item.label}</span>
        {item.required && <span style={requiredPill} title={t('Required for sealing', 'Bắt buộc để niêm phong')}>{t('required', 'bắt buộc')}</span>}
        {filled && !locked && <span style={filledChip(kindColor)}>✓ {t('filled', 'đã điền')}</span>}
      </div>
      {item.label_vn && <div style={{ ...itemLabelVn, marginBottom: 6 }}>{item.label_vn}</div>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={locked}
        placeholder={item.placeholder || (isHandover ? t('What does the next shift / MX need to know?', 'Ca sau / MX cần biết những gì?') : '')}
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
const confirmModal: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(440px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 12,
  zIndex: 201,
  boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  padding: '24px 26px 22px',
}
const confirmHeading: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 500,
  color: '#E5D4C2', margin: '6px 0 10px', letterSpacing: '0.02em',
}
const confirmBody: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11.5,
  color: '#B2AA98', lineHeight: 1.6, margin: '0 0 14px',
}
const confirmSigner: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.06em',
  background: 'rgba(212,184,90,0.08)',
  border: '1px solid rgba(212,184,90,0.22)', borderRadius: 8,
  padding: '10px 14px', marginBottom: 20,
}
const confirmActions: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 10,
}
const confirmCancelBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.14)', borderRadius: 6,
  padding: '9px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em',
}
const confirmSealBtn: React.CSSProperties = {
  background: '#D4B85A', color: '#052E20',
  border: '1px solid #D4B85A', borderRadius: 6,
  padding: '9px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
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
