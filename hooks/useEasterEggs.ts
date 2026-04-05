'use client'

import { useEffect, useRef } from 'react'

export default function useEasterEggs() {
  const pourRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const pour = new Audio('/sounds/pour.mp3')
    pour.volume = 0.3
    pour.preload = 'auto'
    pourRef.current = pour

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'w' || e.key === 'W') {
        if (pourRef.current) {
          pourRef.current.currentTime = 0
          pourRef.current.play().catch(() => {})
        }
      }

      if (e.key === 'k' || e.key === 'K') {
        window.location.href = '/kitchen'
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
