'use client'

import { useEffect, useMemo, useState } from 'react'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// A member's own visit history — member-own via /api/members/visits (session →
// member_no). A tasteful record (date · space), not raw rows: a ledger, the year
// set large, each visit a line with its day in the display face.

interface Visit { visit_id: string; visit_date: string; space: string | null; duration_min: number | null }
const FAMILY = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'

// The same date as before (weekday, day, month, year — vi-VN in Vietnamese,
// pinned to Sài Gòn), read as parts so the day can be set large and the year
// can head its group.
function dateParts(iso: string, lang: Lang) {
  const parts = new Intl.DateTimeFormat(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
    .formatToParts(new Date(`${iso}T12:00:00+07:00`))
  const get = (k: string) => parts.find(p => p.type === k)?.value || ''
  return { day: get('day'), weekday: get('weekday'), month: get('month'), year: get('year') }
}
function fmtDuration(min: number | null, lang: Lang) {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60), m = min % 60
  if (lang === 'vn') return h ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

export default function MyVisitsPage() {
  const { t, lang } = useLang()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/members/visits', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setVisits(d.visits || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Grouped by year, in the order the record arrives.
  const years = useMemo(() => {
    const out: { year: string; rows: Visit[] }[] = []
    for (const v of visits) {
      const y = v.visit_date.slice(0, 4)
      const last = out[out.length - 1]
      if (last && last.year === y) last.rows.push(v)
      else out.push({ year: y, rows: [v] })
    }
    return out
  }, [visits])

  return (
    <MemberPage title="Your Visits" subtitle={surfaceName('/members/visits', 'vn')}>
      <style dangerouslySetInnerHTML={{ __html: `
        .vs { color: ${CREAM}; text-align: left; }
        .vs .pk-float img { display: block; width: 100%; height: auto; transform: rotate(var(--rot, -4deg));
                            animation: vs-drift var(--dur, 8s) ease-in-out infinite alternate; }
        @keyframes vs-drift { from { transform: rotate(var(--rot, -4deg)) translateY(0) }
                              to   { transform: rotate(calc(var(--rot, -4deg) + 3deg)) translateY(-8px) } }
        .vs-muted { font-family: ${FAMILY}; font-size: 14px; line-height: 2; max-width: 520px; margin: 0; }
        .vs-empty { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: center; }
        .vs-year { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 40px; padding: 8px 0 44px; }
        .vs-year + .vs-year { padding-top: 44px; border-top: 1px solid rgba(229,212,194,.16); }
        .vs-y { margin: 0; font-weight: 400; font-family: ${SERIF}; font-size: clamp(56px, 7vw, 96px); line-height: .88; color: ${GOLD}; position: sticky; top: 100px; align-self: start; }
        .vs-row { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 22px; align-items: baseline;
                  padding: 18px 0; border-bottom: 1px solid rgba(229,212,194,.12); }
        .vs-row:first-child { padding-top: 0; }
        .vs-row:last-child { border-bottom: none; }
        .vs-day { font-family: ${SERIF}; font-size: 44px; line-height: .9; }
        .vs-when { font-family: ${SERIF}; font-size: clamp(20px, 2.2vw, 26px); line-height: 1.15; }
        .vs-meta { font-family: ${FAMILY}; font-size: 12.5px; letter-spacing: .04em; margin-top: 6px; opacity: .8; }
        @media (max-width: 700px) {
          .vs-year { grid-template-columns: 1fr; gap: 18px; }
          .vs-y { position: static; font-size: 56px; }
          .vs-row { grid-template-columns: 54px minmax(0, 1fr); gap: 16px; }
          .vs-day { font-size: 38px; }
          .vs-empty { grid-template-columns: 1fr; gap: 26px; }
          .vs-muted { font-size: 13px; }
        }
        @media (prefers-reduced-motion: reduce) { .vs .pk-float img { animation: none; } }
      ` }} />
      <CreamInkDefs />
      <div className="vs">
        {loading ? (
          <p className="vs-muted">{t('Loading…', 'Đang tải…')}</p>
        ) : visits.length === 0 ? (
          <div className="vs-empty">
            <p className="vs-muted">{t('No visits recorded yet. We look forward to welcoming you.', 'Chưa có lần ghé thăm nào được ghi nhận. Chúng tôi mong được đón tiếp bạn.')}</p>
            <CreamInk name="key" width="clamp(120px, 16vw, 190px)" rot={-10} dur={9} />
          </div>
        ) : (
          years.map(g => (
            <section key={g.year} className="vs-year">
              <h2 className="vs-y">{g.year}</h2>
              <div>
                {g.rows.map(v => {
                  const dur = fmtDuration(v.duration_min, lang)
                  const p = dateParts(v.visit_date, lang)
                  return (
                    <div key={v.visit_id} className="vs-row">
                      <div className="vs-day">{p.day}</div>
                      <div>
                        <div className="vs-when">{p.weekday} · {p.month}</div>
                        <div className="vs-meta">{[v.space, dur].filter(Boolean).join(' · ') || t('A visit to the club', 'Một lần ghé thăm câu lạc bộ')}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </MemberPage>
  )
}
