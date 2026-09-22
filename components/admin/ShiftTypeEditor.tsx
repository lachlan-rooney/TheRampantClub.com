'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { RotaShiftType } from '@/lib/ops/types'

// ═══════════════════════════════════════════════════════════════════════════
// SHIFT TIMES — start, end, break, paid hours and weekdays of each shift type.
// ───────────────────────────────────────────────────────────────────────────
// 2026-09-15: the Open shift moving to 14:00–22:30 took an SQL file
// (db/rota_open_two.sql), and so did every break, every weekday and every
// hours figure before it. This is that file, as a form.
//
// PAID HOURS ARE WORKED OUT, NOT TYPED. checkWeek counts a shift's paid hours
// from its times less the type's UNPAID break, and falls back to this hours
// column only when a shift has no times — so the two must agree, or a week is
// checked quietly wrong. S1–S4 carry no break here: their 30-minute break
// falls inside the paid eight hours (Art 109), so it is not deducted. Hours default to end − start
// (across midnight: 16:00–00:30 is 8.5h) less the break, and can be overridden
// only by unticking "auto" on purpose.
//
// SHIFTS ALREADY ON THE ROTA CARRY THEIR OWN TIMES, copied when they were
// written — the grid chips show those, not the type's. Changing a type's times
// therefore changes nothing already rostered unless those shifts are moved as
// well, which is offered: from today (VN date), and only rows whose times still
// equal the OLD type times, so a shift somebody deliberately gave other times
// (Miss Ni's 08:00 office) is left alone. Exactly what db/rota_open_two.sql did.
//
// That move is ONE BULK DIRECT UPDATE on rota_shifts under admin RLS, not
// ops_update_shift per row. Deliberate: every ops_update_shift emits a
// shift:updated event, and notify_from_event turns each into a notification the
// ops gateway emails straight away — moving 52 Open shifts would send staff 52
// emails about a change of hours. A bulk update logs no activity events, which
// is also how the SQL files that did this before behaved.
// ═══════════════════════════════════════════════════════════════════════════

const FAMILY = "'Google Sans Code', monospace"
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

type T = (en: string, vi: string) => string
type Toast = (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '')
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }
const sortDays = (ds: number[]) => [...new Set(ds)].sort((a, b) => a - b)

/** Paid hours from start, end and break — handling a finish after midnight.
 *  Office 10:00–16:00 less 60 min = 5.0 · Open 14:00–22:30 = 8.5 · Close 16:00–00:30 = 8.5 */
export function paidHours(start: string, end: string, breakMinutes: number): number | null {
  if (!start || !end || start === end) return null
  const span = (toMin(end) - toMin(start) + 1440) % 1440
  return Math.round(((span - breakMinutes) / 60) * 100) / 100
}

export default function ShiftTypeEditor({ types, today, overHoursIf, t, showToast, onSaved }: {
  types: RotaShiftType[]
  /** VN date — shifts from this day on are "future". */
  today: string
  /** Who on the week on screen would go over their weekly hours if this type paid newHours. */
  overHoursIf: (typeName: string, newHours: number) => string[]
  t: T
  showToast: Toast
  onSaved: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...metaText, opacity: 0.7, lineHeight: 1.6, marginBottom: 6 }}>
        {t('Times, unpaid break and the days each shift runs. Paid hours follow the times unless "auto" is unticked. Shifts already on the rota keep their own times — tick the box to move the future ones too.',
           'Giờ, giờ nghỉ không lương và các ngày mỗi ca chạy. Giờ tính lương theo giờ ca trừ khi bỏ chọn "tự động". Các ca đã xếp giữ giờ riêng — đánh dấu ô để dời cả các ca sắp tới.')}
      </div>
      {types.map(ty => (
        <TypeRow key={`${ty.name}:${ty.start_time}:${ty.end_time}:${ty.break_minutes}:${ty.hours}:${(ty.weekdays ?? []).join(',')}`}
          ty={ty} today={today} overHoursIf={overHoursIf} t={t} showToast={showToast} onSaved={onSaved} />
      ))}
      {types.length === 0 && <div style={{ ...metaText, opacity: 0.6 }}>{t('Add a shift name first.', 'Thêm tên ca trước.')}</div>}
    </div>
  )
}

