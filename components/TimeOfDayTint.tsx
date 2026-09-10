'use client'

import { useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// NOT MOUNTED ANYWHERE. This is a record, not a plan.
// ───────────────────────────────────────────────────────────────────────────
// This was the homepage's time-of-day tint until 2026-09-10. It is kept because
// it is a genuine idea someone built on purpose, and deleting it would lose the
// reasoning — not because it is expected back.
//
// WHY IT CAME OFF: the homepage now shows plain block colour, matching /studio
// and the admin portal — authored colour with nothing on top. This overlay,
// with the vignette and the paper grain, took #E5D4C2 to rgb(208,196,179) and
// its warmth from 35 to 28. Multiplying bottle green over a warm cream
// desaturates it, which reads as dull rather than dark.
//
// BE CLEAR ABOUT WHAT WAS RETIRED: the tint switched off between 11:00 and
// 16:00 Sài Gòn, so the page genuinely changed character through the day and
// nothing on screen said why. On a plain homepage that idea has nowhere left to
// live. It is retired, not parked. If a future surface wants it — a room
// display, a kiosk, something that is meant to feel the hour — this file is
// where it starts, and it works as written.
//
// TO RESTORE: import it and mount it in app/page.tsx; see the note there.
// ═══════════════════════════════════════════════════════════════════════════

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
  // Night was 0.18 and it was flattening the ground it sat on: multiply against
  // the club's own bottle green took #B0C18E from rgb(176,193,142) to
  // rgb(145,164,121) — 31 points, on a colour chosen carefully. Halved. The tint
  // itself stays: a club that goes dark and quiet in the evening is the
  // building's character, and the page should carry that. Dusk and morning are
  // left alone — they were already subtle, and warm amber does not flatten the
  // way bottle-green-on-green does.
  if (hour >= 21 || hour < 5)  return { bg: 'rgba(5,46,32,0.09)',     opacity: 1 }   // night
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
