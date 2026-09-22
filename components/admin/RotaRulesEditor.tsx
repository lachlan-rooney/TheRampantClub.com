'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { TeamMember } from '@/lib/ops/types'

// ═══════════════════════════════════════════════════════════════════════════
// ROTA RULES PER PERSON — the columns lib/rota/policy.ts reads, editable here.
// ───────────────────────────────────────────────────────────────────────────
// 2026-09-15: every change to these in the week before this existed was an SQL
// file. A rule staff cannot change from the portal is a rule that gets worked
// round on paper instead, and the rota check then judges a week against
// arrangements nobody holds any more.
//
// 2026-09-22 — THREE CONTROLS REMOVED with the new rota rules: "Office day",
// "Always works" and "Day off together with". The checker no longer reads any
// of them (floor staff have no office day, supervisors rotate the close, and
// the shared fortnightly day off is not part of the new rules), so a control
// for them would let somebody set a rule that silently does nothing. Their
// columns were dropped the same day, with the rule that no one could have
// both Saturday and Sunday as fixed days off (the old "never both weekend
// days"): supabase/migrations/20260922100000_rota_retire_old_rules.sql.
//
// "Hours / week" is the rota's weekly hours: 40 under the new rules. It is
// never labelled as anything the employment agreements say — they state no
// hours at all ("Theo yêu cầu của công việc").
//
// Each person is a draft with one Save, not a write per keystroke: the standing
// shift is four columns that are only valid together, and saving them one at a
// time would be refused by the database on the first.
//
// ⚠ NOT HERE, ON PURPOSE (2026-09-15):
//   • is_shift_supervisor — set by hand, not from here. Bình's promotion was
//     set on 2026-09-22 when the owner confirmed Nhi and Bình as supervisors;
//     a toggle here would still let anyone who opens this panel promote
//     somebody. The column drives the supervisor-every-night rule.
// That column is never written by this file, so saving a row cannot touch it.
// ═══════════════════════════════════════════════════════════════════════════

const FAMILY = "'Google Sans Code', monospace"

// Shown Monday → Sunday, the rota week; stored 0 = Sunday … 6 = Saturday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

type T = (en: string, vi: string) => string
type Toast = (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void

interface Draft {
  weeklyHours: string
  fixedOff: number[]
  standingShift: string
  standingStart: string      // HH:MM
  standingEnd: string
  standingDays: number[]
}

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '')
const sortDays = (ds: number[]) => [...new Set(ds)].sort((a, b) => a - b)
const sameDays = (a: number[], b: number[]) => sortDays(a).join(',') === sortDays(b).join(',')

function fromMember(m: TeamMember): Draft {
  return {
    weeklyHours: m.weekly_hours != null ? String(Number(m.weekly_hours)) : '',
    fixedOff: sortDays(m.fixed_days_off ?? []),
    standingShift: m.standing_shift ?? '',
    standingStart: hhmm(m.standing_start),
    standingEnd: hhmm(m.standing_end),
    standingDays: sortDays(m.standing_weekdays ?? []),
  }
}

export default function RotaRulesEditor({ rotaTeam, team, typeNames, hoursThisWeek, t, showToast, onSaved }: {
  rotaTeam: TeamMember[]
  /** The whole active team — a partner who has since come off the rota still resolves to a name. */
  team: TeamMember[]
  typeNames: string[]
  /** Hours rostered on the week on screen, from the page's own hoursFor. */
  hoursThisWeek: (id: string) => number
  t: T
  showToast: Toast
  onSaved: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...metaText, opacity: 0.7, lineHeight: 1.6 }}>
        {t('The arrangements the rota check reads. Change a field, then Save that person. The database checks every value again, and says why if it refuses.',
           'Các thỏa thuận mà phần kiểm tra lịch đọc. Sửa một mục, rồi bấm Lưu cho người đó. Cơ sở dữ liệu kiểm tra lại mọi giá trị và báo lý do nếu từ chối.')}
      </div>
      {rotaTeam.map(m => (
        // Keyed on the saved values too: after a save reloads the team, the row
        // remounts from what the database now holds, while other rows' unsaved
        // drafts (whose saved values did not change) are left alone.
        <PersonRow key={`${m.id}:${JSON.stringify(fromMember(m))}`}
          m={m} typeNames={typeNames}
          hoursThisWeek={hoursThisWeek(m.id)} t={t} showToast={showToast} onSaved={onSaved} />
      ))}
      {rotaTeam.length === 0 && <div style={{ ...metaText, opacity: 0.6 }}>{t('Nobody is on the rota.', 'Không ai trong lịch.')}</div>}
    </div>
  )
}

