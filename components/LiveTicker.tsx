'use client'

import { useEffect, useState } from 'react'

export default function LiveTicker() {
  const [time, setTime] = useState('')
  const [temp, setTemp] = useState<number | null>(null)

  // Live clock — ticks every second, locked to Saigon timezone
  useEffect(() => {
    const tick = () => {
      const now = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      }).format(new Date())
      setTime(now)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Real temperature from Open-Meteo API (free, no key needed)
  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(d => {
        if (d.temp != null) setTemp(d.temp)
      })
      .catch(() => {})
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 20,
        zIndex: 9999,
        fontFamily: "'Rampant Sans', 'Playfair Display', serif",
        fontSize: 15,
        letterSpacing: '0.06em',
        color: 'var(--trc-green-deep, #052E20)',
        opacity: 0.7,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
      }}
    >
      <span>
        Sài Gòn Clubhouse {temp !== null ? `${temp}°C` : '—'}
      </span>
      <span
        style={{
          display: 'inline-block',
          width: 4,
          height: 4,
          background: 'var(--trc-green-deep, #052E20)',
          transform: 'rotate(45deg)',
          opacity: 0.5,
        }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {time || '—'}
      </span>
      <span>
        GMT+7
      </span>
    </div>
  )
}
