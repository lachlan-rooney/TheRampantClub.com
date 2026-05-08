'use client'

import { useEffect, useState } from 'react'

interface TonightData {
  date: string
  dram:  { label: string; note: string; curated: boolean }
  vinyl: { label: string; note: string; curated: boolean }
  quote: string
  quote_curated: boolean
}

const SAIGON_TZ = 'Asia/Ho_Chi_Minh'

function saigonHour(): number {
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: SAIGON_TZ })
  return parseInt(fmt.format(new Date()), 10) || 0
}

function greetingFor(hour: number): string {
  if (hour < 5)  return 'After hours in Sài Gòn'
  if (hour < 11) return 'Good morning, Sài Gòn'
  if (hour < 17) return 'Good afternoon, Sài Gòn'
  if (hour < 21) return 'Good evening, Sài Gòn'
  return 'Tonight in Sài Gòn'
}

export default function TonightPanel({
  showClubhouseCount = false,
  bg = 'cream',
}: {
  showClubhouseCount?: boolean
  bg?: 'cream' | 'green'  // cream = light page bg (homepage), green = dark (members)
}) {
  const [data, setData] = useState<TonightData | null>(null)
  const [hour, setHour] = useState(0)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    setHour(saigonHour())
    const tick = setInterval(() => setHour(saigonHour()), 60_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    fetch('/api/tonight').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  useEffect(() => {
    if (!showClubhouseCount) return
    const load = () => fetch('/api/members/clubhouse-now')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCount(d.count) })
      .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [showClubhouseCount])

  const greeting = greetingFor(hour)
  const onCream = bg === 'cream'
  const text  = onCream ? '#052E20' : '#E5D4C2'
  const dim   = onCream ? '#5E6650' : '#B2AA98'
  const accent = onCream ? '#28483C' : '#D4B85A'

  return (
    <div style={{
      padding: '36px 32px',
      borderRadius: 16,
      background: onCream
        ? 'linear-gradient(180deg, rgba(5,46,32,0.04), rgba(5,46,32,0.10))'
        : 'linear-gradient(180deg, rgba(229,212,194,0.04), rgba(40,72,60,0.18))',
      border: onCream ? '1px solid rgba(5,46,32,0.18)' : '1px solid rgba(229,212,194,0.12)',
      boxShadow: onCream
        ? '0 14px 36px rgba(5,46,32,0.10)'
        : '0 24px 48px rgba(5,46,32,0.18)',
      maxWidth: 720,
      margin: '0 auto',
    }}>
      {/* Header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: "'Google Sans Code', monospace", fontSize: 10,
        color: dim, letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 18,
      }}>
        <span style={{
          width: 6, height: 6, background: accent,
          transform: 'rotate(45deg)', display: 'inline-block',
        }} />
        Tonight at The Rampant Club
      </div>

      {/* Greeting + clubhouse count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16, marginBottom: 26 }}>
        <h3 style={{
          fontFamily: "'Rampant Sans', 'Playfair Display', serif",
          fontSize: 26, fontWeight: 500, color: text,
          letterSpacing: '0.02em', margin: 0,
        }}>
          {greeting}
        </h3>
        {showClubhouseCount && count !== null && (
          <div style={{
            fontFamily: "'Google Sans Code', monospace", fontSize: 11,
            color: dim, letterSpacing: '0.06em', textAlign: 'right',
          }}>
            <div style={{ color: accent, fontSize: 13 }}>
              {count === 0 ? 'Clubhouse quiet' : `${count} ${count === 1 ? 'member' : 'members'} in the clubhouse`}
            </div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>
              tapped within the last 4 hours
            </div>
          </div>
        )}
      </div>

      {/* Dram of the day */}
      <Pick label="Dram of the day" text={text} dim={dim} accent={accent}
        title={data?.dram.label || '…'} note={data?.dram.note || ''} />

      {/* Vinyl */}
      <Pick label="On the turntable" text={text} dim={dim} accent={accent}
        title={data?.vinyl.label || '…'} note={data?.vinyl.note || ''} />

      {/* Quote */}
      {data?.quote && (
        <blockquote style={{
          margin: '24px 0 0',
          padding: '18px 22px',
          borderLeft: `2px solid ${accent}`,
          fontFamily: "'Rampant Sans', 'Playfair Display', serif",
          fontSize: 16, fontStyle: 'italic', lineHeight: 1.6,
          color: text, opacity: 0.92,
        }}>
          “{data.quote}”
        </blockquote>
      )}
    </div>
  )
}

function Pick({ label, title, note, text, dim, accent }: {
  label: string; title: string; note: string
  text: string; dim: string; accent: string
}) {
  return (
    <div style={{
      paddingTop: 14, paddingBottom: 14,
      borderTop: `1px solid ${text === '#052E20' ? 'rgba(5,46,32,0.1)' : 'rgba(229,212,194,0.08)'}`,
    }}>
      <div style={{
        fontFamily: "'Google Sans Code', monospace", fontSize: 9,
        color: dim, letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Rampant Sans', 'Playfair Display', serif",
        fontSize: 18, fontWeight: 500, color: text, marginBottom: 4,
      }}>
        {title}
      </div>
      {note && (
        <div style={{
          fontFamily: "'Google Sans Code', monospace", fontSize: 11,
          color: accent, opacity: 0.75, lineHeight: 1.55,
        }}>
          {note}
        </div>
      )}
    </div>
  )
}
