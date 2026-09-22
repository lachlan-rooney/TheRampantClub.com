'use client'

import { useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import { caskColour, SRM_LADDER, EBC_IS_ESTIMATED } from '@/lib/tet/colour'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE COLOUR LADDER — every cask placed on the SRM scale, pale to dark.
// ───────────────────────────────────────────────────────────────────────────
// The owner asked for "the spectrometer beer scale" on each cask; each row
// already prints its ≈ EBC. This is the same number for the whole selection
// at once: the published SRM ladder (lib/tet/colour, the same table the
// numbers come from) as one strip, and each cask a mark at its own rung.
//
// It inherits the number's honesty rule: the value is estimated from the
// cask's display swatch, not measured, and the strip says so while
// EBC_IS_ESTIMATED is true. Casks with no colour are left off rather than
// placed at 1.
// ═══════════════════════════════════════════════════════════════════════════

export default function TetColourLadder({ casks, t, onPick, region }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
  onPick: (ref: string) => void
  region: string | null
}) {
  const [hover, setHover] = useState<string | null>(null)
  const placed = casks
    .map(c => ({ c, col: caskColour(c.colour_hex) }))
    .filter((p): p is { c: CaskBoardRow; col: NonNullable<ReturnType<typeof caskColour>> } => !!p.col)
    .sort((a, b) => a.col.srm - b.col.srm)
  if (!placed.length) return null

  const at = (srm: number) => ((srm - 0.5) / SRM_LADDER.length) * 100
  // Casks on the same rung stack upward instead of hiding each other.
  const seen = new Map<number, number>()
  const marks = placed.map(p => {
    const n = seen.get(p.col.srm) ?? 0; seen.set(p.col.srm, n + 1)
    return { ...p, stack: n }
  })
  const hov = marks.find(m => m.c.cask_ref === hover)

  return (
    <div className="cl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cl-head">
        <span className="pk-eyebrow">{t('Colour, pale to dark', 'Màu, từ nhạt đến đậm')}</span>
        <span className="cl-note">
          {EBC_IS_ESTIMATED
            ? t('SRM scale · estimated from each cask’s swatch', 'Thang SRM · ước tính từ mẫu màu của từng thùng')
            : t('SRM scale · measured at Huntly', 'Thang SRM · đo tại Huntly')}
        </span>
      </div>
      <div className="cl-track">
        {marks.map(({ c, col, stack }, i) => {
          const dim = region !== null && c.region !== region
          return (
            <button key={c.cask_ref} type="button"
                    className={`cl-mark${dim ? ' is-dim' : ''}${hover === c.cask_ref ? ' is-hot' : ''}${c.status !== 'available' ? ' is-gone' : ''}`}
                    style={{ left: `${at(col.srm)}%`, bottom: 30 + stack * 20, ['--i' as string]: i, ['--c' as string]: c.colour_hex ?? GOLD }}
                    aria-label={`${c.cask_ref} · ≈ ${col.ebc} EBC · ${col.srm} SRM`}
                    onPointerEnter={() => setHover(c.cask_ref)} onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(c.cask_ref)} onBlur={() => setHover(null)}
                    onClick={() => onPick(c.cask_ref)} tabIndex={dim ? -1 : 0} />
          )
        })}
        <div className="cl-strip" style={{
          background: `linear-gradient(to right, ${SRM_LADDER.map((r, i) => `${r.hex} ${(i / (SRM_LADDER.length - 1)) * 100}%`).join(', ')})`,
        }} />
        <div className="cl-ticks">
          {[1, 5, 10, 15, 20, 25, 30, 35, 40].map(n => (
            <span key={n} style={{ left: `${at(n)}%` }}>{n}</span>
          ))}
        </div>
        {hov && (
          <div className="cl-tip" style={{ left: `${at(hov.col.srm)}%`, bottom: 58 + hov.stack * 20,
                                           ['--tx' as string]: at(hov.col.srm) > 75 ? '-90%' : at(hov.col.srm) < 25 ? '-10%' : '-50%' }}>
            <b>{hov.c.cask_ref}</b> · {hov.c.distillery}<br />
            ≈ {hov.col.ebc} EBC · {hov.col.srm} SRM · {hov.c.wood ?? hov.c.cask_type}
          </div>
        )}
      </div>
    </div>
  )
}

const CSS = `
.cl { margin-top: 56px; }
.cl-head { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: baseline; }
.cl-note { font-family: ${MONO}; font-size: 10.5px; color: rgba(229,212,194,.4); }
.cl-track { position: relative; height: 150px; margin-top: 8px; }
.cl-strip { position: absolute; left: 0; right: 0; bottom: 22px; height: 10px; border-radius: 5px; }
.cl-ticks span { position: absolute; bottom: 0; transform: translateX(-50%); font-family: ${MONO}; font-size: 10px;
                 color: rgba(229,212,194,.38); }
.cl-mark { position: absolute; width: 16px; height: 16px; margin-left: -8px; padding: 0; border-radius: 50%;
           background: var(--c); border: 1.5px solid rgba(255,244,214,.7); cursor: pointer;
           opacity: 0; transform: translateY(12px) scale(.4);
           transition: transform .55s cubic-bezier(.34,1.6,.5,1), opacity .4s ease;
           transition-delay: calc(.1s + var(--i) * 55ms); }
.cl-mark::after { content: ''; position: absolute; left: 50%; top: 100%; width: 1px; height: 8px; background: rgba(229,212,194,.3); }
.tr.is-in .cl-mark { opacity: 1; transform: none; }
.cl-mark.is-gone { background: transparent; border-color: rgba(229,212,194,.5); }
.cl-mark.is-hot { transform: scale(1.35); transition-delay: 0s; box-shadow: 0 0 0 3px rgba(212,184,90,.5); }
.cl-mark.is-dim { opacity: .12 !important; pointer-events: none; transition-delay: 0s; }
.cl-mark:focus-visible { outline: none; box-shadow: 0 0 0 3px ${GOLD}; }
.cl-tip { position: absolute; transform: translateX(var(--tx)); pointer-events: none; white-space: nowrap;
          font-family: ${MONO}; font-size: 10.5px; line-height: 1.7; color: rgba(229,212,194,.8);
          padding: 9px 12px; border-radius: 3px; border-top: 2px solid ${GOLD}; background: rgba(5,30,22,.95);
          box-shadow: 0 12px 30px rgba(0,0,0,.45); }
.cl-tip b { color: #E5D4C2; font-weight: 500; }
@media (prefers-reduced-motion: reduce) { .cl-mark { transition: none; opacity: 1; transform: none; } }
`
