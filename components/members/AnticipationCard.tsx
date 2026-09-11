'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, type Lang } from '@/lib/lang'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// PASSIVE pre-visit card. Composes the member's next real booking and renders on
// the dashboard — nothing is sent, no staff action, no fabrication (it shows only
// what's true). Its one action deep-links into the concierge thread with context
// pre-filled (NOT pre-sent). No booking → renders nothing.
//
// Set in the site's language: no tinted box — the date LARGE between two
// hairlines, the room key drifting beside it, the action an underlined line.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Booking { date: string; start_time: string | null; session_label: string | null; space: string; party_size: number | null; tables: string[] }
interface Evt { title: string; start_time: string | null }

type T = (en: string, vn: string) => string
// Vietnamese has no article, so "the Library Bar" stays "Library Bar" in VN.
const withArticle = (s: string, lang: Lang) => (lang === 'vn' || /^(the|a)\b/i.test(s) ? s : `the ${s}`)
function dateLabel(iso: string, lang: Lang): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
// The three standard sessions (db/bookings.sql); a custom label shows as typed.
const SESSION_VN: Record<string, string> = { early: 'Sớm', evening: 'Buổi tối', late: 'Khuya' }
function timeLabel(b: Booking, lang: Lang): string {
  if (b.start_time) return b.start_time.slice(0, 5)
  if (b.session_label) {
    const vn = lang === 'vn' ? SESSION_VN[b.session_label.toLowerCase()] : undefined
    return vn || b.session_label.charAt(0).toUpperCase() + b.session_label.slice(1)
  }
  return ''
}
function relativeDay(iso: string, t: T): string {
  const d = new Date(iso + 'T00:00:00'), today = new Date()
  const days = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86_400_000)
  if (days <= 0) return t('Today', 'Hôm nay')
  if (days === 1) return t('Tomorrow', 'Ngày mai')
  if (days < 7) return t(`In ${days} days`, `${days} ngày nữa`)
  return ''
}

export default function AnticipationCard() {
  const { t, lang } = useLang()
  const [b, setB] = useState<Booking | null>(null)
  const [events, setEvents] = useState<Evt[]>([])

  useEffect(() => {
    fetch('/api/members/anticipation').then(r => r.ok ? r.json() : null).then(j => {
      if (j?.booking) { setB(j.booking); setEvents(j.events || []) }
    }).catch(() => { /* card simply doesn't render */ })
  }, [])

  if (!b) return null

  const art = (s: string) => withArticle(s, lang)
  const when = [relativeDay(b.date, t), timeLabel(b, lang)].filter(Boolean).join(' · ')
  const tableLine = b.tables.length
    ? `${art(b.space)} — ${b.tables.map(art).join(', ')}`
    : art(b.space)
  // Prefill the composer (NOT sent) — an opener the member finishes.
  const prefill = t(
    `A note about my booking on ${dateLabel(b.date, lang)} in ${art(b.space)}: `,
    `Đôi lời về lượt đặt chỗ của tôi vào ${dateLabel(b.date, lang)} tại ${art(b.space)}: `,
  )

  // The arrow is part of the translated line; lift it out so it can slide.
  const actionLabel = t('A request for the evening? →', 'Có yêu cầu gì cho buổi tối? →').replace(/\s*→\s*$/, '')

  return (
    <div className="ac" style={card}>
      <style dangerouslySetInnerHTML={{ __html: CARD_CSS }} />
      <CreamInkDefs />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px 16px' }}>
          <div style={kicker}>{t('We’re expecting you', 'Chúng tôi mong đón bạn')}</div>
          {when && <div style={whenStyle}>{when}</div>}
        </div>
        <div style={headline}>{dateLabel(b.date, lang)}</div>
        <div style={detail}>
          {tableLine}
          {b.party_size && b.party_size > 1 ? t(` · a table for ${b.party_size}`, ` · bàn cho ${b.party_size} người`) : ''}
        </div>
        {events.length > 0 && (
          <div style={eventLine}>
            {t('Also in the house that day:', 'Cùng ngày tại câu lạc bộ:')} {events.map(e => e.title).join(' · ')}
          </div>
        )}
        <Link href={`/members/concierge?prefill=${encodeURIComponent(prefill)}`} className="ac-cta">
          {actionLabel} <span className="ac-go" aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="ac-art" aria-hidden="true">
        <CreamInk name="key" width="100%" rot={-14} dur={8} />
      </div>
    </div>
  )
}

const CARD_CSS = `
  .ac { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 28px; align-items: center; }
  .ac-art { width: 110px; }
  .ac-cta { display: inline-block; margin-top: 22px; color: #D4B85A; text-decoration: none;
            border-bottom: 1px solid #D4B85A; padding-bottom: 6px;
            font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .ac-go { display: inline-block; transition: transform .35s ease; }
  .ac-cta:hover .ac-go { transform: translateX(7px); }
  @media (max-width: 560px) { .ac { grid-template-columns: minmax(0, 1fr) 72px; gap: 16px; align-items: start; } .ac-art { width: 72px; } }
  @media (prefers-reduced-motion: reduce) { .ac-go { transition: none; } }
`

const card: React.CSSProperties = { borderTop: '1px solid rgba(229,212,194,0.18)', padding: '28px 0', color: '#E5D4C2' }
const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#D4B85A' }
const whenStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E5D4C2', opacity: 0.85 }
const headline: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 0.98, color: '#E5D4C2', margin: '14px 0 12px' }
const detail: React.CSSProperties = { fontFamily: MONO, fontSize: 13.5, color: '#E5D4C2', opacity: 0.88, lineHeight: 1.8 }
const eventLine: React.CSSProperties = { fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2', opacity: 0.75, marginTop: 6, lineHeight: 1.8 }
