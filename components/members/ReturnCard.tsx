'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, type Lang } from '@/lib/lang'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// PASSIVE post-visit card. The morning(s) after a recent visit, a quiet recap —
// composed from real visit + consumption rows (member-safe fields only). Degrades
// gracefully (visit but no drams → date + space). Dismissible (a cosmetic
// localStorage flag, per visit). No recent visit → renders nothing. Its one action
// deep-links into the concierge thread with context pre-filled (NOT pre-sent).

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Visit { date: string; space: string | null; duration_min: number | null; drams: string[] }

type T = (en: string, vn: string) => string
// Vietnamese has no article, so "the Library Bar" stays "Library Bar" in VN.
const withArticle = (s: string, lang: Lang) => (lang === 'vn' || /^(the|a)\b/i.test(s) ? s : `the ${s}`)
function dateLabel(iso: string, t: T, lang: Lang): string {
  const d = new Date(iso + 'T00:00:00'), today = new Date()
  const days = Math.round((new Date(today.toDateString()).getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return t('earlier today', 'hôm nay')
  if (days === 1) return t('last night', 'tối qua')
  const date = d.toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return t(`on ${date}`, `vào ${date}`)
}
function durationLabel(min: number | null, t: T): string {
  if (!min || min < 30) return ''
  const h = Math.floor(min / 60), m = min % 60
  if (h && m) return t(`${h}h ${m}m`, `${h} giờ ${m} phút`)
  if (h) return t(`${h}h`, `${h} giờ`)
  return t(`${m}m`, `${m} phút`)
}

export default function ReturnCard() {
  const { t, lang } = useLang()
  const [v, setV] = useState<Visit | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    fetch('/api/members/return').then(r => r.ok ? r.json() : null).then(j => {
      if (j?.visit) {
        setV(j.visit)
        let seen = false
        try { seen = localStorage.getItem('trc-return-dismissed') === j.visit.date } catch { /* ignore */ }
        setDismissed(seen)
      }
    }).catch(() => { /* card simply doesn't render */ })
  }, [])

  if (!v || dismissed) return null

  const art = (s: string) => withArticle(s, lang)
  const when = dateLabel(v.date, t, lang)
  const dur = durationLabel(v.duration_min, t)
  const where = v.space ? t(`in ${art(v.space)}`, `tại ${art(v.space)}`) : ''
  const poured = v.drams.slice(0, 3).map(art).join(', ')
  const more = v.drams.length - 3
  const dramLine = v.drams.length
    ? t(
        `You poured ${poured}${more > 0 ? `, and ${more} more` : ''}.`,
        `Bạn đã thưởng thức ${poured}${more > 0 ? `, và ${more} ly khác` : ''}.`,
      )
    : ''
  const prefill = t(`A thought on my evening ${when}: `, `Đôi lời về lần ghé của tôi ${when}: `)

  const dismiss = () => {
    try { localStorage.setItem('trc-return-dismissed', v.date) } catch { /* ignore */ }
    setDismissed(true)
  }

  // The arrow is part of the translated line; lift it out so it can slide.
  const actionLabel = t('A thought on the evening? →', 'Đôi lời về buổi tối? →').replace(/\s*→\s*$/, '')

  return (
    <div className="rc2" style={card}>
      <style dangerouslySetInnerHTML={{ __html: CARD_CSS }} />
      <CreamInkDefs />
      <button onClick={dismiss} aria-label={t('Dismiss', 'Bỏ qua')} style={closeBtn}>×</button>
      <div style={{ minWidth: 0 }}>
        <div style={kicker}>{t('Welcome back', 'Chào mừng trở lại')}</div>
        <div style={headline}>{t(`Your visit ${when}`, `Lần ghé của bạn ${when}`)}</div>
        <div style={detail}>
          {[where, dur && t(`${dur} with us`, `${dur} cùng chúng tôi`)].filter(Boolean).join(' · ') || t('Lovely to have had you in.', 'Thật vui được đón bạn.')}
        </div>
        {dramLine && <div style={dramStyle}>{dramLine}</div>}
        <Link href={`/members/concierge?prefill=${encodeURIComponent(prefill)}`} className="rc2-cta">
          {actionLabel} <span className="rc2-go" aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="rc2-art" aria-hidden="true">
        <CreamInk name="glass" width="100%" rot={6} dur={8} />
      </div>
    </div>
  )
}

const CARD_CSS = `
  .rc2 { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 28px; align-items: center; }
  .rc2-art { width: 96px; margin-right: 40px; }
  .rc2-cta { display: inline-block; margin-top: 22px; color: #E5D4C2; text-decoration: none;
             border-bottom: 1px solid rgba(229,212,194,.6); padding-bottom: 6px;
             font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .rc2-go { display: inline-block; transition: transform .35s ease; }
  .rc2-cta:hover .rc2-go { transform: translateX(7px); }
  @media (max-width: 560px) { .rc2 { grid-template-columns: minmax(0, 1fr) 64px; gap: 16px; align-items: start; }
                              .rc2-art { width: 64px; margin: 36px 0 0; } }
  @media (prefers-reduced-motion: reduce) { .rc2-go { transition: none; } }
`

const card: React.CSSProperties = { position: 'relative', borderTop: '1px solid rgba(229,212,194,0.18)', padding: '28px 0', color: '#E5D4C2' }
const closeBtn: React.CSSProperties = { position: 'absolute', top: 14, right: 0, background: 'transparent', border: 'none', color: '#E5D4C2', fontSize: 22, lineHeight: 1, cursor: 'pointer', opacity: 0.7, padding: 4 }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B0C18E' }
const headline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 0.98, color: '#E5D4C2', margin: '14px 0 12px' }
const detail: React.CSSProperties = { fontFamily: MONO, fontSize: 13.5, color: '#E5D4C2', opacity: 0.88, lineHeight: 1.8 }
const dramStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#D4B85A', marginTop: 6, lineHeight: 1.8 }
