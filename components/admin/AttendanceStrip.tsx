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

/** Today in Vietnam, which is the only "today" this club has. */
const vnToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)

/** "2026-09-14" → "14 Sept". */
const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** What sits under the Time in club figure: what is still running, and how
 *  much of the number is an estimate rather than a measurement. */
function timeSub(d: WeekAttendance, t: (en: string, vn: string) => string): string | undefined {
  const bits: string[] = []
  if (d.open_visits) bits.push(t(`${d.open_visits} visit${d.open_visits === 1 ? '' : 's'} still going`, `${d.open_visits} lượt đang diễn ra`))
  if (d.minutes_estimated > 0) bits.push(t(`${hoursLabel(d.minutes_estimated)} estimated`, `${hoursLabel(d.minutes_estimated)} ước tính`))
  return bits.length ? bits.join(' · ') : undefined
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
  const today = vnToday()
  const isThisWeek = from <= today && today <= to

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
        {/* IT SAID "THIS WEEK" WHATEVER WEEK IT WAS SHOWING (owner, 2026-09-25).
            The strip follows the calendar's arrows, so paging back to a quiet
            week put last week's figures under the words "this week" — and the
            Tonight panel below, which is always today, then read like a
            contradiction. It says which week it is now, and only calls a week
            "this week" when today is in it. */}
        <span style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {t('Live attendance', 'Số lượt trực tiếp')} · {isThisWeek
            ? t('this week', 'tuần này')
            : `${dayLabel(from)} – ${dayLabel(to)}`}
        </span>
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
        {tile(t('Bookings', 'Đặt chỗ'),
          current ? String(current.bookings.total + (current.diary_entries || 0)) : '—',
          current ? t(
            `${current.bookings.arrived} arrived · ${current.bookings.people + (current.diary_covers || 0)} people booked`,
            `${current.bookings.arrived} đã đến · ${current.bookings.people + (current.diary_covers || 0)} người đặt`) : undefined)}
        {tile(t('Time in club', 'Thời gian tại CLB'), current ? hoursLabel(current.minutes_in_club) : '—',
          current ? timeSub(current, t) : undefined)}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: CREAM, opacity: 0.45, marginTop: 10, lineHeight: 1.6 }}>
        {current && current.minutes_estimated > 0 && (
          <div style={{ marginBottom: 4 }}>
            {t(`Time in club includes ${hoursLabel(current.minutes_estimated)} read off the booking's own times — the ones staff correct when a member leaves. A person who was there wrote them; they are not two timestamps.`,
               `Thời gian tại CLB bao gồm ${hoursLabel(current.minutes_estimated)} lấy từ giờ trên đặt chỗ — giờ mà nhân viên sửa lại khi hội viên ra về. Do người có mặt ghi lại; không phải hai dấu thời gian.`)}
          </div>
        )}
        {/* WHERE THE LENGTHS COME FROM. Not one departure has been stamped
            since the club opened the feature: every length on file was typed
            in afterwards. That is worth having and it is not a measurement,
            and the difference belongs on the screen rather than in a note
            somebody read once. */}
        {current && current.visits_total > 0 && current.departures_stamped === 0 && (
          <div style={{ marginBottom: 4 }}>
            {t(`No visit was closed with LEFT this week — ${current.visits_with_length} of ${current.visits_total} carry a length entered another way. The booking times staff correct are the club's real record of when people go; tapping LEFT is what turns one into a measurement.`,
               `Tuần này không có lượt ghé nào được đóng bằng LEFT — ${current.visits_with_length}/${current.visits_total} có thời lượng nhập theo cách khác. Giờ trên đặt chỗ do nhân viên sửa mới là ghi nhận thực tế; bấm LEFT là cách biến nó thành số đo.`)}
          </div>
        )}
        {/* A DIARY ENTRY IS A BOOKING (owner, 2026-09-25). A private party staff
            put in a room has no member row behind it, so it cannot be marked
            arrived — it counts as booked, and says which part it is. */}
        {current && (current.diary_covers || 0) > 0 && (
          <div style={{ marginBottom: 4 }}>
            {t(`${current.diary_covers} of the people counted are on ${current.diary_entries} diary entr${current.diary_entries === 1 ? 'y' : 'ies'} — private parties staff booked into a room by hand. Nobody can mark a diary entry arrived, so these are counted as coming on the club's own word rather than from a card tap.`,
               `${current.diary_covers} người trong số đã tính thuộc ${current.diary_entries} mục lịch — tiệc riêng do nhân viên đặt phòng trực tiếp. Không thể đánh dấu mục lịch là đã đến, nên được tính theo ghi nhận của câu lạc bộ chứ không phải từ quẹt thẻ.`)}
          </div>
        )}
        {current && current.bookings_unmeasured > 0 && (
          <div style={{ marginBottom: 4 }}>
            {t(`${current.bookings_unmeasured} arrived booking${current.bookings_unmeasured === 1 ? '' : 's'} contributed no time at all: no visit was opened, and the booking has no end time to measure from. Tap LEFT when they go and the time is recorded.`,
               `${current.bookings_unmeasured} đặt chỗ đã đến không đóng góp thời gian nào: chưa mở lượt ghé và đặt chỗ không có giờ kết thúc để tính. Bấm LEFT khi khách về thì thời gian sẽ được ghi lại.`)}
          </div>
        )}
        {t('Counts people who actually came in: card taps, started visits, bookings marked arrived, and guests signed in. A booking only counts once it is marked arrived.',
           'Chỉ đếm người thực sự đã đến: quẹt thẻ, lượt ghé đã bắt đầu, đặt chỗ đã đánh dấu đến, và khách đã ký vào. Đặt chỗ chỉ được tính khi đã đánh dấu đến.')}
      </div>
    </div>
  )
}
