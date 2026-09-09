'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import type { Tracker } from '@/lib/reports/tracker'

// ═══════════════════════════════════════════════════════════════════════════
// WHERE WE ARE AGAINST THE MONTH — cash in, weekly, rolling to a close.
// ───────────────────────────────────────────────────────────────────────────
// TWO REFERENCE LINES, NOT ONE. The target is what we are aiming at; BREAKEVEN
// is what the month actually costs. They are different numbers, and a tracker
// showing green at target while the month loses money is worse than no tracker.
//
// "CASH IN" on the face of it, never "revenue" — top-ups are prepayment and
// dues land a year at once.
const usd = (n: number) => '$' + Math.round(n).toLocaleString()
const vnd = (n: number) => (n / 1e6).toFixed(1) + 'm'

export default function WeeklyTracker() {
  const { t } = useLang()
  const [d, setD] = useState<Tracker | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [edit, setEdit] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/tracker', { cache: 'no-store' }).then(r => r.json())
      .then(j => setD(j.tracker ?? null)).catch(() => {})
  }, [])
  useEffect(load, [load])

  const saveWhisky = async (week: string, amount: string) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/tracker', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start: week, amount_vnd: Number(amount) * 1e6 }) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || 'Could not save.')
    else load()
    setBusy(false)
  }
  const saveSettings = async (p: Record<string, unknown>) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/tracker', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || 'Could not save.')
    else { setEdit(false); load() }
    setBusy(false)
  }

  if (!d) return null
  const ahead = d.mtd_cash_usd - d.mtd_target_usd
  const close = d.projected_close

  return (
    <div style={wrap}>
      <div style={h1}>{d.month_label}</div>

      {/* ── MEMBERS AND USAGE, FIRST AND DELIBERATELY ─────────────────────────
          This half is the half that can be acted on THIS WEEK. Eight members
          unseen in thirty days is a list of calls to make; the deficit is real
          and cannot be moved by Friday. A report that opens on the actionable
          half gets opened weekly. One that opens on a number nobody can shift
          gets opened once. */}
      <div style={{ ...sub, marginTop: 4 }}>
        {t('The half you can act on this week.', 'Phần bạn có thể xử lý ngay trong tuần này.')}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 0' }}>
        {/* BOOKINGS, NOT CARD TAPS. A tap is a habit a member may not have; a
            booking is an intention they made. And HONORARY members are counted
            separately below — they are complimentary, so putting them in a
            renewal-risk figure measures the wrong people. */}
        <Stat label={t('Paying members not booked in 30 days', 'Hội viên trả phí chưa đặt chỗ 30 ngày')}
              value={`${d.dormancy.paying_no_booking_30}/${d.dormancy.paying_members}`}
              note={`${d.dormancy.paying_never_booked} ${t('never booked', 'chưa từng đặt')} · ${d.dormancy.paying_no_booking_60} ${t('past 60', 'quá 60 ngày')}`}
              tone={d.dormancy.paying_no_booking_30 > d.dormancy.paying_members / 2 ? 'bad' : undefined} />
        <Stat label={t('Distinct members', 'Thành viên khác nhau')} value={String(d.usage.distinct_members)}
              note={t('ten visits from three is a different club', 'mười lượt từ ba người là câu lạc bộ khác')} />
        <Stat label={t('Visits', 'Lượt ghé')} value={String(d.usage.visits)} note={d.month_label} />
        <Stat label={t('Credit used', 'Tín dụng đã dùng')} value={vnd(d.usage.credit_consumed_vnd)}
              note={t('usage — not cash in', 'mức sử dụng — không phải tiền vào')} />
      </div>
      {/* ── WHAT THIS DOES NOT MEASURE ────────────────────────────────────────
          Deliberately below the numbers and visibly apart from them, so a soft
          figure is never read as a measured one and quoted back later. */}
      <div style={{ ...sub, marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(229,212,194,0.14)' }}>
        <span style={{ color: '#D4B85A' }}>{t('Not measured:', 'Chưa đo được:')}</span>{' '}
        {t(`there is no dependable time-in-club figure. Card taps are optional and departure is rarely recorded; booking end times are filled on ${d.attendance.end_time_recorded} of ${d.attendance.bookings_in_month} bookings this month.`,
           `chưa có số liệu đáng tin về thời gian ở câu lạc bộ. Quẹt thẻ là tuỳ chọn và giờ ra về hiếm khi được ghi; giờ kết thúc đặt chỗ chỉ có ở ${d.attendance.end_time_recorded}/${d.attendance.bookings_in_month} lượt đặt trong tháng.`)}
        {d.usage.staff_recorded_median_min != null &&
          ` ${t('A staff-recorded median of', 'Trung vị do nhân viên ghi là')} ${d.usage.staff_recorded_median_min} ${t('min exists on', 'phút, trên')} ${d.usage.staff_recorded_coverage_pct}% ${t('of visits — an account, not a measurement.', 'lượt ghé — là ghi chép, không phải phép đo.')}`}
        {' '}
        {d.attendance.arrival_recorded === 0 && d.attendance.bookings_in_month > 0 &&
          t(`Booked-versus-attended cannot be shown either: arrival is recorded on 0 of ${d.attendance.bookings_in_month} bookings, so a no-show and an attendance look identical.`,
            `Cũng chưa thể so sánh đặt chỗ với thực đến: không lượt đặt nào trong ${d.attendance.bookings_in_month} có ghi nhận đến, nên vắng mặt và có mặt là như nhau.`)}
        {d.attendance.walk_in_visits > 0 &&
          ` ${d.attendance.walk_in_visits} ${t('recorded visit(s) this month had no booking.', 'lượt ghé trong tháng không có đặt chỗ.')}`}
      </div>

      {/* ── CASH IN ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 26 }}>
        <div style={h2}>{t('Cash in', 'Tiền vào')}</div>
        <button onClick={() => setEdit(e => !e)} style={ghost}>{t('Cost base', 'Cơ sở chi phí')}</button>
      </div>
      <div style={sub}>
        {t('Cash received against cash spent. Top-ups are prepayment and dues land a year at once — this is not revenue.',
           'Tiền nhận được so với tiền chi ra. Nạp thẻ là trả trước và phí niên liễm vào một lần cả năm — đây không phải doanh thu.')}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 6px' }}>
        <Stat label={t('Month to date', 'Từ đầu tháng')} value={usd(d.mtd_cash_usd)}
              note={`${ahead >= 0 ? '+' : ''}${usd(ahead)} ${t('vs pro-rata', 'so với tỷ lệ')}`} tone={ahead >= 0 ? 'good' : 'bad'} />
        <Stat label={t('Target', 'Mục tiêu')} value={usd(d.target_usd)} note={t('monthly', 'hàng tháng')} />
        <Stat label={t('Breakeven', 'Hòa vốn')} value={usd(d.cost_base_usd)}
              note={t('what the month costs', 'chi phí thực của tháng')} tone="warn" />
        <Stat label={t('Projected close', 'Dự kiến chốt tháng')} value={usd(close.surplus_usd)}
              note={close.surplus_usd >= 0 ? t('surplus', 'thặng dư') : t('deficit', 'thâm hụt')}
              tone={close.surplus_usd >= 0 ? 'good' : 'bad'} />
      </div>

      {edit && (
        <SettingsPanel d={d} busy={busy} onSave={saveSettings} onCancel={() => setEdit(false)} t={t} />
      )}

      <table style={table}>
        <thead>
          <tr>
            {[t('Week', 'Tuần'), t('Cash in', 'Tiền vào'), t('Target', 'Mục tiêu'), t('Joined', 'Gia nhập'),
              t('Whisky', 'Whisky'), t('Visits', 'Lượt ghé'), t('Members', 'Thành viên')].map(hd =>
              <th key={hd} style={th}>{hd}</th>)}
          </tr>
        </thead>
        <tbody>
          {d.weeks.map(w => (
            <tr key={w.week_start}>
              <td style={td}>{w.week_start.slice(5)}–{w.week_end.slice(5)}</td>
              <td style={{ ...td, color: '#E5D4C2' }}>{usd(w.cash_in_usd)}</td>
              <td style={{ ...td, opacity: .6 }}>{usd(w.target_usd)}</td>
              <td style={td}>
                {/* HOW MANY AND AT WHAT TIER, beside the cash — four Legacy and
                    four Pioneer are very different months with similar shapes.
                    The amount is what was COLLECTED, so a discount shows. */}
                {w.joins.length === 0 ? <span style={{ opacity: .35 }}>—</span>
                  : w.joins.map((j, i) => <span key={i} style={pill}>{j.tier} {vnd(j.amount_vnd)}</span>)}
              </td>
              <td style={td}>
                {w.whisky_vnd === null
                  ? <WhiskyEntry week={w.whisky_week_key} busy={busy} onSave={saveWhisky} t={t} />
                  : <span style={{ color: '#E5D4C2' }}>{vnd(w.whisky_vnd)}</span>}
              </td>
              <td style={td}>{w.visits || <span style={{ opacity: .35 }}>—</span>}</td>
              <td style={td}>{w.distinct_members || <span style={{ opacity: .35 }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {d.whisky.weeks_missing.length > 0 && (
        <div style={warnBox}>
          {t(`Whisky sales not entered for ${d.whisky.weeks_missing.length} week(s) this month`,
             `Chưa nhập doanh số whisky cho ${d.whisky.weeks_missing.length} tuần trong tháng`)}
          {d.whisky.days_since_entry != null && ` · ${t('last entry', 'lần nhập gần nhất')} ${d.whisky.days_since_entry} ${t('days ago', 'ngày trước')}`}
          {'. '}
          {t('A missing week is missing, not zero.', 'Tuần chưa nhập là thiếu dữ liệu, không phải bằng không.')}
        </div>
      )}

      {err && <div style={{ ...warnBox, color: '#C27070' }}>{err}</div>}
    </div>
  )
}

function WhiskyEntry({ week, busy, onSave, t }: {
  week: string; busy: boolean; onSave: (w: string, a: string) => void; t: (a: string, b: string) => string
}) {
  const [v, setV] = useState('')
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={t('not entered', 'chưa nhập')}
             inputMode="decimal" style={miniInput} />
      <span style={{ fontSize: 9, opacity: .5 }}>m</span>
      {v && <button disabled={busy} onClick={() => onSave(week, v)} style={miniBtn}>{t('Save', 'Lưu')}</button>}
    </span>
  )
}

function SettingsPanel({ d, busy, onSave, onCancel, t }: {
  d: Tracker; busy: boolean; onSave: (p: Record<string, unknown>) => void; onCancel: () => void
  t: (a: string, b: string) => string
}) {
  const [target, setTarget] = useState(String(d.target_usd))
  const [cost, setCost] = useState(String(d.cost_base_usd))
  const [rate, setRate] = useState(String(d.rate))
  const [note, setNote] = useState(d.cost_base_note ?? '')
  return (
    <div style={panel}>
      <div style={{ ...sub, marginBottom: 10 }}>
        {t('Entered every few months, not every week. Breakeven is the cost base, so it moves when you change it. The rate is stored so past months do not shift.',
           'Nhập vài tháng một lần, không phải hàng tuần. Hòa vốn lấy từ cơ sở chi phí nên sẽ đổi theo. Tỷ giá được lưu lại để các tháng trước không thay đổi.')}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Field label={t('Monthly target US$', 'Mục tiêu tháng US$')} v={target} set={setTarget} />
        <Field label={t('Monthly cost base US$', 'Cơ sở chi phí tháng US$')} v={cost} set={setCost} />
        <Field label={t('VND per US$', 'VND mỗi US$')} v={rate} set={setRate} />
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} style={{ ...miniInput, width: '100%', marginTop: 8 }}
             placeholder={t('what the cost base covers', 'cơ sở chi phí gồm những gì')} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button disabled={busy} style={btn} onClick={() => onSave({
          monthly_target_usd: Number(target), monthly_cost_base_usd: Number(cost),
          usd_vnd_rate: Number(rate), cost_base_note: note,
        })}>{t('Save', 'Lưu')}</button>
        <button style={ghost} onClick={onCancel}>{t('Cancel', 'Huỷ')}</button>
      </div>
    </div>
  )
}

const Field = ({ label, v, set }: { label: string; v: string; set: (s: string) => void }) => (
  <div><div style={{ ...sub, marginBottom: 4 }}>{label}</div>
    <input value={v} onChange={e => set(e.target.value)} inputMode="numeric" style={miniInput} /></div>
)

const Stat = ({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'good' | 'bad' | 'warn' }) => (
  <div style={{ ...statBox, borderColor: tone === 'bad' ? 'rgba(194,112,112,.35)' : tone === 'good' ? 'rgba(122,176,122,.35)' : tone === 'warn' ? 'rgba(212,184,90,.35)' : 'rgba(229,212,194,0.10)' }}>
    <div style={{ ...sub, marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 21, color: tone === 'bad' ? '#C27070' : tone === 'good' ? '#7AB07A' : '#E5D4C2' }}>{value}</div>
    {note && <div style={{ ...sub, marginTop: 2, opacity: .6 }}>{note}</div>}
  </div>
)

const MONO = "'Google Sans Code', monospace"
const wrap: React.CSSProperties = { padding: '18px 20px', borderRadius: 12, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)', marginBottom: 22 }
const h1: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 17, color: '#E5D4C2' }
const h2: React.CSSProperties = { ...h1, fontSize: 14, margin: '22px 0 10px' }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', lineHeight: 1.7 }
const statBox: React.CSSProperties = { flex: 1, minWidth: 132, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(229,212,194,0.10)', background: 'rgba(5,46,32,0.35)' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 14 }
const th: React.CSSProperties = { ...sub, textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(229,212,194,0.12)', textTransform: 'uppercase', letterSpacing: '.06em' }
const td: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', padding: '8px', borderBottom: '1px solid rgba(229,212,194,0.06)' }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, background: 'rgba(212,184,90,.14)', color: '#E7C766', borderRadius: 999, padding: '2px 8px', marginRight: 4 }
const warnBox: React.CSSProperties = { ...sub, color: '#D4B85A', marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
const panel: React.CSSProperties = { marginTop: 12, padding: '14px 16px', borderRadius: 8, background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.12)' }
const miniInput: React.CSSProperties = { fontFamily: MONO, fontSize: 11, width: 92, padding: '5px 8px', borderRadius: 6, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const miniBtn: React.CSSProperties = { fontFamily: MONO, fontSize: 9, padding: '4px 8px', borderRadius: 5, border: 'none', background: '#D4B85A', color: '#052E20', cursor: 'pointer', fontWeight: 700 }
const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 11, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#D4B85A', color: '#052E20', fontWeight: 700, cursor: 'pointer' }
const ghost: React.CSSProperties = { fontFamily: MONO, fontSize: 10, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer' }