function TypeRow({ ty, today, overHoursIf, t, showToast, onSaved }: {
  ty: RotaShiftType; today: string
  overHoursIf: (typeName: string, newHours: number) => string[]
  t: T; showToast: Toast; onSaved: () => void
}) {
  const supabase = createBrowserSupabaseClient()
  const savedStart = hhmm(ty.start_time), savedEnd = hhmm(ty.end_time)
  const savedBreak = Number(ty.break_minutes ?? 0)
  const savedHours = ty.hours != null ? Number(ty.hours) : null
  const savedDays = sortDays(ty.weekdays ?? [])
  const savedComputed = paidHours(savedStart, savedEnd, savedBreak)
  // "Auto" if what is stored is what the times say, to the cent of an hour.
  const savedAuto = savedComputed != null && (savedHours == null || Math.abs(savedHours - savedComputed) < 0.005)

  const [start, setStart] = useState(savedStart)
  const [end, setEnd] = useState(savedEnd)
  const [brk, setBrk] = useState(String(savedBreak))
  const [auto, setAuto] = useState(savedAuto)
  const [manual, setManual] = useState(savedHours != null ? String(savedHours) : '')
  const [days, setDays] = useState<number[]>(savedDays)
  const [move, setMove] = useState(true)
  const [futureCount, setFutureCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const dayName = (n: number) => t(DAY_EN[n], DAY_VI[n])

  const brkNum = Number(brk)
  const computed = paidHours(start, end, Number.isFinite(brkNum) ? brkNum : 0)
  const canAuto = computed != null
  const effAuto = auto && canAuto

  // ── Validation (mirrors the columns: hours numeric(4,2), break int not null,
  //    weekdays null-or-non-empty per rota_shift_types_weekdays_valid) ──
  const errors: string[] = []
  if ((start === '') !== (end === '')) errors.push(t('Give both a start and an end, or neither.', 'Nhập cả giờ bắt đầu và kết thúc, hoặc để trống cả hai.'))
  if (start && end && start === end) errors.push(t('Start and end are the same time.', 'Giờ bắt đầu và kết thúc trùng nhau.'))
  if (!Number.isInteger(brkNum) || brkNum < 0 || brkNum > 600) errors.push(t('Break is whole minutes, 0 to 600.', 'Giờ nghỉ là số phút nguyên, từ 0 đến 600.'))
  let hoursValue: number | null = null
  if (effAuto) {
    if (computed! <= 0) errors.push(t('The break is as long as the shift.', 'Giờ nghỉ dài bằng cả ca.'))
    else hoursValue = computed
  } else if (manual.trim() !== '') {
    const h = Number(manual)
    if (!Number.isFinite(h) || h < 0 || h > 24) errors.push(t('Hours must be between 0 and 24.', 'Số giờ phải từ 0 đến 24.'))
    else if (Math.round(h * 100) / 100 !== h) errors.push(t('Hours take at most two decimal places.', 'Số giờ tối đa hai chữ số thập phân.'))
    else hoursValue = h
  }
  // No days ticked, or all seven, is stored as NULL: "every day".
  const daysValue = days.length === 0 || days.length === 7 ? null : sortDays(days)

  const timesChanged = start !== savedStart || end !== savedEnd
  const dirty = timesChanged || brkNum !== savedBreak || hoursValue !== savedHours
    || (daysValue ?? []).join(',') !== savedDays.join(',')
  // Only shifts still at the old times can be said to be "at the type's times".
  const canMove = timesChanged && !!ty.start_time && !!ty.end_time && !!start && !!end

  // Count the future shifts that would move, before anything is written.
  useEffect(() => {
    if (!canMove) { setFutureCount(null); return }
    let live = true
    supabase.from('rota_shifts').select('id', { count: 'exact', head: true })
      .eq('shift_name', ty.name).gte('shift_date', today)
      .eq('start_time', ty.start_time!).eq('end_time', ty.end_time!)
      .then(({ count, error }) => {
        if (!live) return
        if (error) { showToast(`${t('Could not count future shifts', 'Không đếm được các ca sắp tới')}: ${error.message}`, 'error'); setFutureCount(null) }
        else setFutureCount(count ?? 0)
      })
    return () => { live = false }
  }, [canMove, ty.name, ty.start_time, ty.end_time, today])  // eslint-disable-line react-hooks/exhaustive-deps

  const over = hoursValue != null && hoursValue !== savedHours ? overHoursIf(ty.name, hoursValue) : []

  const reset = () => {
    setStart(savedStart); setEnd(savedEnd); setBrk(String(savedBreak)); setAuto(savedAuto)
    setManual(savedHours != null ? String(savedHours) : ''); setDays(savedDays)
  }

  const save = async () => {
    if (errors.length) { showToast(errors[0], 'error'); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('rota_shift_types').update({
        start_time: start || null, end_time: end || null,
        break_minutes: brkNum, hours: hoursValue, weekdays: daysValue,
      }).eq('name', ty.name)
      if (error) { showToast(`${ty.name} ${t('not saved', 'chưa lưu')}: ${error.message}`, 'error'); onSaved(); return }

      let moved = 0
      if (canMove && move && (futureCount ?? 0) > 0) {
        // Bulk direct update — see the header for why not ops_update_shift.
        // Not in one transaction with the type update above: if this half
        // fails, the type is saved and the shifts are not, and the toast says so.
        const res = await supabase.from('rota_shifts')
          .update({ start_time: start, end_time: end, updated_at: new Date().toISOString() })
          .eq('shift_name', ty.name).gte('shift_date', today)
          .eq('start_time', ty.start_time!).eq('end_time', ty.end_time!)
          .select('id')
        if (res.error) {
          showToast(`${ty.name} ${t('saved, but future shifts were not moved', 'đã lưu, nhưng chưa dời các ca sắp tới')}: ${res.error.message}`, 'error')
          onSaved(); return
        }
        moved = res.data?.length ?? 0
      }
      showToast(moved
        ? `${ty.name} ${t('saved ·', 'đã lưu ·')} ${moved} ${t('future shifts moved to', 'ca sắp tới đã dời sang')} ${start}–${end}.`
        : `${ty.name} ${t('saved.', 'đã lưu.')}`, 'success')
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <div style={typeBlock}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12.5, minWidth: 90 }}>{ty.name}</span>
        <span style={{ ...metaText, opacity: 0.6 }}>
          {savedStart ? `${savedStart}–${savedEnd}` : t('no times', 'chưa có giờ')} · {savedHours != null ? `${savedHours}h` : '—'}
        </span>
        {dirty && <span style={{ ...metaText, color: '#D4B85A' }}>· {t('unsaved', 'chưa lưu')}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={busy || !dirty}
            style={{ ...tinyBtn, ...(dirty ? { color: '#E5D4C2', borderColor: '#D4B85A' } : { opacity: 0.45 }) }}>
            {busy ? t('Saving…', 'Đang lưu…') : t('Save', 'Lưu')}
          </button>
          {dirty && <button onClick={reset} disabled={busy} style={tinyBtn}>{t('Reset', 'Hoàn tác')}</button>}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label>
          <div style={fieldLabel}>{t('Start', 'Bắt đầu')}</div>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} style={{ ...ruleSelect, colorScheme: 'dark' }} />
        </label>
        <label>
          <div style={fieldLabel}>{t('End', 'Kết thúc')}</div>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={{ ...ruleSelect, colorScheme: 'dark' }} />
        </label>
        <label>
          <div style={fieldLabel}>{t('Break (min)', 'Nghỉ (phút)')}</div>
          <input type="number" inputMode="numeric" min={0} max={600} step={5} value={brk}
            onChange={e => setBrk(e.target.value)} style={{ ...covInput, width: 56 }} />
        </label>
        <div>
          <div style={fieldLabel}>{t('Paid hours', 'Giờ tính lương')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {effAuto
              ? <span style={{ ...covInput, width: 56, display: 'inline-block', opacity: 0.85 }}>{computed}</span>
              : <input type="number" inputMode="decimal" min={0} max={24} step={0.25} value={manual} placeholder="—"
                  onChange={e => setManual(e.target.value)} style={{ ...covInput, width: 56 }} />}
            <label style={{ ...metaText, display: 'inline-flex', gap: 4, alignItems: 'center', cursor: canAuto ? 'pointer' : 'default', opacity: canAuto ? 1 : 0.45 }}
              title={t('Auto = end − start, less the break', 'Tự động = kết thúc − bắt đầu, trừ giờ nghỉ')}>
              <input type="checkbox" checked={effAuto} disabled={!canAuto}
                onChange={e => { setAuto(e.target.checked); if (!e.target.checked && computed != null) setManual(String(computed)) }} />
              {t('auto', 'tự động')}
            </label>
            {!effAuto && computed != null && <span style={{ ...metaText, opacity: 0.6 }}>({t('times say', 'theo giờ')} {computed}h)</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={fieldLabel}>{t('Runs on', 'Chạy vào')} <span style={{ textTransform: 'none', opacity: 0.7 }}>· {daysValue ? daysValue.length : 7}/7{daysValue ? '' : ` — ${t('every day', 'mỗi ngày')}`}</span></div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {WEEK_ORDER.map(n => {
            // With nothing ticked the shift runs every day, so every day reads as on.
            const on = days.length === 0 || days.includes(n)
            const toggle = () => {
              const base = days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : days
              setDays(base.includes(n) ? base.filter(x => x !== n) : sortDays([...base, n]))
            }
            return (
              <button key={n} type="button" onClick={toggle}
                style={{ ...fnToggle, minWidth: 40, ...(on ? { background: '#D4B85A', color: '#052E20', borderColor: '#D4B85A' } : null) }}>
                {dayName(n)}
              </button>
            )
          })}
        </div>
      </div>

      {canMove && (
        <label style={{ ...metaText, display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, cursor: 'pointer', color: '#E5D4C2' }}>
          <input type="checkbox" checked={move} onChange={e => setMove(e.target.checked)} />
          {t('Also move future shifts of this type that still have the old times', 'Dời cả các ca sắp tới của loại này vẫn còn giờ cũ')} ({savedStart}–{savedEnd} → {start}–{end})
          <span style={{ opacity: 0.75 }}>· {futureCount == null ? t('counting…', 'đang đếm…') : `${futureCount} ${t('from today', 'từ hôm nay')}`}</span>
        </label>
      )}
      {over.length > 0 && (
        <div style={{ ...metaText, color: '#E8A6A6', marginTop: 8 }}>
          ⚠ {t('This week, that puts over their hours:', 'Tuần này, thay đổi này làm vượt giờ:')} {over.join(' · ')}
        </div>
      )}
      {errors.map((e, i) => <div key={i} style={{ ...metaText, color: '#E8A6A6', marginTop: 6 }}>✗ {e}</div>)}
    </div>
  )
}

// Same values as the rota page's styles — a Next page file cannot export them.
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const fieldLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }
const fnToggle: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.2)', borderRadius: 12, padding: '3px 11px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const covInput: React.CSSProperties = { width: 46, background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 5, padding: '5px 6px', fontFamily: FAMILY, fontSize: 12, textAlign: 'center', outline: 'none' }
const ruleSelect: React.CSSProperties = { background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 5, padding: '5px 8px', fontFamily: FAMILY, fontSize: 11, outline: 'none' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4, padding: '5px 10px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const typeBlock: React.CSSProperties = { padding: '10px 0 12px', borderBottom: '1px solid rgba(229,212,194,0.08)' }