function PersonRow({ m, typeNames, hoursThisWeek, t, showToast, onSaved }: {
  m: TeamMember; typeNames: string[]
  hoursThisWeek: number; t: T; showToast: Toast; onSaved: () => void
}) {
  const supabase = createBrowserSupabaseClient()
  const saved = fromMember(m)
  const [d, setD] = useState<Draft>(saved)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Draft>) => setD(cur => ({ ...cur, ...patch }))
  const dayName = (n: number) => t(DAY_EN[n], DAY_VI[n])


  const standingSaved = saved.standingShift !== '' || saved.standingStart !== '' || saved.standingEnd !== '' || saved.standingDays.length > 0
  const standingChanged = d.standingShift !== saved.standingShift || d.standingStart !== saved.standingStart
    || d.standingEnd !== saved.standingEnd || !sameDays(d.standingDays, saved.standingDays)
  const rowChanged = d.weeklyHours !== saved.weeklyHours
    || !sameDays(d.fixedOff, saved.fixedOff) || standingChanged
  const dirty = rowChanged

  // ── Validation — the same rules as the database checks, said in words ──
  const errors: string[] = []
  let hoursValue: number | null = null
  if (d.weeklyHours.trim() !== '') {
    const h = Number(d.weeklyHours)
    if (!Number.isFinite(h) || h <= 0 || h > 60) errors.push(t('Hours must be more than 0 and at most 60, or empty.', 'Số giờ phải lớn hơn 0 và tối đa 60, hoặc để trống.'))
    else if (Math.round(h * 10) / 10 !== h) errors.push(t('Hours take one decimal place (e.g. 47.5).', 'Số giờ chỉ một chữ số thập phân (vd. 47.5).'))
    else hoursValue = h
  }
  // team_members_standing_complete: all four, or none.
  const standingAny = d.standingShift !== '' || d.standingStart !== '' || d.standingEnd !== '' || d.standingDays.length > 0
  const standingAll = d.standingShift !== '' && d.standingStart !== '' && d.standingEnd !== '' && d.standingDays.length > 0
  if (standingAny && !standingAll) errors.push(t('A standing shift needs a shift, a start, an end and at least one day — or use Remove.', 'Ca cố định cần tên ca, giờ bắt đầu, giờ kết thúc và ít nhất một ngày — hoặc bấm Xóa.'))
  if (standingAll && d.standingStart === d.standingEnd) errors.push(t('Standing shift starts and ends at the same time.', 'Ca cố định bắt đầu và kết thúc cùng giờ.'))

  // Notes — true, worth knowing, and not a reason to refuse the save.
  const notes: string[] = []
  if (hoursValue != null && hoursThisWeek > hoursValue)
    notes.push(`${t('Rostered this week', 'Đã xếp tuần này')} ${hoursThisWeek.toFixed(2)}h — ${t('over these hours.', 'vượt số giờ này.')}`)


  const save = async () => {
    if (errors.length) { showToast(errors[0], 'error'); return }
    setBusy(true)
    try {
      if (rowChanged) {
        // Only what changed, so two people editing two different fields of the
        // same person do not overwrite each other. The standing shift always
        // travels as all four columns — the check reads them as one thing.
        const patch: Record<string, unknown> = {}
        if (d.weeklyHours !== saved.weeklyHours) patch.weekly_hours = hoursValue
        // Empty stores NULL ("rotates"), the way the SQL files have always written it.
        if (!sameDays(d.fixedOff, saved.fixedOff)) patch.fixed_days_off = d.fixedOff.length ? sortDays(d.fixedOff) : null
        if (standingChanged) Object.assign(patch, standingAll
          ? { standing_shift: d.standingShift, standing_start: d.standingStart, standing_end: d.standingEnd, standing_weekdays: sortDays(d.standingDays) }
          : { standing_shift: null, standing_start: null, standing_end: null, standing_weekdays: null })
        const { error } = await supabase.from('team_members').update(patch).eq('id', m.id)
        if (error) { showToast(`${m.display_name} ${t('not saved', 'chưa lưu')}: ${error.message}`, 'error'); onSaved(); return }
      }
      showToast(`${m.display_name} ${t('saved.', 'đã lưu.')}`, 'success')
      onSaved()
    } finally { setBusy(false) }
  }

  const standingOptions = typeNames

  return (
    <div style={personBlock}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12.5 }}>{m.display_name}</span>
        {m.role_title && <span style={{ ...metaText, opacity: 0.6 }}>{m.role_title}</span>}
        <span style={{ ...metaText, opacity: 0.6 }}>· {hoursThisWeek.toFixed(2)}h {t('this week', 'tuần này')}</span>
        {dirty && <span style={{ ...metaText, color: '#D4B85A' }}>· {t('unsaved', 'chưa lưu')}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={save} disabled={busy || !dirty}
            style={{ ...tinyBtn, ...(dirty ? { color: '#E5D4C2', borderColor: '#D4B85A' } : { opacity: 0.45 }) }}>
            {busy ? t('Saving…', 'Đang lưu…') : t('Save', 'Lưu')}
          </button>
          {dirty && <button onClick={() => setD(saved)} disabled={busy} style={tinyBtn}>{t('Reset', 'Hoàn tác')}</button>}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label>
          <div style={fieldLabel}>{t('Hours / week', 'Giờ / tuần')}</div>
          <input type="number" inputMode="decimal" min={0} max={60} step={0.5} value={d.weeklyHours}
            placeholder="—" onChange={e => set({ weeklyHours: e.target.value })}
            style={{ ...covInput, width: 64 }} />
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={fieldLabel}>{t('Fixed days off', 'Ngày nghỉ cố định')} <span style={{ textTransform: 'none', opacity: 0.7 }}>{d.fixedOff.length ? '' : `· ${t('none — days off rotate', 'không — ngày nghỉ luân phiên')}`}</span></div>
        <DayToggles days={d.fixedOff} onChange={v => set({ fixedOff: v })} dayName={dayName} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={fieldLabel}>{t('Standing shift (every week)', 'Ca cố định (hằng tuần)')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={d.standingShift} onChange={e => set({ standingShift: e.target.value })} style={ruleSelect}>
            <option value="" style={opt}>{t('— shift —', '— ca —')}</option>
            {standingOptions.map(n => <option key={n} value={n} style={opt}>{n}</option>)}
            {d.standingShift && !standingOptions.includes(d.standingShift) && <option value={d.standingShift} style={opt}>{d.standingShift} ({t('not a current shift', 'không còn là ca')})</option>}
          </select>
          <input type="time" value={d.standingStart} onChange={e => set({ standingStart: e.target.value })} title={t('Start', 'Bắt đầu')} style={{ ...ruleSelect, colorScheme: 'dark' }} />
          <span style={{ ...metaText, opacity: 0.6 }}>–</span>
          <input type="time" value={d.standingEnd} onChange={e => set({ standingEnd: e.target.value })} title={t('End', 'Kết thúc')} style={{ ...ruleSelect, colorScheme: 'dark' }} />
          {(standingAny || standingSaved) && (
            <button onClick={() => set({ standingShift: '', standingStart: '', standingEnd: '', standingDays: [] })} disabled={busy}
              style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>
              {t('Remove standing shift', 'Xóa ca cố định')}
            </button>
          )}
        </div>
        <div style={{ marginTop: 6 }}>
          <DayToggles days={d.standingDays} onChange={v => set({ standingDays: v })} dayName={dayName} />
        </div>
      </div>

      {errors.map((e, i) => <div key={`e${i}`} style={{ ...metaText, color: '#E8A6A6', marginTop: 6 }}>✗ {e}</div>)}
      {notes.map((n, i) => <div key={`n${i}`} style={{ ...metaText, opacity: 0.75, marginTop: 6 }}>· {n}</div>)}
    </div>
  )
}

function DayToggles({ days, onChange, dayName }: { days: number[]; onChange: (v: number[]) => void; dayName: (n: number) => string }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {WEEK_ORDER.map(n => {
        const on = days.includes(n)
        return (
          <button key={n} type="button" onClick={() => onChange(on ? days.filter(x => x !== n) : sortDays([...days, n]))}
            style={{ ...fnToggle, minWidth: 40, ...(on ? { background: '#D4B85A', color: '#052E20', borderColor: '#D4B85A' } : null) }}>
            {dayName(n)}
          </button>
        )
      })}
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
const opt: React.CSSProperties = { background: '#052E20' }
const personBlock: React.CSSProperties = { padding: '10px 0 12px', borderBottom: '1px solid rgba(229,212,194,0.08)' }
