'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'rampant.welcome.v1'
const LANG_KEY    = 'rampant.welcome.lang.v1'

type Lang = 'en' | 'vn'

interface Step {
  eyebrow: { en: string; vn: string }
  title:   { en: string; vn: string }
  body:    { en: string; vn: string }
}

const STEPS: Step[] = [
  {
    eyebrow: { en: 'Welcome',          vn: 'Chào mừng' },
    title:   { en: "You're among Rampants now.",
               vn: 'Bạn đã ở giữa những người Rampant.' },
    body:    { en: 'A few quick orientations before we leave you to it. You can dismiss this any time.',
               vn: 'Một vài hướng dẫn ngắn trước khi để bạn tự do khám phá. Bạn có thể đóng cửa sổ này bất cứ lúc nào.' },
  },
  {
    eyebrow: { en: '◆ Tonight',  vn: '◆ Tối Nay' },
    title:   { en: 'A live brief, every visit.',
               vn: 'Bản tin nóng, mỗi lần ghé thăm.' },
    body:    { en: "The top-left panel surfaces the dram of the day, what's spinning on the turntable, and how many members are currently in the clubhouse. Curated by the Committee.",
               vn: 'Bảng trên cùng bên trái cho thấy ly whisky của ngày, đĩa nhạc đang quay, và số thành viên đang ở câu lạc bộ. Được Hội Đồng tuyển chọn.' },
  },
  {
    eyebrow: { en: '✎ Notice Board', vn: '✎ Bảng Thông Báo' },
    title:   { en: 'Read the room.',
               vn: 'Đọc bảng thông báo.' },
    body:    { en: 'House announcements pinned to the corkboard. New every week. Tap to read the rest.',
               vn: 'Thông báo của câu lạc bộ ghim trên bảng nút bần. Mới mỗi tuần. Nhấn để đọc thêm.' },
  },
  {
    eyebrow: { en: '◇ Your hub', vn: '◇ Trung Tâm Của Bạn' },
    title:   { en: 'Everything else lives below.',
               vn: 'Mọi thứ khác nằm bên dưới.' },
    body:    { en: 'Events, fixtures, your membership card, the spaces, contact, and the house rules. The bucket grid is the index.',
               vn: 'Sự kiện, lịch thi đấu, thẻ thành viên, các không gian, liên hệ và nội quy. Lưới ô vuông là mục lục.' },
  },
  {
    eyebrow: { en: '✦', vn: '✦' },
    title:   { en: 'Pour for yourself. Stay as long as you like.',
               vn: 'Tự rót cho mình. Ở lại bao lâu tuỳ thích.' },
    body:    { en: 'See you in the Library Bar.',
               vn: 'Hẹn gặp tại Quầy Bar Thư Viện.' },
  },
]

