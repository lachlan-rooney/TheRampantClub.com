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
// ═══════════════════════════════════════════════════════════════════════════

const GOLD = '#D4B85A'
const CREAM = '#E5D4C2'
const SAGE = '#7AB07A'

const STEPS = [50, 100, 250, 500]
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

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .tt-range { -webkit-appearance: none; appearance: none; width: 100%; height: 1px;
                    background: rgba(229,212,194,.25); outline: none; margin: 26px 0 0; }
        .tt-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
                    width: 18px; height: 18px; background: ${GOLD}; border-radius: 50%;
                    cursor: grab; border: none; }
        .tt-range::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); }
        .tt-range::-moz-range-thumb { width: 18px; height: 18px; background: ${GOLD};
                    border: none; border-radius: 50%; cursor: grab; }
        .tt-chip { background: none; border: none; cursor: pointer; padding: 4px 0;
                   font-family: 'Google Sans Code', monospace; font-size: 12px;
                   letter-spacing: .1em; color: ${CREAM}; opacity: .45;
                   border-bottom: 1px solid transparent; }
        .tt-chip.is-on { opacity: 1; color: ${GOLD}; border-bottom-color: ${GOLD}; }
        .tt-num { font-variant-numeric: tabular-nums; }
      ` }} />

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="pk-eyebrow">{t('If you took', 'Nếu quý vị đặt')}</span>
        {STEPS.map(s => (
          <button key={s} onClick={() => { setBottles(s); setPrice(null) }}
                  className={`tt-chip ${bottles === s ? 'is-on' : ''}`}>{s}</button>
        ))}
      </div>

      <input className="tt-range" type="range" min={min} max={MAX} step={10}
             value={bottles} onChange={e => { setBottles(Number(e.target.value)); setPrice(null) }}
             aria-label={t('How many bottles', 'Số lượng chai')} />

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

      {provisional ? (
        <p className="pk-meta" style={{ marginTop: 10, opacity: .6 }}>
          {t('Per-bottle prices are shown once Huntly confirm them.', 'Giá mỗi chai sẽ hiển thị khi Huntly xác nhận.')}
        </p>
      ) : (
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
