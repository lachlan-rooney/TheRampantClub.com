import type { CSSProperties } from 'react'
import { InkFloat, type Ink } from './kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE INK, RE-INKED FOR GREEN.
// ───────────────────────────────────────────────────────────────────────────
// The house drawings are black line with an orange wash, drawn for the cream
// ground. Put one on bottle green and the line — which is most of the drawing —
// disappears, leaving loose orange shapes. This re-inks it in the browser:
// black line → cream, the orange wash stays orange. No second set of files.
//
// Every pixel in the set is either black or the orange, so the red channel
// alone says which one it is (0 for the line, ~.95 for the wash); the matrix
// maps red=0 to cream #E5D4C2 and red=.95 to the orange (.95,.55,.14).
// sRGB interpolation, or the numbers mean something else.
//
// Render <CreamInkDefs /> once on a page, then use <CreamInk> like <InkFloat>.

const MATRIX = [
  ' 0.055 0 0 0 0.898',
  '-0.291 0 0 0 0.831',
  '-0.657 0 0 0 0.761',
  ' 0     0 0 1 0',
].join(' ')

export function CreamInkDefs() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0"
         style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`.pk-float.pk-cream img { filter: url(#pk-cream-ink) drop-shadow(5px 10px 10px rgba(0,0,0,.18)); }`}</style>
      <filter id="pk-cream-ink" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={MATRIX} />
      </filter>
    </svg>
  )
}

export function CreamInk({ className = '', ...rest }: {
  name: Ink; width: string | number; rot?: number; dur?: number; style?: CSSProperties; className?: string
}) {
  return <InkFloat className={`pk-cream ${className}`} {...rest} />
}
