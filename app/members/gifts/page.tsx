'use client'

import { useEffect, useState } from 'react'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'

// Gifts a member has received from the club — member-own via /api/members/gifts.
// Warm presentation (what · when · occasion). No cost or internal "why".

interface Gift { id: string; gift_date: string; occasion: string; category: string | null; description: string; photo_url: string | null }
const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

const OCCASION_LABEL: Record<string, string> = {
  birthday: 'Birthday', anniversary: 'Anniversary', thoughtful: 'A thoughtful gesture',
  apology: 'With our apologies', recovery: 'Get well', dining_moment: 'A dining moment',
  referral_thanks: 'With thanks', other: 'A gift',
}
const OCCASION_LABEL_VN: Record<string, string> = {
  birthday: 'Sinh nhật', anniversary: 'Kỷ niệm', thoughtful: 'Một chút tấm lòng',
  apology: 'Kèm lời xin lỗi', recovery: 'Chúc mau khỏe', dining_moment: 'Một khoảnh khắc ẩm thực',
  referral_thanks: 'Kèm lời cảm ơn', other: 'Một món quà',
}

function fmtDate(iso: string, lang: Lang) {
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
}

export default function MyGiftsPage() {
  const { t, lang } = useLang()
  const [gifts, setGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/members/gifts', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setGifts(d.gifts || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <MemberPage title="Gifts from the Club" subtitle="Quà Tặng Từ Câu Lạc Bộ">
      {loading ? (
        <p style={muted}>{t('Loading…', 'Đang tải…')}</p>
      ) : gifts.length === 0 ? (
        <p style={muted}>{t('No gifts recorded yet — but the club has a long memory and a generous hand.', 'Chưa có món quà nào được ghi nhận — nhưng câu lạc bộ luôn nhớ lâu và rộng lượng.')}</p>
      ) : (
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          {gifts.map(g => (
            <div key={g.id} style={card}>
              {g.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.photo_url} alt={g.description || g.occasion || t('A gift from the club', 'Một món quà từ câu lạc bộ')} loading="lazy" decoding="async" style={photo} />
              )}
              <div style={{ flex: 1 }}>
                <div style={occasionText}>{t(OCCASION_LABEL[g.occasion] || 'A gift', OCCASION_LABEL_VN[g.occasion] || 'Một món quà')}</div>
                <div style={descText}>{g.description}</div>
                <div style={dateText}>{fmtDate(g.gift_date, lang)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center' }
const card: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 0', borderBottom: '1px solid rgba(229,212,194,0.08)' }
const photo: React.CSSProperties = { width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid rgba(229,212,194,0.12)' }
const occasionText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }
const descText: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', lineHeight: 1.4, marginBottom: 4 }
const dateText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', opacity: 0.8 }
