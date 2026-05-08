'use client'

import { useEffect, useRef, useState } from 'react'

// Listens for typed sequences anywhere on the page (outside inputs):
//   "RAMPANT" → flashes a toast with a club aphorism
//   "DRAM"    → fetches today's dram and shows it as a toast
//   "K"       → opens the kitchen page (existing)
//   "W"       → tries to play a pour sound if /sounds/pour.mp3 exists
//
// Buffer is reset on any non-letter key or after 1.4s of silence.

const APHORISMS = [
  'There are no whisky snobs here. Only enthusiasts.',
  'Pour for yourself. Stay as long as you like.',
  'Phones face down. Glasses face up.',
  'No menus. No measures. No permission required.',
  'A Rampant lion does not pour for show.',
  'You’re among Rampants now.',
]

interface Toast { id: number; text: string; sub?: string }

export default function useEasterEggs() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pourRef = useRef<HTMLAudioElement | null>(null)

  const pushToast = (text: string, sub?: string) => {
    const id = ++idRef.current
    setToasts(t => [...t, { id, text, sub }])
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id))
    }, 4200)
  }

  useEffect(() => {
    // Lazy: only construct audio if the file exists. We try once, fail silently.
    try {
      const pour = new Audio('/sounds/pour.mp3')
      pour.volume = 0.3
      pour.preload = 'none'
      pourRef.current = pour
    } catch { /* ignore */ }

    const reset = () => { bufferRef.current = ''; if (timerRef.current) clearTimeout(timerRef.current) }

    const checkBuffer = async () => {
      const b = bufferRef.current.toUpperCase()
      if (b.endsWith('RAMPANT')) {
        pushToast(APHORISMS[Math.floor(Math.random() * APHORISMS.length)], 'House aphorism')
        reset()
      } else if (b.endsWith('DRAM')) {
        try {
          const r = await fetch('/api/tonight')
          const d = await r.json()
          pushToast(d.dram?.label || 'Tonight’s dram', d.dram?.note || '')
        } catch {
          pushToast('Tonight’s dram', '—')
        }
        reset()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Single-key shortcuts (existing W, K).
      if (e.key === 'k' || e.key === 'K') {
        if (!bufferRef.current) window.location.href = '/kitchen'
      }
      if (e.key === 'w' || e.key === 'W') {
        if (!bufferRef.current && pourRef.current) {
          pourRef.current.currentTime = 0
          pourRef.current.play().catch(() => {})
        }
      }

      // Typed sequence detector (letters only).
      if (e.key.length === 1 && /[A-Za-z]/.test(e.key)) {
        bufferRef.current = (bufferRef.current + e.key).slice(-12)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(reset, 1400)
        checkBuffer()
      } else if (e.key !== 'Shift') {
        reset()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Toast renderer is intentionally inline so any page that calls this hook
  // gets the toasts without extra wiring.
  return toasts.length > 0 ? (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 24, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 99999, pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#052E20', color: '#E5D4C2',
          padding: '14px 22px', borderRadius: 8,
          fontFamily: "'Rampant Sans', 'Playfair Display', serif",
          fontSize: 15, fontStyle: 'italic',
          boxShadow: '0 16px 40px rgba(5,46,32,0.35)',
          maxWidth: 460, textAlign: 'center',
          border: '1px solid rgba(229,212,194,0.15)',
          animation: 'rampant-toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
          “{t.text}”
          {t.sub && (
            <div style={{
              fontFamily: "'Google Sans Code', monospace", fontSize: 10,
              fontStyle: 'normal', opacity: 0.6, letterSpacing: '0.08em',
              marginTop: 6, textTransform: 'uppercase',
            }}>{t.sub}</div>
          )}
        </div>
      ))}
      <style>{`
        @keyframes rampant-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  ) : null
}
