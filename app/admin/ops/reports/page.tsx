'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { vnDateString } from '@/lib/datetime'
import { useLang } from '@/lib/admin-lang'

const FAMILY = "'Google Sans Code', monospace"

// Per-person rota aggregation — these rows ARE the table AND the CSV (parity).
type RotaRow = { member_id: string; display_name: string; timed_shifts: number; timed_hours: number; untimed_shifts: number; total_shifts: number }
type TypeRow = { shift_name: string; timed_shifts: number; timed_hours: number; untimed_shifts: number; total_shifts: number }
type BoardRow = { project_id: string; name: string; total: number; done: number; overdue: number; pct_complete: number }
type CoverRow = { shift_date: string; shift_name: string; start_time: string | null; end_time: string | null; member: string; team_members: { display_name: string } | null }

const fmtHours = (h: number) => (Number(h) % 1 === 0 ? String(Number(h)) : Number(h).toFixed(2))
const monthStart = () => vnDateString().slice(0, 8) + '01'

export default function OpsReports() {
  const { t } = useLang()
  const supabase = createBrowserSupabaseClient()

  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(vnDateString())
  const [rota, setRota] = useState<RotaRow[]>([])
  const [byType, setByType] = useState<TypeRow[]>([])
  const [cover, setCover] = useState<CoverRow[]>([])
  const [boards, setBoards] = useState<BoardRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadRota = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: t }, { data: c }] = await Promise.all([
      supabase.rpc('ops_rota_report', { p_from: from, p_to: to }),
      supabase.rpc('ops_rota_by_type', { p_from: from, p_to: to }),
      supabase.from('rota_shifts')
        .select('shift_date, shift_name, start_time, end_time, member, team_members(display_name)')
        .gte('shift_date', from).lte('shift_date', to)
        .order('shift_date').order('start_time', { nullsFirst: false }),
    ])
    setRota((r as RotaRow[]) || [])
    setByType((t as TypeRow[]) || [])
    setCover((c as unknown as CoverRow[]) || [])
    setLoading(false)
  }, [from, to])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadRota() }, [loadRota])
  useEffect(() => {
    supabase.rpc('ops_all_boards_progress').then(({ data }) => setBoards((data as BoardRow[]) || []))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // CSV = EXACTLY the per-person rota rows on screen (same source → no drift).
  const exportRotaCsv = () => {
    const esc = (v: unknown) => {
      if (v == null) return ''
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = ['member', 'timed_shifts', 'timed_hours', 'untimed_shifts', 'total_shifts']
    const lines = [header.join(',')]
    for (const r of rota) {
      lines.push([esc(r.display_name), esc(r.timed_shifts), esc(fmtHours(r.timed_hours)), esc(r.untimed_shifts), esc(r.total_shifts)].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trc-rota-report-${from}_to_${to}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Coverage grid: group raw shifts by date; days in range with none = a gap.
  const days: string[] = (() => {
    const out: string[] = []
    const d = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00')
    if (isNaN(d.getTime()) || isNaN(end.getTime()) || d > end) return out
    for (let i = 0; i < 92 && d <= end; i++) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
    return out
  })()
  const coverByDay = (day: string) => cover.filter(c => c.shift_date === day)

  const totalTimedHours = rota.reduce((s, r) => s + Number(r.timed_hours), 0)
  const totalUntimed = rota.reduce((s, r) => s + r.untimed_shifts, 0)

  return (
    <>
      <div style={eyebrow}>{t('Operations Hub', 'Trung tâm Vận hành')}</div>
      <h1 style={pageTitle}>{t('Reports', 'Báo cáo')}</h1>
      <p style={lede}>
        {t('Rota hours and board progress over a date range. Hours are counted only for shifts with both a start and end time — untimed shifts are listed separately and never given an assumed length.', 'Số giờ trực ca và tiến độ bảng công việc trong một khoảng ngày. Giờ chỉ được tính cho các ca có cả giờ bắt đầu và giờ kết thúc — các ca không ghi giờ được liệt kê riêng và không bao giờ được gán một độ dài giả định.')}
      </p>

      {/* date range */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', margin: '20px 0 28px', flexWrap: 'wrap' }}>
        <label style={fieldLabel}>{t('From', 'Từ')}<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={dateInput} /></label>
        <label style={fieldLabel}>{t('To', 'Đến')}<input type="date" value={to} min={from} max={vnDateString()} onChange={e => setTo(e.target.value)} style={dateInput} /></label>
        <button onClick={() => { setFrom(monthStart()); setTo(vnDateString()) }} style={tinyBtn}>{t('This month', 'Tháng này')}</button>
        <button onClick={exportRotaCsv} disabled={rota.length === 0} style={{ ...btnPrimary, marginLeft: 'auto', opacity: rota.length === 0 ? 0.5 : 1 }}>{t('↓ Export rota CSV', '↓ Xuất CSV lịch trực')}</button>
      </div>

      {/* ── rota: per person ── */}
      <h2 style={sectionTitle}>{t('Rota — by person', 'Lịch trực — theo người')}</h2>
      {loading ? <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div> : rota.length === 0 ? (
        <div style={emptyText}>{t('No shifts in this range.', 'Không có ca nào trong khoảng này.')}</div>
      ) : (
        <table style={table}>
          <thead><tr>
            <th style={th}>{t('Person', 'Người')}</th><th style={thNum}>{t('Timed shifts', 'Ca có giờ')}</th><th style={thNum}>{t('Timed hours', 'Số giờ có tính')}</th>
            <th style={thNum}>{t('Untimed shifts', 'Ca không giờ')}</th><th style={thNum}>{t('Total shifts', 'Tổng số ca')}</th>
          </tr></thead>
          <tbody>
            {rota.map(r => (
              <tr key={r.member_id}>
                <td style={td}>{r.display_name}</td>
                <td style={tdNum}>{r.timed_shifts}</td>
                <td style={tdNum}>{fmtHours(r.timed_hours)}</td>
                <td style={{ ...tdNum, color: r.untimed_shifts > 0 ? '#C9A24B' : '#7E7864' }}>{r.untimed_shifts || '—'}</td>
                <td style={tdNum}>{r.total_shifts}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 700 }}>{t('Total', 'Tổng')}</td>
              <td style={tdNum}>{rota.reduce((s, r) => s + r.timed_shifts, 0)}</td>
              <td style={{ ...tdNum, fontWeight: 700 }}>{fmtHours(totalTimedHours)}</td>
              <td style={tdNum}>{totalUntimed || '—'}</td>
              <td style={tdNum}>{rota.reduce((s, r) => s + r.total_shifts, 0)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {totalUntimed > 0 && (
        <p style={{ ...metaText, marginTop: 8, color: '#C9A24B' }}>
          ⚠ {totalUntimed} {t('untimed shift', 'ca không ghi giờ')}{totalUntimed === 1 ? '' : 's'} {t('in this range — counted, but not included in the hours total (no start/end time recorded).', 'trong khoảng này — được tính, nhưng không cộng vào tổng số giờ (không ghi giờ bắt đầu/kết thúc).')}
        </p>
      )}

      {/* ── rota: by type ── */}
      {byType.length > 0 && (
        <>
          <h2 style={sectionTitle}>{t('Rota — by shift type', 'Lịch trực — theo loại ca')}</h2>
          <table style={table}>
            <thead><tr><th style={th}>{t('Shift', 'Ca')}</th><th style={thNum}>{t('Timed shifts', 'Ca có giờ')}</th><th style={thNum}>{t('Timed hours', 'Số giờ có tính')}</th><th style={thNum}>{t('Untimed', 'Không giờ')}</th><th style={thNum}>{t('Total', 'Tổng')}</th></tr></thead>
            <tbody>
              {byType.map(t2 => (
                <tr key={t2.shift_name}>
                  <td style={td}>{t2.shift_name}</td>
                  <td style={tdNum}>{t2.timed_shifts}</td>
                  <td style={tdNum}>{fmtHours(t2.timed_hours)}</td>
                  <td style={{ ...tdNum, color: t2.untimed_shifts > 0 ? '#C9A24B' : '#7E7864' }}>{t2.untimed_shifts || '—'}</td>
                  <td style={tdNum}>{t2.total_shifts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── coverage / gaps ── */}
      <h2 style={sectionTitle}>{t('Coverage', 'Phủ ca')}</h2>
      {days.length === 0 ? (
        <div style={emptyText}>{t('Pick a valid date range (max ~3 months).', 'Chọn một khoảng ngày hợp lệ (tối đa ~3 tháng).')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
          {days.map(day => {
            const list = coverByDay(day)
            return (
              <div key={day} style={{ ...coverRow, borderLeft: `3px solid ${list.length === 0 ? '#C27070' : '#5E6650'}` }}>
                <span style={{ ...metaText, minWidth: 110, color: '#E5D4C2' }}>
                  {new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {list.length === 0 ? (
                  <span style={{ ...metaText, color: '#C27070', fontStyle: 'italic' }}>{t('— no cover —', '— không có ai trực —')}</span>
                ) : (
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {list.map((c, i) => (
                      <span key={i} style={coverChip}>
                        {c.shift_name}: {c.team_members?.display_name || '?'}
                        {c.start_time && c.end_time ? ` (${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)})` : t(' (untimed)', ' (không ghi giờ)')}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── all boards progress ── */}
      <h2 style={{ ...sectionTitle, marginTop: 44 }}>{t('Board progress', 'Tiến độ bảng')}</h2>
      {boards.length === 0 ? (
        <div style={emptyText}>{t('No active boards.', 'Không có bảng đang hoạt động.')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {boards.map(b => (
            <Link key={b.project_id} href={`/admin/ops/${b.project_id}/progress`} style={boardRow}>
              <span style={{ flex: 1, color: '#E5D4C2', fontFamily: FAMILY, fontSize: 13 }}>{b.name}</span>
              <span style={metaText}>{b.done}/{b.total} {t('done', 'hoàn thành')}</span>
              {b.overdue > 0 && <span style={{ ...metaText, color: '#C27070' }}>{b.overdue} {t('overdue', 'quá hạn')}</span>}
              <span style={{ ...progressBarOuter }}><span style={{ ...progressBarInner, width: `${b.pct_complete}%` }} /></span>
              <span style={{ ...metaText, minWidth: 42, textAlign: 'right', color: '#D4B85A' }}>{fmtHours(b.pct_complete)}%</span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.18em', color: '#7E7864', textTransform: 'uppercase' }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, color: '#E5D4C2', margin: '4px 0 0' }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', maxWidth: 640, lineHeight: 1.6, marginTop: 8 }
const sectionTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', margin: '32px 0 12px' }
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', letterSpacing: '0.06em' }
const dateInput: React.CSSProperties = { background: '#0A3526', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12, padding: '6px 8px' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 6, color: '#B2AA98', fontFamily: FAMILY, fontSize: 11, padding: '6px 10px', cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { background: '#D4B85A', border: 'none', borderRadius: 6, color: '#052E20', fontFamily: FAMILY, fontSize: 12, fontWeight: 700, padding: '8px 14px', cursor: 'pointer' }
const table: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', maxWidth: 640 }
const th: React.CSSProperties = { textAlign: 'left', fontFamily: FAMILY, fontSize: 10, color: '#7E7864', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 10px', borderBottom: '1px solid rgba(229,212,194,0.12)' }
const thNum: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#E5D4C2', padding: '8px 10px', borderBottom: '1px solid rgba(229,212,194,0.05)' }
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const emptyText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '12px 0' }
const coverRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px', background: 'rgba(229,212,194,0.03)', borderRadius: 6 }
const coverChip: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#E5D4C2', background: 'rgba(229,212,194,0.07)', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 5, padding: '2px 7px' }
const boardRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, textDecoration: 'none' }
const progressBarOuter: React.CSSProperties = { width: 120, height: 6, background: 'rgba(229,212,194,0.10)', borderRadius: 3, overflow: 'hidden' }
const progressBarInner: React.CSSProperties = { display: 'block', height: '100%', background: '#D4B85A' }
