'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/admin-lang'
import type { WeekAttendance } from '@/lib/attendance'

// The live attendance strip at the top of /admin/calendar (2026-09-15, Lachlan:
// "a live total attendance at the top of the calendar each week … plus total
// bookings [and] time spent in club").
//
// LIVE means: it asks again every minute, the moment the tab is looked at again,
// and whenever the calendar itself reloads (marking a booking arrived or starting
// a visit changes the numbers, and waiting a minute to see it would feel broken).
// It follows whichever week the calendar is showing.

const REFRESH_MS = 60_000
const LOAD_FAILED = '__load_failed__'
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const MONO = "'Google Sans Code', 'DM Mono', monospace"

function hoursLabel(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export default function AttendanceStrip({ from, to, refreshKey }: { from: string; to: string; refreshKey?: unknown }) {
  const { t } = useLang()
  const [data, setData] = useState<WeekAttendance | null>(null)
  const [error, setError] = useState<string | null>(null)

  // `t` is deliberately NOT a dependency: if its identity changed per render, the
  // effect below would refetch on every render. The failure is stored as a code
  // and translated where it is drawn.
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/attendance/week?from=${from}&to=${to}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setError(j.error || LOAD_FAILED); return }
      setData(j as WeekAttendance); setError(null)
    } catch {
      setError(LOAD_FAILED)
    }
  }, [from, to])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [load, refreshKey])

  // A different week must not show the last week's numbers while it loads.
  const current = data && data.from === from && data.to === to ? data : null

  const tile = (label: string, value: string, sub?: string, accent?: boolean) => (
    <div style={{ minWidth: 118, paddingRight: 22, marginRight: 22, borderRight: '1px solid rgba(229,212,194,0.12)' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: CREAM, opacity: 0.6 }}>{label}</div>
      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: accent ? 38 : 28, lineHeight: 1.05, color: accent ? GOLD : CREAM, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 10.5, color: CREAM, opacity: 0.6, marginTop: 3 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ margin: '4px 0 18px', padding: '16px 0 14px', borderTop: '1px solid rgba(229,212,194,0.12)', borderBottom: '1px solid rgba(229,212,194,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontFamily: MONO, fontSize: 10.5, color: CREAM, opacity: 0.75 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: error ? '#C27070' : '#7AB07A', boxShadow: error ? 'none' : '0 0 0 3px rgba(122,176,122,0.18)' }} />
        <span style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>{t('Live attendance · this week', 'Số lượt trực tiếp · tuần này')}</span>
        {current && (
          <span style={{ opacity: 0.7 }}>
            · {t('updated', 'cập nhật')} {new Date(current.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
          </span>
        )}
        {error && <span style={{ color: '#E8A6A6', opacity: 1 }}>· {error === LOAD_FAILED ? t('Could not load attendance', 'Không tải được số lượt') : error}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 14 }}>
        {tile(t('Total attendance', 'Tổng lượt'), current ? String(current.attendance) : '—',
          current ? t(`${current.member_days} member · ${current.guests} guest`, `${current.member_days} hội viên · ${current.guests} khách`) : undefined, true)}
        {current?.today_attendance != null && tile(t('Today', 'Hôm nay'), String(current.today_attendance))}
        {tile(t('Members', 'Hội viên'), current ? String(current.members) : '—', t('different members', 'hội viên khác nhau'))}
        {tile(t('Bookings', 'Đặt chỗ'), current ? String(current.bookings.total) : '—',
          current ? t(`${current.bookings.arrived} arrived · ${current.bookings.people} people booked`, `${current.bookings.arrived} đã đến · ${current.bookings.people} người đặt`) : undefined)}
        {tile(t('Time in club', 'Thời gian tại CLB'), current ? hoursLabel(current.minutes_in_club) : '—',
          current && current.open_visits ? t(`${current.open_visits} visit${current.open_visits === 1 ? '' : 's'} still going`, `${current.open_visits} lượt đang diễn ra`) : undefined)}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: CREAM, opacity: 0.45, marginTop: 10, lineHeight: 1.6 }}>
        {t('Counts people who actually came in: card taps, started visits, bookings marked arrived, and guests signed in. A booking only counts once it is marked arrived.',
           'Chỉ đếm người thực sự đã đến: quẹt thẻ, lượt ghé đã bắt đầu, đặt chỗ đã đánh dấu đến, và khách đã ký vào. Đặt chỗ chỉ được tính khi đã đánh dấu đến.')}
      </div>
    </div>
  )
}
