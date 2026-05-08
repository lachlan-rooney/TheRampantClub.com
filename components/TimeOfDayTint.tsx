'use client'

import { useEffect } from 'react'

// Subtle warm/cool tint overlay that shifts with the local hour in Sài Gòn.
// - 05–10 (morning):    cool, slightly desaturated
// - 11–16 (afternoon):  neutral
// - 17–20 (dusk):       warm amber wash
// - 21–04 (night):      deeper, dimmer
// Renders a fixed full-screen overlay at very low opacity so it never gets in
// the way of legibility.

const SAIGON_TZ = 'Asia/Ho_Chi_Minh'

function saigonHour(): number {
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: SAIGON_TZ })
  return parseInt(fmt.format(new Date()), 10) || 0
}

function tintFor(hour: number): { bg: string; opacity: number } {
  if (hour >= 21 || hour < 5)  return { bg: 'rgba(5,46,32,0.18)',     opacity: 1 }   // night
  if (hour >= 17)              return { bg: 'rgba(212,140,80,0.10)',  opacity: 1 }   // dusk
  if (hour >= 11)              return { bg: 'rgba(0,0,0,0)',          opacity: 0 }   // afternoon — no tint
  if (hour >= 5)               return { bg: 'rgba(180,200,210,0.06)', opacity: 1 }   // morning
  return { bg: 'rgba(0,0,0,0)', opacity: 0 }
}

export default function TimeOfDayTint() {
  useEffect(() => {
    const apply = () => {
      const { bg, opacity } = tintFor(saigonHour())
      const el = document.getElementById('rc-tint')
      if (!el) return
      el.style.background = bg
      el.style.opacity = String(opacity)
    }
    apply()
    const id = setInterval(apply, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      id="rc-tint"
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
        transition: 'background 1.5s ease, opacity 1.5s ease',
        zIndex: 9997,
      }}
    />
  )
}
