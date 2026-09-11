'use client'

import { useEffect, useState } from 'react'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'
import type { Ink } from '@/components/public/kit'

// Gifts a member has received from the club — member-own via /api/members/gifts.
// Warm presentation (what · when · occasion). No cost or internal "why".
// Set as The Studio sets its pictures: a rounded frame (the photograph, or a
// house drawing where there is none), then the occasion, the gift and the date.

interface Gift { id: string; gift_date: string; occasion: string; category: string | null; description: string; photo_url: string | null }
const FAMILY = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'

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
// The drawing that stands in the frame when a gift has no photograph.
const OCCASION_INK: Record<string, Ink> = {
  birthday: 'girl-toast', anniversary: 'gent-toast', thoughtful: 'glass-botanical',
  apology: 'cigar', recovery: 'glass', dining_moment: 'butler-tray',
  referral_thanks: 'key', other: 'glass-botanical',
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
      <style dangerouslySetInnerHTML={{ __html: `
        .gf { color: ${CREAM}; text-align: left; }
        .gf .pk-float img { display: block; width: 100%; height: auto; transform: rotate(var(--rot, -4deg));
                            animation: gf-drift var(--dur, 8s) ease-in-out infinite alternate; }
        @keyframes gf-drift { from { transform: rotate(var(--rot, -4deg)) translateY(0) }
                              to   { transform: rotate(calc(var(--rot, -4deg) + 3deg)) translateY(-8px) } }
        .gf-muted { font-family: ${FAMILY}; font-size: 14px; line-height: 2; max-width: 520px; margin: 0; }
        .gf-empty { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: center; }
        .gf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 48px 30px; }
        .gf-card { margin: 0; }
        .gf-frame { position: relative; aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; background: #0B3A29;
                    box-shadow: 0 16px 38px rgba(0,0,0,.32); }
        .gf-frame img.gf-photo { display: block; width: 100%; height: 100%; object-fit: cover;
                                 transition: transform .7s cubic-bezier(.16,.84,.44,1); }
        .gf-card:hover .gf-frame img.gf-photo { transform: scale(1.05); }
        .gf-ink { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .gf-occ { font-family: ${FAMILY}; font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; color: ${GOLD}; margin-top: 18px; }
        .gf-desc { font-family: ${SERIF}; font-size: clamp(21px, 2vw, 25px); line-height: 1.15; margin-top: 8px; }
        .gf-date { font-family: ${FAMILY}; font-size: 12px; margin-top: 8px; opacity: .8; }
        @media (max-width: 600px) {
          .gf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 16px; }
          .gf-frame { border-radius: 12px; }
          .gf-desc { font-size: 19px; }
          .gf-occ { font-size: 10.5px; letter-spacing: .12em; margin-top: 12px; }
          .gf-date { font-size: 11.5px; }
          .gf-empty { grid-template-columns: 1fr; gap: 26px; }
          .gf-muted { font-size: 13px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gf .pk-float img { animation: none; }
          .gf-frame img.gf-photo { transition: none; }
        }
      ` }} />
      <CreamInkDefs />
      <div className="gf">
        {loading ? (
          <p className="gf-muted">{t('Loading…', 'Đang tải…')}</p>
        ) : gifts.length === 0 ? (
          <div className="gf-empty">
            <p className="gf-muted">{t('No gifts recorded yet — but the club has a long memory and a generous hand.', 'Chưa có món quà nào được ghi nhận — nhưng câu lạc bộ luôn nhớ lâu và rộng lượng.')}</p>
            <CreamInk name="butler-tray" width="clamp(130px, 16vw, 200px)" rot={6} dur={9} />
          </div>
        ) : (
          <div className="gf-grid">
            {gifts.map(g => (
              <figure key={g.id} className="gf-card">
                <div className="gf-frame">
                  {g.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="gf-photo" src={g.photo_url} alt={g.description || g.occasion || t('A gift from the club', 'Một món quà từ câu lạc bộ')} loading="lazy" decoding="async" />
                  ) : (
                    <div className="gf-ink"><CreamInk name={OCCASION_INK[g.occasion] || 'glass-botanical'} width="56%" rot={-5} dur={9} /></div>
                  )}
                </div>
                <figcaption>
                  <div className="gf-occ">{t(OCCASION_LABEL[g.occasion] || 'A gift', OCCASION_LABEL_VN[g.occasion] || 'Một món quà')}</div>
                  <div className="gf-desc">{g.description}</div>
                  <div className="gf-date">{fmtDate(g.gift_date, lang)}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </MemberPage>
  )
}
