'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// A DRAWN SIGNATURE, ON A FINGER, ON AN iPAD.  (2026-09-14, for the door.)
// ───────────────────────────────────────────────────────────────────────────
// Built fresh rather than lifted out of components/MembershipSigning.tsx. That
// canvas uses mouse + touch events and draws in raw canvas pixels; moving the
// membership signing onto a new primitive would put a legal signing flow at risk
// for a door tablet's benefit. It is left exactly as it was.
//
// Three things an iPad does to a naive canvas, and what this does about each:
//  1. Safari scrolls or zooms the page under a finger. `touch-action: none` on
//     the canvas, plus pointer capture, keeps the stroke on the pad.
//  2. A Retina screen blurs a 1x canvas. The backing store is sized to
//     devicePixelRatio and the context scaled, so ink is sharp.
//  3. Rotating the iPad resizes the canvas, and resizing a canvas CLEARS it —
//     a guest turns the tablet and their signature vanishes. Strokes are kept as
//     points normalised to the pad's size and redrawn on every resize.
//
// The exported PNG is re-rendered at a modest width (not the Retina backing
// store), so what is stored is a signature, not a screenshot.

export interface SignaturePadHandle {
  clear: () => void
  /** Total ink length in CSS pixels — a tap is not a signature. */
  inkLength: () => number
  /** PNG data URL on a transparent ground, at most `maxWidth` px wide. '' if blank. */
  toDataURL: (maxWidth?: number) => string
}

interface Props {
  ink?: string
  height?: number | string
  onInk?: (length: number) => void
  style?: React.CSSProperties
  ariaLabel?: string
}

type Pt = { x: number; y: number }     // 0..1 of the pad's width / height

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { ink = '#052E20', height = 260, onInk, style, ariaLabel = 'Signature' }, ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Pt[][]>([])
  const active = useRef<Pt[] | null>(null)
  const pointerId = useRef<number | null>(null)

  const cssSize = () => {
    const r = canvasRef.current?.getBoundingClientRect()
    return { w: r?.width || 1, h: r?.height || 1 }
  }

  const lineWidthFor = (w: number) => Math.max(2.2, Math.min(4, w / 220))

  const paint = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, list: Pt[][]) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = ink; ctx.fillStyle = ink
    ctx.lineWidth = lineWidthFor(w); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const s of list) {
      if (!s.length) continue
      if (s.length === 1) {
        ctx.beginPath(); ctx.arc(s[0].x * w, s[0].y * h, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue
      }
      ctx.beginPath(); ctx.moveTo(s[0].x * w, s[0].y * h)
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x * w, s[i].y * h)
      ctx.stroke()
    }
  }, [ink])

  const fit = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    const { w, h } = cssSize()
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, w, h, strokes.current)
  }, [paint])

  useEffect(() => {
    fit()
    const c = canvasRef.current
    const ro = typeof ResizeObserver !== 'undefined' && c ? new ResizeObserver(() => fit()) : null
    if (ro && c) ro.observe(c)
    window.addEventListener('orientationchange', fit)
    window.addEventListener('resize', fit)
    return () => { ro?.disconnect(); window.removeEventListener('orientationchange', fit); window.removeEventListener('resize', fit) }
  }, [fit])

  const inkLength = useCallback(() => {
    const { w, h } = cssSize()
    let len = 0
    for (const s of strokes.current) for (let i = 1; i < s.length; i++) len += Math.hypot((s[i].x - s[i - 1].x) * w, (s[i].y - s[i - 1].y) * h)
    return len
  }, [])

  useImperativeHandle(ref, () => ({
    clear: () => { strokes.current = []; active.current = null; fit(); onInk?.(0) },
    inkLength,
    toDataURL: (maxWidth = 600) => {
      if (!strokes.current.some(s => s.length)) return ''
      const { w, h } = cssSize()
      const scale = Math.min(1, maxWidth / w)
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(w * scale)); out.height = Math.max(1, Math.round(h * scale))
      const ctx = out.getContext('2d'); if (!ctx) return ''
      paint(ctx, out.width, out.height, strokes.current)
      try { return out.toDataURL('image/png') } catch { return '' }
    },
  }), [fit, inkLength, onInk, paint])

  const at = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== null) return           // one finger signs; a resting palm does not
    e.preventDefault()
    pointerId.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* older Safari */ }
    const s = [at(e)]
    active.current = s; strokes.current.push(s)
    fit()
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== e.pointerId || !active.current) return
    e.preventDefault()
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }
    const evs = native.getCoalescedEvents?.() || []
    if (evs.length) for (const ev of evs) active.current.push(at(ev))
    else active.current.push(at(e))
    const c = canvasRef.current, ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const { w, h } = cssSize()
    const s = active.current, n = s.length
    if (n < 2) return
    ctx.strokeStyle = ink; ctx.lineWidth = lineWidthFor(w); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    const from = Math.max(0, n - 1 - Math.max(1, evs.length))
    ctx.moveTo(s[from].x * w, s[from].y * h)
    for (let i = from + 1; i < n; i++) ctx.lineTo(s[i].x * w, s[i].y * h)
    ctx.stroke()
  }

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null; active.current = null
    onInk?.(inkLength())
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={e => e.preventDefault()}
      style={{
        display: 'block', width: '100%', height, touchAction: 'none', cursor: 'crosshair',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        ...style,
      } as React.CSSProperties}
    />
  )
})

export default SignaturePad
