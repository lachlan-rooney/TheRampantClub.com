'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, type Lang } from '@/lib/lang'

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

  return (
    <div style={card}>
      <button onClick={dismiss} aria-label={t('Dismiss', 'Bỏ qua')} style={closeBtn}>×</button>
      <div style={kicker}>{t('Welcome back', 'Chào mừng trở lại')}</div>
      <div style={headline}>{t(`Your visit ${when}`, `Lần ghé của bạn ${when}`)}</div>
      <div style={detail}>
        {[where, dur && t(`${dur} with us`, `${dur} cùng chúng tôi`)].filter(Boolean).join(' · ') || t('Lovely to have had you in.', 'Thật vui được đón bạn.')}
      </div>
      {dramLine && <div style={dramStyle}>{dramLine}</div>}
      <Link href={`/members/concierge?prefill=${encodeURIComponent(prefill)}`} style={action}>
        {t('A thought on the evening? →', 'Đôi lời về buổi tối? →')}
      </Link>
    </div>
  )
}

const card: React.CSSProperties = { position: 'relative', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 14, background: 'rgba(229,212,194,0.04)', padding: '20px 22px', marginBottom: 24 }
const closeBtn: React.CSSProperties = { position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: '#B2AA98', fontSize: 18, lineHeight: 1, cursor: 'pointer', opacity: 0.6 }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7AB07A' }
const headline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 22, color: '#E5D4C2', margin: '8px 0 4px', letterSpacing: '0.02em' }
const detail: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#E5D4C2', opacity: 0.82, lineHeight: 1.5 }
const dramStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#D4B85A', opacity: 0.85, marginTop: 8, lineHeight: 1.5 }
const action: React.CSSProperties = { display: 'inline-block', marginTop: 14, fontFamily: MONO, fontSize: 12, color: '#B2AA98', textDecoration: 'none', letterSpacing: '0.04em', borderBottom: '1px solid rgba(178,170,152,0.4)', paddingBottom: 2 }
