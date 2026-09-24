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
const DRIPS = 26

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
      <div className="hw-drips">{drips()}</div>
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
      ['--drip' as string]: `${18 + ((i * 7) % 30)}px`,
      // How far the strand still clinging to the edge reaches back up.
      ['--strand' as string]: `${26 + ((i * 11) % 44)}px`,
      ['--fall' as string]: `${2.1 + ((i * 13) % 9) / 10}s`,
    }} />
  ))
}

/** Drops that let go of the edge and run on down the page by themselves. */
function drips() {
  return Array.from({ length: DRIPS }, (_, i) => (
    <i key={i} style={{
      ['--x' as string]: `${(i * 97) % 100}%`,
      ['--s' as string]: `${0.55 + ((i * 17) % 10) / 10}`,
      ['--dur' as string]: `${1.5 + ((i * 7) % 9) / 10}s`,
      ['--wait' as string]: `${820 + ((i * 137) % 900)}ms`,
    }} />
  ))
}

const CSS = `
.hw { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
.hw-sheet { position: absolute; inset: 0; display: flex; }
.hw-sheet span {
  flex: 1 1 0; display: block; height: 100%; position: relative;
  /* The edge you watch is the TOP one, receding — so that is the edge that
     drips. Rounded there, the columns read as wax pulling away; rounded at
     the bottom (where I put it first) the shape is off-screen the whole time
     and the melt is a flat wipe. */
  border-radius: 46% 46% 0 0 / var(--drip) var(--drip) 0 0;
  transform-origin: 50% 0;
  /* Two animations, two properties, no quarrel: one paints, one moves. */
  animation: hw-flash .78s steps(1, end) both,
             hw-melt var(--fall) cubic-bezier(.45,.03,.3,1) calc(.78s + var(--lag)) both;
}

/* BLOOD, NOT A CURTAIN. Two things make the edge read as blood rather than as
   a shape sliding down: what CLINGS and what LETS GO.
   · the strand (::before) is the run still attached to the column — narrow,
     rounded at its head, reaching back up the page, retracting as the column
     falls. It carries the same filter as the column, so it is the same blood.
   · the drops are loose, and they are the real trick: they fall slower than
     the sheet, so they are seen against the club's own green after the edge
     has gone past, which is what a drip actually looks like. A point at the
     top and a round belly — a square with three corners rounded, turned
     45° — because border-radius alone can only make an egg. */
.hw-sheet span::before {
  content: ''; position: absolute; bottom: 100%; left: 34%;
  width: 32%; height: var(--strand);
  border-radius: 50% 50% 0 0 / 88% 88% 0 0;
  /* Fades out at the head, like the run it is. */
  mask-image: linear-gradient(to bottom, transparent, #000 58%);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 58%);
  transform-origin: 50% 100%;
  animation: hw-flash .78s steps(1, end) both,
             hw-strand var(--fall) cubic-bezier(.4,.05,.3,1) calc(.78s + var(--lag)) both;
}

.hw-drips { position: absolute; inset: 0; }
.hw-drips i {
  position: absolute; top: -12vh; left: var(--x);
  width: 13px; height: 62px;
  /* A run of blood, not a bead: narrow and near-square at the top where it is
     leaving the smear, heavy and round at the bottom where it is pooling. */
  border-radius: 46% 46% 50% 50% / 10% 10% 26% 26%;
  /* The top of the run fades out — that is the smear it has left behind on
     the way down, and it is what stops the drop reading as a floating blob. */
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.28) 22%, #000 62%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.28) 22%, #000 62%);
  backdrop-filter: grayscale(1) sepia(1) saturate(10) hue-rotate(-32deg) contrast(1.3) brightness(.62);
  animation: hw-drop var(--dur) cubic-bezier(.5,0,.85,.45) var(--wait) both;
}

/* It gathers, runs, and stretches thin as it picks up speed. */
@keyframes hw-drop {
  0%   { transform: translateY(0) scale(var(--s), calc(var(--s) * .6)); opacity: 0 }
  14%  { transform: translateY(12vh) scale(var(--s)); opacity: 1 }
  100% { transform: translateY(124vh) scale(calc(var(--s) * .82), calc(var(--s) * 1.7)); opacity: .9 }
}

/* The run still attached to the column, pulling back as it falls. */
@keyframes hw-strand {
  0%   { transform: scaleY(1) }
  55%  { transform: scaleY(.55) }
  100% { transform: scaleY(0); opacity: 0 }
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
  .hw-drips { display: none; }
  .hw-sheet span::before { display: none; }
  .hw-sheet span {
    animation: hw-wash .9s ease-out both;
    transform: none; border-radius: 0;
    backdrop-filter: grayscale(1) sepia(1) saturate(9) hue-rotate(-32deg) brightness(.85);
  }
  @keyframes hw-wash { 0% { opacity: 0 } 25% { opacity: 1 } 100% { opacity: 0 } }
}
`
