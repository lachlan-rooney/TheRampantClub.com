'use client'

import { useEffect, useRef, useState } from 'react'

// Soft warm glow that follows the cursor inside its container.
// Disabled on touch devices (no point) and respects prefers-reduced-motion.
export default function Spotlight({
  size = 360,
  color = 'rgba(229, 184, 90, 0.18)',
  zIndex = 1,
}: {
  size?: number
  color?: string
  zIndex?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const touch = window.matchMedia('(hover: none)').matches
    if (reduced || touch) { setEnabled(false); return }

    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
      el.style.opacity = '1'
    }
    const onLeave = () => { el.style.opacity = '0' }

    parent.addEventListener('mousemove', onMove)
    parent.addEventListener('mouseleave', onLeave)
    return () => {
      parent.removeEventListener('mousemove', onMove)
      parent.removeEventListener('mouseleave', onLeave)
    }
  }, [size])

  if (!enabled) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: size, height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.35s ease',
        mixBlendMode: 'plus-lighter',
        zIndex,
      }}
    />
  )
}
