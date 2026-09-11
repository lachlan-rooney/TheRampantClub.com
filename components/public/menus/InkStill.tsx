'use client'

import type { CSSProperties } from 'react'
import { InkFloat, type Ink } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// A STILL LIFE — a few of the house's ink drawings left on a table.
// ───────────────────────────────────────────────────────────────────────────
// The homepage hero's arrangement, made reusable for the menus and the
// kitchen: a box of a fixed aspect, each drawing placed by percentage so the
// composition holds at any width, each one drifting on its own clock. Purely
// decorative — aria-hidden, and the kit's InkFloat already honours reduced
// motion.

export interface StillObject {
  name: Ink
  w: string          // width, % of the box
  top: string
  left: string
  rot?: number
  dur?: number
  z?: number
}

export default function InkStill({ objects, aspect = '1 / 0.92', style, className = '' }: {
  objects: StillObject[]; aspect?: string; style?: CSSProperties; className?: string
}) {
  return (
    <div className={`ink-still ${className}`} aria-hidden="true"
         style={{ position: 'relative', width: '100%', aspectRatio: aspect, ...style }}>
      {objects.map(o => (
        <div key={o.name} style={{ position: 'absolute', width: o.w, top: o.top, left: o.left, zIndex: o.z ?? 1 }}>
          <InkFloat name={o.name} width="100%" rot={o.rot ?? -4} dur={o.dur ?? 8} />
        </div>
      ))}
    </div>
  )
}
