'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// ══ OVERSCROLL COLOUR ═════════════════════════════════════════════════════
// Pull past either end of a page — iOS bounce, a Mac trackpad's rubber band —
// and the browser paints the gap with the ROOT's background colour. Most pages
// never set one, so the gap was white; the ones that did set a single colour,
// which is wrong at one end whenever a cream page ends in the green footer.
//
// Rather than ask forty pages to declare their colours (and keep declaring
// them as they change), this reads what is actually painted at the document's
// top and bottom edges and gives <html> whichever one the reader is nearer.
// Only one colour can show at a time, so the swap happens mid-page, where
// neither gap can be seen.
//
// The meta theme-color follows the top colour too, so the browser bar on
// Android and older iOS Safari matches the page instead of a fixed green.

type RGBA = [number, number, number, number]
const FALLBACK = '#E5D4C2'

function parse(c: string): RGBA | null {
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
}

// Fixed and sticky layers (nav, ticker, tab bar, modal scrims) sit above the
// page and move with the viewport — they are not what the gap should match.
// The exception is an opaque full-screen fixed layer: that IS the ground.
function isOverlay(el: Element): boolean {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n)
    if (s.position !== 'fixed' && s.position !== 'sticky') continue
    const r = n.getBoundingClientRect()
    const bg = parse(s.backgroundColor)
    const opaqueGround = bg && bg[3] >= 0.99 && r.width >= innerWidth - 1 && r.height >= innerHeight - 1
    return !opaqueGround
  }
  return false
}

// The colour a person sees at a point: every background in the stack under
// it, composited, ignoring overlays and media (a photo has no one colour).
function colourAt(x: number, y: number): string | null {
  const layers: RGBA[] = []
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.documentElement) break
    if (isOverlay(el)) continue
    const bg = parse(getComputedStyle(el).backgroundColor)
    if (!bg || bg[3] === 0) continue
    layers.push(bg)
    if (bg[3] >= 0.99) break
  }
  if (!layers.length || layers[layers.length - 1][3] < 0.99) return null
  let [r, g, b] = layers[layers.length - 1]
  for (let i = layers.length - 2; i >= 0; i--) {
    const [lr, lg, lb, a] = layers[i]
    r = lr * a + r * (1 - a); g = lg * a + g * (1 - a); b = lb * a + b * (1 - a)
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

export default function OverscrollColour() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    let top: string | null = null
    let bottom: string | null = null
    let frame = 0
    let forced: 'top' | 'bottom' | null = null

    const apply = () => {
      frame = 0
      const y = scrollY
      const max = root.scrollHeight - innerHeight
      const docBottom = root.scrollHeight - y

      // Sample an edge whenever it is on screen — which is always before it
      // can be pulled past. 2px in from the left, clear of centred content.
      if (y <= 0) top = colourAt(2, 1 - y) ?? top
      if (docBottom <= innerHeight + 1) bottom = colourAt(2, Math.min(innerHeight, docBottom) - 2) ?? bottom

      // Mid-bounce (Safari reports it) or a wheel pulling at an edge settles it;
      // otherwise whichever end is nearer.
      const end =
        y < 0 ? 'top'
        : y > max && max >= 0 ? 'bottom'
        : forced ?? (max > 0 && y >= max / 2 ? 'bottom' : 'top')

      const colour = (end === 'bottom' ? bottom ?? top : top ?? bottom) ?? FALLBACK
      if (root.style.getPropertyValue('background-color') !== colour) {
        root.style.setProperty('background-color', colour, 'important')
      }
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta && top && meta.getAttribute('content') !== top) meta.setAttribute('content', top)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }

    // A page too short to scroll can still be rubber-banded both ways on a
    // Mac, and Chrome never reports it as scrolling — the wheel says which.
    const onWheel = (e: WheelEvent) => {
      const max = root.scrollHeight - innerHeight
      if (e.deltaY < 0 && scrollY <= 0) forced = 'top'
      else if (e.deltaY > 0 && scrollY >= max - 1) forced = 'bottom'
      else forced = null
      schedule()
    }
    const onScroll = () => { if (scrollY > 0 && scrollY < root.scrollHeight - innerHeight - 1) forced = null; schedule() }

    // Pages load their data after mount and grow; re-read when they do.
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('wheel', onWheel, { passive: true })
    addEventListener('resize', schedule)
    schedule()
    const late = setTimeout(schedule, 600)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(late)
      ro.disconnect()
      removeEventListener('scroll', onScroll)
      removeEventListener('wheel', onWheel)
      removeEventListener('resize', schedule)
    }
  }, [pathname])

  return null
}
