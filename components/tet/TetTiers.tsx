'use client'

import { useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import { vnd, type VolumeTier } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE LADDER, AS SOMETHING TO PULL ON.
// ───────────────────────────────────────────────────────────────────────────
// The tiers were a static list, which is the least persuasive way to show a
// volume discount: a buyer has a number in their head — "about two hundred" —
// and wants to know what that number buys. So they move it, and the tier, the
// discount and the distance to the next one move with it.
//
// WHAT IS COMPUTED HERE AND WHAT IS NOT. Which tier a count falls in, and how
// many more bottles reach the next one, are the PUBLISHED TERMS — the same four
// rows printed on the leaflet, looked up, not calculated. No price is worked
// out in this file: when the figures are real the page asks the database for a
// finished number, exactly as everywhere else.
//
// THE STAIRCASE (2026-09-22). The same four rows, drawn: bottles along, the
// discount up, one step per tier. The part of the stair you have reached is
// gold and a marker stands on your number, so "twenty more bottles" becomes a
// step you can see is right there. Pointing at the stair moves the number;
// it is the slider, in the shape of the ladder.
// ═══════════════════════════════════════════════════════════════════════════

const GOLD = '#D4B85A'
const CREAM = '#E5D4C2'
const SAGE = '#7AB07A'

// THE QUICK PICKS ARE THE LADDER ITSELF (2026-10-01). They were four
// hand-written numbers — 50, 100, 250, 500 — chosen when the ladder had four
// rungs. It has eight now, and a hard-coded list beside a table-driven chart is
// two sources for one fact. Every rung is a chip, so the control and the thing
// it controls cannot drift.
const MAX = 800

export default function TetTiers({ tiers, provisional }: { tiers: VolumeTier[]; provisional: boolean }) {
  const { t, lang } = useLang()
  const vn = lang === 'vn'
  const [bottles, setBottles] = useState(100)
  const [price, setPrice] = useState<{ unit: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const current = useMemo(
    () => [...tiers].reverse().find(x => bottles >= x.min_bottles) ?? tiers[0],
    [tiers, bottles],
  )
  const next = useMemo(
    () => tiers.find(x => x.min_bottles > (current?.min_bottles ?? 0)) ?? null,
    [tiers, current],
  )
  const min = tiers[0]?.min_bottles ?? 50
  const STEPS = tiers.map(x => x.min_bottles)

  // Only once the numbers are real. While anything is provisional the page
  // shows no price at all, and asking for one would be asking the database to
  // dress up a placeholder.
  const priceIt = async () => {
    if (provisional || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/tet/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: [{ sku: 'DT-12YO', qty: bottles }], sleeve: true }),
      })
      const j = await r.json().catch(() => ({}))
      const line = j?.quote?.lines?.[0]
      if (line) setPrice({ unit: line.unit_inc_vat_vnd, total: j.quote.total_inc_vat_vnd })
    } finally { setBusy(false) }
  }

  // The staircase. Bottles to x on the slider's own range, so the marker and
  // the thumb underneath stand at the same place.
  const CW = 1000, CH = 150, top = 26, base = 118
  const maxPct = Math.max(0.01, ...tiers.map(x => x.discount_pct))
  const xOf = (b: number) => ((Math.min(MAX, Math.max(min, b)) - min) / (MAX - min)) * CW
  const yOf = (pct: number) => base - (pct / maxPct) * (base - top)
  const steps = tiers.map((x, i) => ({
    x0: xOf(x.min_bottles), x1: i + 1 < tiers.length ? xOf(tiers[i + 1].min_bottles) : CW, y: yOf(x.discount_pct), tier: x,
  }))
  const stair = steps.map((st, i) => `${i ? 'L' : 'M'}${st.x0} ${i ? steps[i - 1].y : st.y}L${st.x0} ${st.y}L${st.x1} ${st.y}`).join('')
  const reached = xOf(bottles)
  const fromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setBottles(Math.round((min + f * (MAX - min)) / 10) * 10); setPrice(null)
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `; border-radius: 50%;
                    cursor: grab; border: none; };
                    border: none; border-radius: 50%; cursor: grab; }
        .tt-chip { background: none; border: none; cursor: pointer; padding: 4px 0;
                   font-family: 'Google Sans Code', monospace; font-size: 12px;
                   letter-spacing: .1em; color: ${CREAM}; opacity: .45;
                   border-bottom: 1px solid transparent; }
        .tt-chip.is-on { opacity: 1; color: ${GOLD}; border-bottom-color: ${GOLD}; }
        /* ── REACHABLE BY THUMB (2026-10-01) ──────────────────────────────
           The chips were 17px wide: "50" is two characters and that was the
           whole target. They are the only way to jump to a rung now that the
           slider has gone, so they have to be easy to hit. */
        @media (pointer: coarse) {
          .tt-chip { padding: 11px 14px; min-width: 44px; }
        }
        .tt-num { font-variant-numeric: tabular-nums; }
        .tt-stair { display: block; width: 100%; height: auto; margin-top: 22px; cursor: pointer; touch-action: pan-y; overflow: visible; }
        .tt-stair text { font-family: 'Google Sans Code', monospace; }
        .tt-reach { transition: width .35s cubic-bezier(.16,.84,.44,1); }
        .tt-mark { transition: transform .35s cubic-bezier(.16,.84,.44,1); }
        @media (prefers-reduced-motion: reduce) { .tt-reach, .tt-mark { transition: none; } }
      ` }} />

      {/* TAP A NUMBER. The chips ARE the rungs, so every discount on the chart
          below is one tap away and the thing you want is never between two of
          them. */}
      <div style={{ display: 'flex', gap: 'clamp(6px, 2vw, 22px)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="pk-eyebrow" style={{ marginRight: 4 }}>{t('If you took', 'Nếu quý vị đặt')}</span>
        {STEPS.map(n => (
          <button key={n} onClick={() => { setBottles(n); setPrice(null) }}
                  aria-pressed={bottles === n}
                  className={`tt-chip ${bottles === n ? 'is-on' : ''}`}>{n}</button>
        ))}
      </div>

      <svg className="tt-stair" viewBox={`0 0 ${CW} ${CH}`} aria-hidden
           onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e) }}
           onPointerMove={e => { if (e.buttons) fromPointer(e) }}>
        <defs>
          <clipPath id="tt-clip"><rect className="tt-reach" x="0" y="0" width={reached} height={CH} /></clipPath>
        </defs>
        {/* the whole ladder, faint */}
        <path d={`${stair}L${CW} ${base}L0 ${base}Z`} fill="rgba(229,212,194,.05)" />
        <path d={stair} fill="none" stroke="rgba(229,212,194,.28)" strokeWidth="1.5" />
        {/* the part you have climbed */}
        <g clipPath="url(#tt-clip)">
          <path d={`${stair}L${CW} ${base}L0 ${base}Z`} fill="rgba(212,184,90,.16)" />
          <path d={stair} fill="none" stroke={GOLD} strokeWidth="2" />
        </g>
        {steps.map(st => (
          <g key={st.tier.min_bottles}>
            <text x={st.x0 + 8} y={st.y - 8} fontSize="15"
                  fill={current?.min_bottles === st.tier.min_bottles ? GOLD : 'rgba(229,212,194,.55)'}>
              {st.tier.discount_pct ? `−${Math.round(st.tier.discount_pct * 100)}%` : t('list', 'giá gốc')}
            </text>
            <text x={st.x0} y={base + 22} fontSize="13" fill="rgba(229,212,194,.4)">{st.tier.min_bottles}</text>
          </g>
        ))}
        <g className="tt-mark" style={{ transform: `translateX(${reached}px)` }}>
          <line x1="0" x2="0" y1={top - 16} y2={base} stroke={CREAM} strokeWidth="1" />
          <circle cx="0" cy={yOf(current?.discount_pct ?? 0)} r="6" fill={GOLD} />
        </g>
      </svg>

      {/* THE DRAGGABLE SLIDER IS GONE (owner, 2026-10-01: "the drag discount
          button is not that great"). It was the third way to set one number —
          after the chips above and the staircase itself, which already scrubs
          under a finger — and it was a one-pixel-tall track with an 18px thumb,
          so on a phone the only way to move it was to land on the thumb
          exactly. Two controls, both of them easy to hit. */}

      <div style={{ display: 'flex', gap: 'clamp(24px, 6vw, 72px)', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 24 }}>
        <div>
          <div className="pk-h2 tt-num" style={{ margin: 0 }}>{bottles}</div>
          <div className="pk-meta" style={{ marginTop: 6 }}>{t('bottles', 'chai')}</div>
        </div>
        <div>
          <div className="pk-h2 tt-num" style={{ margin: 0, color: current?.discount_pct ? GOLD : CREAM }}>
            {current ? `${Math.round(current.discount_pct * 100)}%` : '—'}
          </div>
          <div className="pk-meta" style={{ marginTop: 6 }}>
            {current?.discount_pct ? t('off each bottle', 'giảm mỗi chai') : t('list price', 'giá niêm yết')}
          </div>
        </div>
        <div style={{ minWidth: 150 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(20px,2.4vw,26px)' }}>
            {current ? (vn ? current.label_vn : current.label_en) : '—'}
          </div>
          <div className="pk-meta" style={{ marginTop: 6 }}>
            {bottles >= 250
              ? t('sleeve setup included', 'miễn phí thiết kế hộp')
              : t('sleeve setup charged under 250', 'dưới 250 chai có phí thiết kế')}
          </div>
        </div>
      </div>

      {/* The honest upsell: the exact distance to the next rung, never a nudge
          dressed as a deadline. */}
      <p className="pk-meta" style={{ marginTop: 20, color: next ? GOLD : SAGE, lineHeight: 1.9 }}>
        {next
          ? t(`${next.min_bottles - bottles} more bottles reaches ${next.label_en} — ${Math.round(next.discount_pct * 100)}% off.`,
              `Thêm ${next.min_bottles - bottles} chai để đạt mức ${next.label_vn} — giảm ${Math.round(next.discount_pct * 100)}%.`)
          : t('That is the best rate on the ladder.', 'Đây là mức tốt nhất trên bảng.')}
      </p>

      {/* The line that said per-bottle prices appear once Huntly confirm them
          is gone (owner, 2026-10-01). While prices are provisional the block
          simply shows nothing rather than explaining its own absence — a buyer
          reading about discounts does not need to be told which supplier has
          not replied yet. */}
      {provisional ? null : (
        <div style={{ marginTop: 14 }}>
          {price ? (
            <p className="pk-meta" style={{ color: CREAM, fontSize: 13 }}>
              {vnd(price.unit)} {t('a bottle', 'mỗi chai')} · {vnd(price.total)} {t('in total, with sleeves', 'tổng cộng, kèm hộp')}
            </p>
          ) : (
            <button onClick={priceIt} className="pk-cta" style={{ marginTop: 0 }}>
              {busy ? t('Working it out', 'Đang tính') : t('Price this', 'Tính giá')} <span className="pk-go">→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
