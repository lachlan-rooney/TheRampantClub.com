'use client'

import { useMemo, useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import { SCOTLAND, SCOTLAND_PATH, project } from '@/lib/tet/scotland'
import { ATLAS_REGIONS } from '@/lib/whisky-atlas-data'
import { DISTILLERIES, UNDISCLOSED } from '@/lib/tet/distilleries'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// WHERE THE CASKS COME FROM — Scotland, with every distillery on it.
// ───────────────────────────────────────────────────────────────────────────
// The outline is real geography (lib/tet/scotland, from Natural Earth).
//
// IT SHOWS DISTILLERIES NOW, not regions (owner asked, 2026-09-24, whether it
// did — it did not). A pin per region answers "how many Speyside casks"; a
// buyer looking at a named distillery is asking where that whisky is from.
// Coordinates come from Wikidata, one row per distillery, in
// lib/tet/distilleries — including the trap that Wikidata's "Glenrothes" is
// the town in Fife and not the distillery in Moray.
//
// TWO CASKS CANNOT BE PINNED: Burnside is a Speyside blended malt under a
// trade name and the Islay is undisclosed by definition. They sit at their
// region, are drawn hollow, and say why. Guessing at a distillery to make the
// map tidier would put a claim on the page that Duncan Taylor never made.
//
// Choosing a pin still filters the chart and the colour ladder — one question,
// "show me Islay", answered in three places.
//
// The English line under a region is the atlas's own; the Vietnamese beside it
// was written for this page (the atlas has none).
// ═══════════════════════════════════════════════════════════════════════════

// Highland's marker sits just west of Speyside's, so its label goes on the
// left, where the Great Glen is empty, instead of running into Speyside.
const LABEL_LEFT = new Set(['Highland', 'Islands'])

// The furthest a pin may be shifted from its true coordinate to stop it
// hiding under a neighbour. At this projection it is a few miles.
const NUDGE_MAX = 9

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
  // One pin per distillery, with its casks counted onto it.
  const places = useMemo(() => {
    const byName = new Map<string, { name: string; region: string; casks: CaskBoardRow[] }>()
    for (const c of casks) {
      const g = byName.get(c.distillery) ?? { name: c.distillery, region: c.region, casks: [] }
      g.casks.push(c); byName.set(c.distillery, g)
    }
    return [...byName.values()].map(g => {
      const at = DISTILLERIES[g.name]
      const fallback = ATLAS_REGIONS.find(r => r.key === g.region)
      const undisclosed = UNDISCLOSED[g.name]
      if (!at && !fallback) return null
      return {
        ...g,
        lat: at?.lat ?? fallback!.lat,
        lng: at?.lng ?? fallback!.lng,
        pinned: !!at,
        approximate: !!at?.approximate,
        why: undisclosed,
        bottles: g.casks.reduce((n, c) => n + (c.bottles_cask_strength ?? 0), 0),
        open: g.casks.filter(c => c.status === 'available').length,
      }
    }).filter(Boolean) as {
      name: string; region: string; casks: CaskBoardRow[]; lat: number; lng: number
      pinned: boolean; approximate: boolean; why?: [string, string]; bottles: number; open: number
    }[]
  }, [casks])

  // ── PINS THAT CAN BE POINTED AT ─────────────────────────────────────────
  // Six of these distilleries stand within a few miles of one another on
  // Speyside, so at this scale their circles land on top of each other and the
  // one underneath can never be hovered: Craigellachie sat beneath Glenrothes
  // and only the list beside the map could reach it. A few passes push
  // overlapping pins apart along the line between them, then every pin is
  // pulled back to within NUDGE_MAX of where its distillery actually stands,
  // so the map never moves a distillery more than a few miles to make room.
  const laid = useMemo(() => {
    const most = Math.max(1, ...places.map(p => p.casks.length))
    const pts = places.map(pl => {
      const [x, y] = project(pl.lat, pl.lng)
      return { pl, x, y, ox: x, oy: y, rad: 5 + (pl.casks.length / most) * 7 }
    })
    for (let pass = 0; pass < 40; pass++) {
      let moved = false
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          const p = pts[a], q = pts[b]
          const need = p.rad + q.rad + 3
          let dx = q.x - p.x, dy = q.y - p.y
          let d = Math.hypot(dx, dy)
          if (d >= need) continue
          if (d < 0.001) { dx = a % 2 ? 1 : -1; dy = 1; d = Math.hypot(dx, dy) }
          const push = (need - d) / 2, ux = dx / d, uy = dy / d
          p.x -= ux * push; p.y -= uy * push
          q.x += ux * push; q.y += uy * push
          moved = true
        }
      }
      if (!moved) break
    }
    for (const p of pts) {
      const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.hypot(dx, dy)
      if (d > NUDGE_MAX) { p.x = p.ox + (dx / d) * NUDGE_MAX; p.y = p.oy + (dy / d) * NUDGE_MAX }
    }
    return pts
  }, [places])

  const regions = ATLAS_REGIONS.filter(r => r.country === 'Scotland' && counts.has(r.key))
  const unplaced = [...counts.keys()].filter(k => !regions.some(r => r.key === k))
  if (!places.length) return null
  const shownRegion = ATLAS_REGIONS.find(r => r.key === (hover ?? region)) ?? null
  const shownPlace = places.find(p => p.name === hover) ?? null

  return (
    <div className="cm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg className="cm-map" viewBox={`0 0 ${SCOTLAND.w} ${SCOTLAND.h}`}
           role="group" aria-label={t('Where the casks come from', 'Nguồn gốc các thùng')}>
        <path d={SCOTLAND_PATH} className="cm-land" />
        {laid.map(({ pl, x, y, rad }, i) => {
          const n = pl.casks.length
          const on = hover === pl.name || region === pl.region
          const dim = region !== null && region !== pl.region
          // Labels lean away from the middle of the country so neighbours do
          // not overprint one another.
          const left = pl.lng < -3.4
          return (
            <g key={pl.name} className={`cm-pin${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}${pl.pinned ? '' : ' is-vague'}`}
               style={{ ['--i' as string]: i }} transform={`translate(${x} ${y})`}
               role="button" tabIndex={0} aria-pressed={on}
               aria-label={`${pl.name}, ${pl.region}: ${n} ${t(n === 1 ? 'cask' : 'casks', 'thùng')}`}
               onClick={() => onRegion(region === pl.region ? null : pl.region)}
               onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRegion(region === pl.region ? null : pl.region) } }}
               onPointerEnter={() => setHover(pl.name)} onPointerLeave={() => setHover(null)}>
              {/* The hit area was rad+14, which on Speyside meant a pin's
                  neighbour swallowed it — Craigellachie could not be pointed
                  at because Glenrothes was over it. The list beside the map is
                  the reliable way in; this is just close work. */}
              <circle r={rad + 5} className="cm-hit" />
              <g className="cm-dot">
                <circle r={rad} className="cm-glow" />
                {pl.pinned && <circle r={Math.max(2, rad * 0.4)} className="cm-core" />}
              </g>
              {/* NAMED ONLY WHEN POINTED AT. Six of these distilleries sit
                  within a few miles of each other on Speyside: printing every
                  label drew them on top of one another and ran Islay off the
                  edge. The names live in the list beside the map, which has
                  room for them; the map keeps the geography. */}
              {on && (
                <>
                  <text x={left ? -(rad + 8) : rad + 8} y={4} className="cm-label"
                        textAnchor={left ? 'end' : 'start'}>{pl.name}</text>
                  <text x={left ? -(rad + 8) : rad + 8} y={23} className="cm-count"
                        textAnchor={left ? 'end' : 'start'}>
                    {n} {t(n === 1 ? 'cask' : 'casks', 'thùng')} · {pl.bottles} {t('bottles', 'chai')}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      <div className="cm-side">
        <div className="pk-eyebrow">{t('Where they come from', 'Nguồn gốc')}</div>
        {/* A distillery under the pointer speaks for itself; otherwise the
            chosen region does. */}
        {shownPlace ? (
          <div className="cm-card" key={shownPlace.name}>
            <div className="cm-name">{shownPlace.name}</div>
            <p className="cm-blurb">
              {shownPlace.casks.length} {t(shownPlace.casks.length === 1 ? 'cask' : 'casks', 'thùng')}
              {' · '}{shownPlace.bottles} {t('bottles', 'chai')}
              {' · '}{shownPlace.region}
              {shownPlace.why && <><br />{t(shownPlace.why[0], shownPlace.why[1])}{t(' — shown at its region.', ' — hiển thị theo vùng.')}</>}
              {shownPlace.approximate && <><br />{t('Placed at the village; the distillery has no published coordinate.',
                                                    'Đặt tại ngôi làng; nhà chưng cất chưa có toạ độ công bố.')}</>}
            </p>
            <div className="cm-dist">
              {shownPlace.casks.map(c => `${c.cask_ref} · ${Math.floor(c.age_years)}${t('yo', ' năm')}`).join('   ')}
            </div>
          </div>
        ) : shownRegion ? (
          <div className="cm-card" key={shownRegion.key}>
            <div className="cm-name">{shownRegion.name}{shownRegion.native && <span> · {shownRegion.native}</span>}</div>
            <p className="cm-blurb">{vn ? (VN[shownRegion.key] ?? shownRegion.blurb) : shownRegion.blurb}</p>
            <div className="cm-dist">{t('Distilleries here include', 'Các nhà chưng cất trong vùng')}: {shownRegion.distilleries.slice(0, 4).join(', ')}</div>
          </div>
        ) : (
          <p className="cm-blurb" style={{ opacity: .6 }}>
            {t('Every distillery in the selection, where it stands. Choose one to filter the chart and the colour ladder.',
               'Mọi nhà chưng cất trong bộ sưu tập, đúng vị trí. Chọn một để lọc biểu đồ và thang màu.')}
          </p>
        )}
        {/* THE INDEX. Every distillery, in one legible column — which is also
            what makes it safe to take the labels off the map. */}
        <ul className="cm-list">
          {[...places].sort((a, b) => a.name.localeCompare(b.name)).map(pl => (
            <li key={pl.name}>
              <button
                className={`cm-row${hover === pl.name ? ' is-on' : ''}${region && region !== pl.region ? ' is-dim' : ''}`}
                onPointerEnter={() => setHover(pl.name)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(pl.name)} onBlur={() => setHover(null)}
                onClick={() => onRegion(region === pl.region ? null : pl.region)}>
                <span className="cm-row-name">{pl.name}{!pl.pinned && <span className="cm-row-q"> ?</span>}</span>
                <span className="cm-row-n">
                  {pl.casks.length} {t(pl.casks.length === 1 ? 'cask' : 'casks', 'thùng')} · {pl.bottles}
                </span>
              </button>
            </li>
          ))}
        </ul>

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
.cm { display: grid; grid-template-columns: minmax(0, 520px) minmax(0, 1fr); gap: clamp(24px, 5vw, 72px);
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
.cm-label { font-family: 'Rampant Sans', Georgia, serif; font-size: 19px; fill: #E5D4C2; }
.cm-count { font-family: ${MONO}; font-size: 13px; fill: rgba(229,212,194,.5); }
.cm-pin:hover .cm-glow, .cm-pin.is-on .cm-glow, .cm-pin:focus-visible .cm-glow { fill: rgba(212,184,90,.45); }
.cm-pin.is-on .cm-label { fill: ${GOLD}; }
.cm-pin.is-dim { opacity: .35; }
/* Undisclosed: the pin is hollow, because the point is the region, not a
   distillery we are claiming to know. */
.cm-pin.is-vague .cm-glow { fill: none; stroke-dasharray: 3 3; }
.cm-pin, .cm-pin text { transition: opacity .3s ease, fill .3s ease; }
.cm-side { align-self: center; min-width: 0; }
.cm-card { animation: cm-in .45s cubic-bezier(.16,.84,.44,1); }
@keyframes cm-in { from { opacity: 0; transform: translateY(8px); } }
.cm-name { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(26px, 3.2vw, 38px); margin-top: 12px; color: ${GOLD}; }
.cm-name span { color: rgba(229,212,194,.5); font-size: .6em; }
.cm-blurb { font-family: ${MONO}; font-size: 12.5px; line-height: 1.85; margin: 12px 0 0; max-width: 460px; color: rgba(229,212,194,.8); }
.cm-dist { font-family: ${MONO}; font-size: 10.5px; margin-top: 12px; color: rgba(229,212,194,.45); }
.cm-list { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 1px 28px;
           grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); min-width: 0; }
.cm-list li { min-width: 0; }
.cm-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; width: 100%;
          background: none; border: none; border-bottom: 1px solid rgba(229,212,194,.1); cursor: pointer;
          padding: 9px 2px; text-align: left; color: inherit; font-family: ${MONO}; font-size: 12.5px;
          transition: color .2s ease, border-color .2s ease; }
.cm-row-name { color: rgba(229,212,194,.85); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-row-q { color: ${GOLD}; opacity: .7; }
.cm-row-n { color: rgba(229,212,194,.45); white-space: nowrap; }
.cm-row:hover, .cm-row.is-on { border-bottom-color: ${GOLD}; }
.cm-row:hover .cm-row-name, .cm-row.is-on .cm-row-name { color: ${GOLD}; }
.cm-row.is-dim { opacity: .35; }
.cm-clear { margin-top: 16px; background: none; border: none; padding: 0; cursor: pointer; font-family: ${MONO};
            font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${GOLD};
            border-bottom: 1px solid rgba(212,184,90,.5); }
@media (max-width: 720px) { .cm { grid-template-columns: 1fr; } .cm-map { max-width: 360px; } }
@media (prefers-reduced-motion: reduce) { .cm-dot { transition: none; transform: none; } .cm-card { animation: none; } }
`
