'use client'

import { useMemo, useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE SELECTION AT A GLANCE — every cask as a point: age across, strength up.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "Is there any charts, cool designs … we can add in?"
//
// Fourteen rows of "Speyside · 15yo · 55%" are read one at a time; plotted,
// the same rows show what the list cannot — where the old casks are, which are
// still strong, which are gone. It is drawn entirely from the rows the list
// below is drawn from, so it can never show a cask the list does not have.
//
//   · each dot is filled with the cask's own colour (the swatch the list uses);
//   · a sold cask is an empty ring — still there, so the shape of the
//     selection stays honest, but plainly not choosable;
//   · the regions along the top filter it, and say how many each has;
//   · pointing at a dot names it; choosing one opens that cask in the list.
// ═══════════════════════════════════════════════════════════════════════════

const W = 1000, H = 380
const PAD = { l: 56, r: 24, t: 40, b: 50 }

export default function TetCaskChart({ casks, t, onPick }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
  onPick: (ref: string) => void
}) {
  const [region, setRegion] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const regions = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of casks) m.set(c.region, (m.get(c.region) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [casks])

  const scale = useMemo(() => {
    const ages = casks.map(c => c.age_years), abvs = casks.map(c => c.cask_abv_pct)
    const a0 = Math.floor(Math.min(...ages) - 1), a1 = Math.ceil(Math.max(...ages) + 1)
    const v0 = Math.floor(Math.min(...abvs) - 1), v1 = Math.ceil(Math.max(...abvs) + 1)
    return {
      a0, a1, v0, v1,
      x: (a: number) => PAD.l + ((a - a0) / (a1 - a0 || 1)) * (W - PAD.l - PAD.r),
      y: (v: number) => H - PAD.b - ((v - v0) / (v1 - v0 || 1)) * (H - PAD.t - PAD.b),
    }
  }, [casks])

  if (casks.length < 2) return null
  const { x, y, a0, a1, v0, v1 } = scale
  const ageTicks = Array.from({ length: a1 - a0 + 1 }, (_, i) => a0 + i).filter(a => a % 2 === 0)
  const abvTicks = Array.from({ length: v1 - v0 + 1 }, (_, i) => v0 + i).filter(v => v % 2 === 0)
  const hov = casks.find(c => c.cask_ref === hover) ?? null
  const byAge = [...casks].sort((a, b) => a.age_years - b.age_years)

  return (
    <div className="cc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cc-filter" role="group" aria-label={t('Filter by region', 'Lọc theo vùng')}>
        <button className={region === null ? 'is-on' : ''} onClick={() => setRegion(null)}>
          {t('All', 'Tất cả')} <span>{casks.length}</span>
        </button>
        {regions.map(([r, n]) => (
          <button key={r} className={region === r ? 'is-on' : ''} onClick={() => setRegion(p => (p === r ? null : r))}>
            {r} <span>{n}</span>
          </button>
        ))}
      </div>

      <div className="cc-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label={t('Every cask by age and strength', 'Mọi thùng theo tuổi và nồng độ')}>
          {abvTicks.map(v => (
            <g key={`v${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="cc-grid" />
              <text x={PAD.l - 12} y={y(v) + 4} textAnchor="end" className="cc-tick">{v}%</text>
            </g>
          ))}
          {ageTicks.map(a => (
            <text key={`a${a}`} x={x(a)} y={H - PAD.b + 22} textAnchor="middle" className="cc-tick">{a}</text>
          ))}
          <text x={W - PAD.r} y={H - 8} textAnchor="end" className="cc-axis">{t('years in the cask →', 'số năm trong thùng →')}</text>
          <text x={PAD.l} y={PAD.t - 10} textAnchor="start" className="cc-axis">↑ {t('strength', 'nồng độ')}</text>

          {byAge.map((c, i) => {
            const gone = c.status !== 'available'
            const dim = region !== null && c.region !== region
            const fill = c.colour_hex || GOLD
            return (
              <g key={c.cask_ref}
                 className={`cc-dot${dim ? ' is-dim' : ''}${hover === c.cask_ref ? ' is-hot' : ''}`}
                 style={{ ['--i' as string]: i }}
                 transform={`translate(${x(c.age_years)} ${y(c.cask_abv_pct)})`}
                 tabIndex={dim ? -1 : 0} role="button"
                 aria-label={`${c.cask_ref} · ${c.distillery} · ${c.age_years} · ${c.cask_abv_pct}%${gone ? ' · ' + t('sold', 'đã bán') : ''}`}
                 onPointerEnter={() => setHover(c.cask_ref)} onPointerLeave={() => setHover(null)}
                 onFocus={() => setHover(c.cask_ref)} onBlur={() => setHover(null)}
                 onClick={() => onPick(c.cask_ref)}
                 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(c.cask_ref) } }}>
                <circle r="22" className="cc-hit" />
                <g className="cc-mark">
                  <circle r="11" className="cc-halo" />
                  <circle r="8" fill={gone ? 'none' : fill} stroke={gone ? 'rgba(229,212,194,.55)' : 'rgba(255,244,214,.55)'} strokeWidth={gone ? 1.4 : 1} />
                </g>
              </g>
            )
          })}
        </svg>

        {hov && (
          <div className="cc-tip" style={{
            left: `${(x(hov.age_years) / W) * 100}%`, top: `${(y(hov.cask_abv_pct) / H) * 100}%`,
            ['--tx' as string]: x(hov.age_years) > W * 0.75 ? '-92%' : x(hov.age_years) < W * 0.25 ? '-8%' : '-50%',
          }}>
            <div className="cc-tip-ref">{hov.cask_ref}{hov.status !== 'available' && <span> · {t('sold', 'đã bán')}</span>}</div>
            <div className="cc-tip-name">{hov.distillery}</div>
            <div className="cc-tip-meta">{hov.region} · {hov.age_years}{t('yo', ' năm')} · {hov.cask_abv_pct}%</div>
            {hov.wood && <div className="cc-tip-meta">{hov.wood}</div>}
          </div>
        )}
      </div>

      <div className="cc-key">
        <span><i className="cc-k-full" /> {t('available', 'còn')}</span>
        <span><i className="cc-k-ring" /> {t('sold', 'đã bán')}</span>
        <span style={{ opacity: .7 }}>{t('Colour is the cask’s own · choose a dot to open it', 'Màu là màu của thùng · chọn một chấm để mở')}</span>
      </div>
    </div>
  )
}

const CSS = `
.cc { margin-top: 44px; }
.cc-filter { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-bottom: 18px; }
.cc-filter button { background: none; border: none; padding: 3px 0; cursor: pointer; font-family: ${MONO};
                    font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: rgba(229,212,194,.5);
                    border-bottom: 1px solid transparent; transition: color .2s ease, border-color .2s ease; }
.cc-filter button span { opacity: .6; margin-left: 4px; }
.cc-filter button:hover { color: #E5D4C2; }
.cc-filter button.is-on { color: ${GOLD}; border-bottom-color: ${GOLD}; }

.cc-plot { position: relative; }
.cc-plot svg { display: block; width: 100%; height: auto; overflow: visible; }
.cc-grid { stroke: rgba(229,212,194,.08); stroke-width: 1; }
.cc-tick { font-family: ${MONO}; font-size: 13px; fill: rgba(229,212,194,.42); }
.cc-axis { font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; fill: rgba(229,212,194,.35); }

.cc-dot { cursor: pointer; outline: none; }
.cc-hit { fill: transparent; }
.cc-mark { transform: scale(0); transform-box: fill-box; transform-origin: center;
           transition: transform .6s cubic-bezier(.34,1.7,.5,1), opacity .3s ease;
           transition-delay: calc(.2s + var(--i) * 70ms); }
.tr.is-in .cc-mark { transform: scale(1); }
.cc-halo { fill: none; stroke: ${GOLD}; stroke-width: 1.2; opacity: 0; transition: opacity .2s ease; }
.cc-dot.is-hot .cc-mark { transform: scale(1.35); transition-delay: 0s; }
.cc-dot.is-hot .cc-halo, .cc-dot:focus-visible .cc-halo { opacity: 1; }
.cc-dot.is-dim .cc-mark { opacity: .12; transition-delay: 0s; }
.cc-dot.is-dim { pointer-events: none; }

.cc-tip { position: absolute; transform: translate(var(--tx), calc(-100% - 20px)); pointer-events: none;
          min-width: 180px; padding: 12px 14px; border-radius: 3px; border-top: 2px solid ${GOLD};
          background: rgba(5,30,22,.95); box-shadow: 0 14px 34px rgba(0,0,0,.45); white-space: nowrap; }
.cc-tip-ref { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: rgba(229,212,194,.5); }
.cc-tip-name { font-family: 'Rampant Sans', Georgia, serif; font-size: 18px; margin-top: 4px; color: #E5D4C2; }
.cc-tip-meta { font-family: ${MONO}; font-size: 10.5px; margin-top: 4px; color: rgba(229,212,194,.65); }

.cc-key { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; font-family: ${MONO}; font-size: 10.5px;
          color: rgba(229,212,194,.5); align-items: center; }
.cc-key i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; vertical-align: -1px; margin-right: 5px; }
.cc-k-full { background: ${GOLD}; }
.cc-k-ring { border: 1.3px solid rgba(229,212,194,.6); }

@media (max-width: 640px) {
  .cc-tick { font-size: 22px; } .cc-axis { font-size: 20px; }
  /* The plot is drawn at a third of its size here; the dots are not. */
  .tr.is-in .cc-mark { transform: scale(1.8); }
  .cc-dot.is-hot .cc-mark { transform: scale(2.2); }
  .cc-tip { white-space: normal; min-width: 150px; }
}
@media (prefers-reduced-motion: reduce) {
  .cc-mark { transition: none; transform: none; }
}
`