export default function WelcomeTour({ name }: { name?: string }) {
  const [step, setStep] = useState<number>(-1)
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(LANG_KEY)
    if (saved === 'vn' || saved === 'en') setLang(saved)
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      const t = setTimeout(() => setStep(0), 600)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const close = () => {
    setStep(-1)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, '1')
  }
  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else close()
  }
  const back = () => setStep(s => Math.max(0, s - 1))

  if (step < 0) return null
  const s = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const skipLabel  = lang === 'en' ? (isLast ? 'Close' : 'Skip')      : (isLast ? 'Đóng' : 'Bỏ qua')
  const backLabel  = lang === 'en' ? 'Back'                            : 'Quay lại'
  const nextLabel  = lang === 'en' ? (isLast ? 'Begin' : 'Next')      : (isLast ? 'Bắt đầu' : 'Tiếp')

  return (
    <>
      <style>{`
        .wt-backdrop {
          position: fixed; inset: 0;
          background: rgba(5,46,32,0.62);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 99990;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: wt-fade 0.4s ease;
        }
        @keyframes wt-fade { from { opacity: 0 } to { opacity: 1 } }
        .wt-card {
          background: #052E20;
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.4);
          border-radius: 16px;
          padding: 36px 32px 28px;
          width: 100%;
          max-width: 460px;
          position: relative;
          box-shadow: 0 32px 64px rgba(0,0,0,0.55);
          animation: wt-rise 0.45s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes wt-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wt-lang {
          position: absolute; top: 14px; right: 14px;
          display: inline-flex;
          background: rgba(229,212,194,0.06);
          border: 1px solid rgba(229,212,194,0.15);
          border-radius: 12px;
          overflow: hidden;
        }
        .wt-lang button {
          background: transparent; border: none;
          color: #B2AA98; cursor: pointer;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          padding: 4px 10px;
          transition: background 0.2s, color 0.2s;
        }
        .wt-lang button.is-on {
          background: rgba(212,184,90,0.22); color: #D4B85A;
        }
        .wt-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: #D4B85A;
          margin-bottom: 8px;
          margin-right: 100px;  /* leave space for the toggle */
        }
        .wt-title {
          font-family: 'Rampant Sans', serif;
          font-size: 24px;
          font-weight: 500;
          margin: 0 0 14px;
          letter-spacing: 0.02em;
          line-height: 1.25;
        }
        .wt-body {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px;
          color: #B2AA98;
          line-height: 1.7;
          letter-spacing: 0.02em;
          margin: 0 0 24px;
        }
        .wt-progress {
          display: flex; gap: 6px; margin-bottom: 18px;
        }
        .wt-dot {
          flex: 1; height: 3px; border-radius: 2px;
          background: rgba(229,212,194,0.15);
          transition: background 0.3s ease;
        }
        .wt-dot.is-on { background: #D4B85A; }
        .wt-controls {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px;
        }
        .wt-skip {
          background: transparent; color: #B2AA98;
          border: none; cursor: pointer;
          font-family: 'Google Sans Code', monospace; font-size: 10px;
          letter-spacing: 0.12em; text-transform: uppercase;
          opacity: 0.6; transition: opacity 0.2s;
        }
        .wt-skip:hover { opacity: 1; }
        .wt-pair { display: flex; gap: 8px; }
        .wt-btn {
          background: rgba(212,184,90,0.18);
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.35);
          border-radius: 8px;
          padding: 10px 22px;
          cursor: pointer;
          font-family: 'Google Sans Code', monospace; font-size: 11px;
          letter-spacing: 0.10em; text-transform: uppercase;
          font-weight: 600;
          transition: background 0.2s, border-color 0.2s;
        }
        .wt-btn:hover { background: rgba(212,184,90,0.28); border-color: rgba(212,184,90,0.6); }
        .wt-btn.is-back {
          background: transparent; border-color: rgba(229,212,194,0.18); color: #B2AA98;
        }
        .wt-btn.is-back:hover { background: rgba(229,212,194,0.06); color: #E5D4C2; }
      `}</style>
      <div className="wt-backdrop" onClick={close} role="dialog" aria-modal="true" aria-label="Welcome tour">
        <div className="wt-card" onClick={e => e.stopPropagation()}>
          <div className="wt-lang" role="tablist" aria-label="Language">
            <button onClick={() => setLang('en')} className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'}>EN</button>
            <button onClick={() => setLang('vn')} className={lang === 'vn' ? 'is-on' : ''} aria-pressed={lang === 'vn'}>VN</button>
          </div>
          <div className="wt-progress" aria-hidden>
            {STEPS.map((_, i) => (
              <div key={i} className={`wt-dot${i <= step ? ' is-on' : ''}`} />
            ))}
          </div>
          <div className="wt-eyebrow">{s.eyebrow[lang]}</div>
          <h2 className="wt-title">
            {isFirst && name
              ? (lang === 'en' ? `Welcome, ${name}.` : `Chào mừng, ${name}.`)
              : s.title[lang]}
          </h2>
          <p className="wt-body">{s.body[lang]}</p>
          <div className="wt-controls">
            <button className="wt-skip" onClick={close}>{skipLabel}</button>
            <div className="wt-pair">
              {!isFirst && <button className="wt-btn is-back" onClick={back}>{backLabel}</button>}
              <button className="wt-btn" onClick={next}>{nextLabel}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
