'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// ═══════════════════════════════════════════════════════════════════════════
// THE HAUNTING — what putting your name down for Halloween looks like.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-24: "when people click Sign up for the Halloween party I want
// the colour to flash invert black and red instead of the usual colours of the
// page, then slowly melt away."
//
// IT DOES NOT REPAINT ANYTHING. The club's colours stay where they are; a
// sheet of columns sits over the page for three seconds and FILTERS WHAT IS
// BEHIND IT (backdrop-filter): first an invert, so the green goes pale and
// the cream goes ink, blinking; then black and red — grey, sepia, turned to
// blood and darkened — which is what melts away.
//
// TWO THINGS I TRIED FIRST, WRITTEN DOWN SO NOBODY TRIES THEM AGAIN:
//   · mix-blend-mode (white on `difference`, red on `color`). Correct in
//     theory and a flat red curtain in practice: an element blends with the
//     nearest ancestor that makes a stacking context, and both the overlay
//     (z-index) and each sheet (an opacity animation) make one, so the
//     columns blended with an empty group instead of the page.
//   · a `filter` on <html>. One line, and it makes <html> a containing block,
//     which traps every position:fixed thing on these pages — the trap
//     already written up for the member modals.
// backdrop-filter answers to neither: it filters the backdrop wherever the
// element ends up in the paint order.
//
// THE COLUMNS ARE THERE SO IT CAN MELT. Flash first (hard steps, no fade),
// then each column runs down the screen on its own delay and stretches as it
// goes, the way wax does. Rounded bottoms so the edge drips rather than wipes.
//
// It is aria-hidden and pointer-events: none from first frame to last: it is
// weather, not furniture. Nothing waits for it — the sign-up already went
// through before this mounts, and unmounting it mid-flight costs nothing.
//
// REDUCED MOTION gets one short red wash and no melt. Somebody who has asked
// the machine to stop moving has not asked for a strobe.
// ═══════════════════════════════════════════════════════════════════════════

/** Long enough for the last column to leave the screen. */
export const HAUNT_MS = 3400
const COLUMNS = 22

export default function HauntFlash({ onDone }: { onDone?: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!onDone) return
    const id = setTimeout(onDone, HAUNT_MS)
    return () => clearTimeout(id)
  }, [onDone])

  if (!mounted) return null
  // Portalled to the body: MemberPage carries a transform, and a fixed child
  // of a transformed ancestor is positioned against THAT, not the viewport.
  return createPortal(
    <div className="hw" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hw-sheet">{cols()}</div>
    </div>,
    document.body,
  )
}

function cols() {
  return Array.from({ length: COLUMNS }, (_, i) => (
    <span key={i} style={{
      // Each column leaves on its own beat, and the drip on its underside is
      // its own size — a straight line of identical teeth reads as a wipe.
      ['--i' as string]: i,
      ['--lag' as string]: `${(i % 2 ? i : COLUMNS - i) * 46}ms`,
      ['--drip' as string]: `${14 + ((i * 7) % 26)}px`,
      ['--fall' as string]: `${2.1 + ((i * 13) % 9) / 10}s`,
    }} />
  ))
}

const CSS = `
.hw { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
.hw-sheet { position: absolute; inset: 0; display: flex; }
.hw-sheet span {
  flex: 1 1 0; display: block; height: 100%;
  /* The edge you watch is the TOP one, receding — so that is the edge that
     drips. Rounded there, the columns read as wax pulling away; rounded at
     the bottom (where I put it first) the shape is off-screen the whole time
     and the melt is a flat wipe. */
  border-radius: 44% 44% 0 0 / var(--drip) var(--drip) 0 0;
  transform-origin: 50% 0;
  /* Two animations, two properties, no quarrel: one paints, one moves. */
  animation: hw-flash .78s steps(1, end) both,
             hw-melt var(--fall) cubic-bezier(.45,.03,.3,1) calc(.78s + var(--lag)) both;
}

/* THE FLASH IS THE INVERT, TWICE OVER. Two states, and the page's own colours
   are in neither: black with red on it, and its exact negative, red with black
   on it. Three hard beats between them — no fade, because a flash that fades
   is a glow — and then it settles on the dark one and that is what melts.

   The red state is a red WASH over an inverted backdrop rather than a filter
   recipe: sepia and hue-rotate cannot drag a near-white backdrop to red (they
   land on amber, then on magenta if you push the saturation), and an inverted
   dark page is near-white by definition. */
@keyframes hw-flash {
  0%, 11%  { backdrop-filter: grayscale(1) invert(1) contrast(1.35) brightness(1.05);
             background: rgba(176, 6, 14, .66); }
  12%, 23% { backdrop-filter: grayscale(1) sepia(1) saturate(9) hue-rotate(-32deg) contrast(1.25) brightness(.78);
             background: transparent; }
  24%, 35% { backdrop-filter: grayscale(1) invert(1) contrast(1.35) brightness(1.05);
             background: rgba(176, 6, 14, .66); }
  36%, 47% { backdrop-filter: grayscale(1) sepia(1) saturate(9) hue-rotate(-32deg) contrast(1.25) brightness(.78);
             background: transparent; }
  48%      { backdrop-filter: grayscale(1) invert(1) contrast(1.35) brightness(1.05);
             background: rgba(176, 6, 14, .66); }
  60%, 100%{ backdrop-filter: grayscale(1) sepia(1) saturate(9) hue-rotate(-32deg) contrast(1.25) brightness(.78);
             background: transparent; }
}

/* Down the screen, stretching as it goes, gone before it lands. */
@keyframes hw-melt {
  0%   { transform: translateY(0) scaleY(1); opacity: 1 }
  18%  { transform: translateY(4%) scaleY(1.06); opacity: 1 }
  100% { transform: translateY(112%) scaleY(1.5); opacity: 0 }
}

/* Where the backdrop cannot be filtered, the sheet still passes over as a
   dark red shadow rather than doing nothing at all. */
@supports not (backdrop-filter: invert(1)) {
  .hw-sheet span { background: rgba(140, 8, 16, .72); }
}

@media (prefers-reduced-motion: reduce) {
  .hw-sheet span {
    animation: hw-wash .9s ease-out both;
    transform: none; border-radius: 0;
    backdrop-filter: grayscale(1) sepia(1) saturate(9) hue-rotate(-32deg) brightness(.85);
  }
  @keyframes hw-wash { 0% { opacity: 0 } 25% { opacity: 1 } 100% { opacity: 0 } }
}
`
