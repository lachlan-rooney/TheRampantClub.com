'use client'

import { useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import { SCOTLAND, SCOTLAND_PATH, project } from '@/lib/tet/scotland'
import { ATLAS_REGIONS } from '@/lib/whisky-atlas-data'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// WHERE THE CASKS COME FROM — Scotland, with each region lit by its count.
// ───────────────────────────────────────────────────────────────────────────
// The outline is real geography (lib/tet/scotland, from Natural Earth) and
// each region's marker sits at the coordinates the club's own atlas already
// uses (lib/whisky-atlas-data), so this map and /atlas agree. A marker's size
// is its number of casks; choosing one filters the chart and the colour ladder
// too — one question, "show me Islay", answered in three places.
//
// The English line under a region is the atlas's own; the Vietnamese beside it
// was written for this page (the atlas has none).
// ═══════════════════════════════════════════════════════════════════════════

// Highland's marker sits just west of Speyside's, so its label goes on the
// left, where the Great Glen is empty, instead of running into Speyside.
const LABEL_LEFT = new Set(['Highland', 'Islands'])

const VN: Record<string, string> = {
  Islay: 'Một hòn đảo nhỏ vùng Hebrides, nơi rượu malt sấy than bùn mang vị như biển cả ngay trong phòng.',
  Highland: 'Vùng lớn nhất và đa dạng nhất — whisky ven biển ở phía bắc, phong cách nhẹ hơn về phía nam, và gần như mọi thứ ở giữa.',
  Speyside: 'Tập trung dọc sông Spey. Đậm chất sherry, nhiều trái cây, và có nhiều nhà chưng cất hơn bất cứ nơi nào trên thế giới.',
  Campbeltown: 'Từng là thủ đô whisky của thế giới. Nay còn ba nhà chưng cất và một cộng đồng yêu mến — vị biển, béo, khói nhẹ.',
  Islands: 'Orkney, Skye, Mull, Arran, Jura, Lewis. Các nhà chưng cất rải rác khắp Bắc Đại Tây Dương, vừa giống vừa khác nhau.',
  Lowland: 'Nhẹ, hương cỏ, thường chưng cất ba lần. Đầu nhẹ nhàng của Scotch, dịu và hương hoa.',
}

export default function TetCaskMap({ casks, t, vn, region, onRegion }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
  vn: boolean
  region: string | null
  onRegion: (r: string | null) => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  const counts = new Map<string, { all: number; open: number }>()
  for (const c of casks) {
    const k = counts.get(c.region) ?? { all: 0, open: 0 }
    k.all++; if (c.status === 'available') k.open++
    counts.set(c.region, k)
  }
  const regions = ATLAS_REGIONS.filter(r => r.country === 'Scotland' && counts.has(r.key))
  // A region in the casks that the atlas does not place is listed, not drawn.
  const unplaced = [...counts.keys()].filter(k => !regions.some(r => r.key === k))
  if (!regions.length) return null
  const most = Math.max(...regions.map(r => counts.get(r.key)!.all))
  const shown = ATLAS_REGIONS.find(r => r.key === (hover ?? region)) ?? null

  return (
    <div className="cm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg className="cm-map" viewBox={`0 0 ${SCOTLAND.w} ${SCOTLAND.h}`}
           role="group" aria-label={t('Where the casks come from', 'Nguồn gốc các thùng')}>
        <path d={SCOTLAND_PATH} className="cm-land" />
        {regions.map((r, i) => {
          const [x, y] = project(r.lat, r.lng)
          const n = counts.get(r.key)!
          const rad = 10 + (n.all / most) * 26
          const on = region === r.key, dim = region !== null && !on
          return (
            <g key={r.key} className={`cm-pin${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}`}
               style={{ ['--i' as string]: i }} transform={`translate(${x} ${y})`}
               role="button" tabIndex={0} aria-pressed={on}
               aria-label={`${r.name}: ${n.all} ${t('casks', 'thùng')}`}
               onClick={() => onRegion(on ? null : r.key)}
               onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRegion(on ? null : r.key) } }}
               onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)}>
              <circle r={rad + 14} className="cm-hit" />
              <g className="cm-dot">
                <circle r={rad} className="cm-glow" />
                <circle r={rad * 0.42} className="cm-core" />
              </g>
              <text x={LABEL_LEFT.has(r.key) ? -(rad + 10) : rad + 10} y={5} className="cm-label"
                    textAnchor={LABEL_LEFT.has(r.key) ? 'end' : 'start'}>{r.name}</text>
              <text x={LABEL_LEFT.has(r.key) ? -(rad + 10) : rad + 10} y={27} className="cm-count"
                    textAnchor={LABEL_LEFT.has(r.key) ? 'end' : 'start'}>
                {n.all} {t(n.all === 1 ? 'cask' : 'casks', 'thùng')}{n.open < n.all ? ` · ${n.open} ${t('open', 'còn')}` : ''}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="cm-side">
        <div className="pk-eyebrow">{t('Where they come from', 'Nguồn gốc')}</div>
        {shown ? (
          <div className="cm-card" key={shown.key}>
            <div className="cm-name">{shown.name}{shown.native && <span> · {shown.native}</span>}</div>
            <p className="cm-blurb">{vn ? (VN[shown.key] ?? shown.blurb) : shown.blurb}</p>
            <div className="cm-dist">{t('Distilleries here include', 'Các nhà chưng cất trong vùng')}: {shown.distilleries.slice(0, 4).join(', ')}</div>
          </div>
        ) : (
          <p className="cm-blurb" style={{ opacity: .6 }}>
            {t('Choose a region to see its casks in the chart and on the colour ladder.',
               'Chọn một vùng để xem các thùng của vùng đó trên biểu đồ và thang màu.')}
          </p>
        )}
        {region && (
          <button className="cm-clear" onClick={() => onRegion(null)}>{t('Show every region', 'Xem tất cả các vùng')}</button>
        )}
        {unplaced.length > 0 && (
          <p className="cm-dist" style={{ marginTop: 14 }}>{t('Also:', 'Ngoài ra:')} {unplaced.map(u => `${u} ${counts.get(u)!.all}`).join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

const CSS = `
.cm { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: clamp(24px, 5vw, 72px);
      align-items: center; margin-top: 64px; }
.cm-map { display: block; width: 100%; height: auto; overflow: visible; }
.cm-land { fill: rgba(229,212,194,.06); stroke: rgba(229,212,194,.35); stroke-width: 1.1; stroke-linejoin: round; }
.cm-pin { cursor: pointer; outline: none; }
.cm-hit { fill: transparent; }
.cm-dot { transform: scale(0); transform-box: fill-box; transform-origin: center;
          transition: transform .7s cubic-bezier(.34,1.6,.5,1), opacity .3s ease; transition-delay: calc(.3s + var(--i) * .15s); }
.tr.is-in .cm-dot { transform: scale(1); }
.cm-glow { fill: rgba(212,184,90,.22); stroke: ${GOLD}; stroke-width: 1.2; }
.cm-core { fill: ${GOLD}; }
.cm-label { font-family: 'Rampant Sans', Georgia, serif; font-size: 24px; fill: #E5D4C2; }
.cm-count { font-family: ${MONO}; font-size: 15px; fill: rgba(229,212,194,.55); }
.cm-pin:hover .cm-glow, .cm-pin.is-on .cm-glow, .cm-pin:focus-visible .cm-glow { fill: rgba(212,184,90,.45); }
.cm-pin.is-on .cm-label { fill: ${GOLD}; }
.cm-pin.is-dim { opacity: .35; }
.cm-pin, .cm-pin text { transition: opacity .3s ease, fill .3s ease; }
.cm-side { align-self: center; }
.cm-card { animation: cm-in .45s cubic-bezier(.16,.84,.44,1); }
@keyframes cm-in { from { opacity: 0; transform: translateY(8px); } }
.cm-name { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(26px, 3.2vw, 38px); margin-top: 12px; color: ${GOLD}; }
.cm-name span { color: rgba(229,212,194,.5); font-size: .6em; }
.cm-blurb { font-family: ${MONO}; font-size: 12.5px; line-height: 1.85; margin: 12px 0 0; max-width: 460px; color: rgba(229,212,194,.8); }
.cm-dist { font-family: ${MONO}; font-size: 10.5px; margin-top: 12px; color: rgba(229,212,194,.45); }
.cm-clear { margin-top: 16px; background: none; border: none; padding: 0; cursor: pointer; font-family: ${MONO};
            font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${GOLD};
            border-bottom: 1px solid rgba(212,184,90,.5); }
@media (max-width: 720px) { .cm { grid-template-columns: 1fr; } .cm-map { max-width: 360px; } }
@media (prefers-reduced-motion: reduce) { .cm-dot { transition: none; transform: none; } .cm-card { animation: none; } }
`
