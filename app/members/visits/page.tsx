'use client'

import { useEffect, useState } from 'react'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'

// A member's own visit history — member-own via /api/members/visits (session →
// member_no). A tasteful record (date · space), not raw rows.

interface Visit { visit_id: string; visit_date: string; space: string | null; duration_min: number | null }
const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

function fmtDate(iso: string, lang: Lang) {
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
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

  return (
    <MemberPage title="Your Visits" subtitle={surfaceName('/members/visits', 'vn')}>
      {loading ? (
        <p style={muted}>{t('Loading…', 'Đang tải…')}</p>
      ) : visits.length === 0 ? (
        <p style={muted}>{t('No visits recorded yet. We look forward to welcoming you.', 'Chưa có lần ghé thăm nào được ghi nhận. Chúng tôi mong được đón tiếp bạn.')}</p>
      ) : (
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          {visits.map(v => {
            const dur = fmtDuration(v.duration_min, lang)
            return (
              <div key={v.visit_id} style={row}>
                <div style={dateText}>{fmtDate(v.visit_date, lang)}</div>
                <div style={metaText}>{[v.space, dur].filter(Boolean).join(' · ') || t('A visit to the club', 'Một lần ghé thăm câu lạc bộ')}</div>
              </div>
            )
          })}
        </div>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center' }
const row: React.CSSProperties = { padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.08)' }
const dateText: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 3 }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em' }
