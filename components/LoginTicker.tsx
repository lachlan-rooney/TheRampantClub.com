'use client'

import { useEffect, useState, useCallback } from 'react'

const DRAMS = [
  'Dram of the day: The Octave 2011 Glentauchers — neat, obviously',
  'Dram of the day: Duncan Taylor "An Islay" 16 — the peat speaks for itself',
  'Dram of the day: Highland Park 18 — a drop of water permitted',
  'Dram of the day: Ardbeg Uigeadail — not for the faint-hearted',
]

const OTHER_QUIPS = [
  // Now playing in The Rampant Room
  'Now playing in The Rampant Room: Coltrane — A Love Supreme (Side B)',
  'Now playing in The Rampant Room: Safe Mind — 6\' Pole',
  'Now playing in The Library Bar Room: Boy Harsher — Tears',
  'Now playing in The Rampant Room: Nujabes — Feather',
  'Now playing in The Rampant Room: Tinariwen — Chet Boghassa',

  // The Library
  'Days since someone fell asleep in the Library: 2',
  'A member has been swirling the same cognac for 32 minutes. We are monitoring the situation.',
  'Days since a dram debate exceeded 45 minutes: 1',

  // Operations & quips
  'Whisky bottles open in The Rampant Room: 279 (and counting)',
  'The oat milk situation has been resolved',
  'Lost property: Miss Tran\'s tasteful cashmere scarf, Mr Minh\'s awful gucci wallet',
  'The Wi-Fi password remains unchanged. Please stop asking.',
  'Car park: one Janus, two xe máy, one suspiciously nice bicycle',
  'The Committee reminds members that "just one more" IS a binding agreement',
  'Dress code update: socks with sandals now a disciplinary matter',
  'A member has requested we stock Hendrick\'s. The request is under review.',
  'Book club postponed. No one finished their books. Again.',
  'The espresso machine is not "broken". You are using it wrong.',
  'Lost: one leather bookmark, sentimental value inferred',
  'The suggestion box has been emptied. Most suggestions were unhelpful.',
  'Tonight\'s conversation topic: "Is Islay overrated?" (It is not.)',
  'The bees on the rooftop are doing well. Not that you give a buzz.',
  'The Chairman\'s dram is not available to non-Chairmen... Unless you ask nicely.',
  'The cà phê sữa đá is not a substitute for the Dram of the Day. We have discussed this...',
  'Rainy Season countdown... 2 damn soon.',
  'A gecko has been found in The Elevator. He has been granted temporary membership.',
  'Thunder over District 1. The vinyl has been turned up accordingly.',
]

// Pick one dram per day based on date, then combine with other quips
function getDailyDram(): string {
  const now = new Date()
  const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24))
  return DRAMS[daysSinceEpoch % DRAMS.length]
}

const QUIPS = [getDailyDram(), ...OTHER_QUIPS]

export default function LoginTicker() {
  const [time, setTime] = useState('')
  const [temp, setTemp] = useState<number | null>(null)
  const [quipIndex, setQuipIndex] = useState(0)
  const [quipVisible, setQuipVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setQuipIndex(Math.floor(Math.random() * QUIPS.length))
    setMounted(true)
  }, [])

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      }).format(new Date())
      setTime(now)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Real temperature from Open-Meteo
  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=10.776&longitude=106.701&current_weather=true'
    )
      .then(r => r.json())
      .then(d => setTemp(Math.round(d.current_weather.temperature)))
      .catch(() => setTemp(31))
  }, [])

  // Rotate quips every 12 seconds with fade
  const rotateQuip = useCallback(() => {
    setQuipVisible(false)
    setTimeout(() => {
      setQuipIndex(prev => {
        const prevQuip = QUIPS[prev]
        const prevIsNowPlaying = prevQuip.startsWith('Now playing')
        let next = prev
        let attempts = 0
        while (attempts < 50) {
          next = Math.floor(Math.random() * QUIPS.length)
          if (next === prev) { attempts++; continue }
          if (prevIsNowPlaying && QUIPS[next].startsWith('Now playing')) { attempts++; continue }
          break
        }
        return next
      })
      setQuipVisible(true)
    }, 400)
  }, [])

  useEffect(() => {
    const id = setInterval(rotateQuip, 8000)
    return () => clearInterval(id)
  }, [rotateQuip])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        fontFamily: "'Google Sans Code', 'DM Mono', monospace",
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'var(--trc-cream, #E5D4C2)',
        opacity: 0.4,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: '12px 20px',
        borderBottom: '1px solid rgba(229,212,194,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Clock + temp */}
      <span style={{ whiteSpace: 'nowrap' }}>
        {temp !== null ? `${temp}°C` : '—'} &nbsp;|&nbsp; {time || '—'} GMT+7
      </span>

      {/* Diamond separator */}
      <span
        style={{
          display: 'inline-block',
          width: 4,
          height: 4,
          background: 'var(--trc-cream, #E5D4C2)',
          transform: 'rotate(45deg)',
          opacity: 0.4,
          flexShrink: 0,
        }}
      />

      {/* Rotating quip */}
      <span
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: quipVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        {mounted ? QUIPS[quipIndex] : ''}
      </span>
    </div>
  )
}
