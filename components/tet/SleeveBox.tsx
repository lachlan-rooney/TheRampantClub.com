'use client'

import FoldedBox from '@/components/tet/FoldedBox'
import type { BoxFolds } from '@/lib/tet/boxes'

// ═══════════════════════════════════════════════════════════════════════════
// THE SLEEVE, FOLDED — the same artwork, made into the box it becomes.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "add a second clickable version of the customisable" —
// the flat dieline answers "where does my logo go"; this answers "what will
// they be holding".
//
// THE FOLDS WERE MEASURED FROM THE ARTWORK'S OUTLINE, column by column (the
// top edge of the opaque pixels in sleeve-3200.webp, scaled to the 6431 px
// master). It is a box with a sloping top:
//
//   x   32 – 490   a flap at the short height — it tucks inside, not shown
//   x  490 – 1780  END (warnings, barcode): top slopes UP from 613 to 16
//   x 1780 – 3453  FRONT (Chợ Bến Thành): full height, 16 – 2377
//   x 3453 – 4770  END (Duncan Taylor): top slopes DOWN from 16 to 611
//   x 4770 – 6415  THE BLANK FACE: 611 – 2343 — where the logo goes
//
// The two ends are the same depth (1290 and 1317) and the front and the blank
// face the same width (1673 and 1645), which is what says this reading of the
// folds is right: opposite faces of a box must match.
//
// THE FOLDING ITSELF NOW LIVES IN FoldedBox (2026-09-25), because twelve more
// covers arrived and every one of them has its own geometry. This file is what
// it always was — the sleeve's numbers and the sleeve's labels — and the
// checks in tests/tet/sleeve-ui.test.mjs are what say the move changed
// nothing a visitor can see.
// ═══════════════════════════════════════════════════════════════════════════

const SLEEVE_FOLDS: BoxFolds = {
  art: { w: 6431, h: 2387, top: 16, bottom: 2377 },
  faces: {
    endL:  { x: 490,  w: 1290 },
    front: { x: 1780, w: 1673 },
    endR:  { x: 3453, w: 1317 },
    back:  { x: 4770, w: 1645 },
  },
}
const BACK = SLEEVE_FOLDS.faces.back
const { top: TOP, bottom: BOTTOM } = SLEEVE_FOLDS.art

type Box = { x: number; y: number; w: number; h: number }

export default function SleeveBox({ logo, box, t }: {
  logo: string | null
  box: Box | null
  t: (en: string, vn: string) => string
}) {
  const logoOnBack = logo && box ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="sb-logo" style={{
      left: `${((box.x - BACK.x) / BACK.w) * 100}%`,
      top: `${((box.y - TOP) / (BOTTOM - TOP)) * 100}%`,
      width: `${(box.w / BACK.w) * 100}%`,
      height: `${(box.h / (BOTTOM - TOP)) * 100}%`,
    }} />
  ) : null

  return (
    <FoldedBox
      url="/images/tet/sleeve-3200.webp"
      folds={SLEEVE_FOLDS}
      onBack={logoOnBack}
      // It arrives turning to the face with the logo — the point of the view.
      settleAt={200}
      label={t('The sleeve folded into its box — drag to turn it', 'Hộp đã gấp — kéo để xoay')}
      hint={t('or drag to turn it', 'hoặc kéo để xoay')}
      turns={[
        { label: t('Chợ Bến Thành', 'Chợ Bến Thành'), to: 0 },
        { label: t('Duncan Taylor end', 'Mặt Duncan Taylor'), to: -90 },
        { label: t('Your face', 'Mặt của quý vị'), to: 180, gold: true },
        { label: t('Back end', 'Mặt sau'), to: 90 },
      ]}
    />
  )
}
