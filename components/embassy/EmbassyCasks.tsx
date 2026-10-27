'use client'

import { useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'
import { vnd, type CaskBoardRow } from '@/lib/tet/types'
import { LOGO_SRC, NAVY, BLUE, INK, MUTED, LINE, SERIF, MONO } from './EmbassyBrand'

// THE SPIRITS EMBASSY · TẾT 2027 — ten single casks, on a tablet at an event.
//
// Built 2026-10-27 for the same evening. It deliberately does NOT reuse
// TetProgramme: the gold is imported by ten separate components, so theming
// the programme to Embassy blue would mean editing all ten on the day of a
// live event, with the club's own /tet page one mistake away. This page shares
// the DATA layer and nothing else, so the TRC page cannot break.
//
// ── IT IS A TABLET PAGE FIRST ──────────────────────────────────────────────
// Standing up, one hand, a guest reading over a shoulder. So: no fixed bars
// (nothing to trap the last row behind), 44px+ touch targets, figures big
// enough to read at arm's length, and a layout that works at 1024x768 and
// 1280x800 without a horizontal scroll.
//
// ── WHAT IT SHOWS, AND WHAT IT MUST NOT ────────────────────────────────────
// The board view carries no cost columns at all — by design, see
// lib/tet/types. Everything here is Duncan Taylor Vietnam's own list price
// per bottle plus the outturn at each strength. Nothing is computed from a
// margin, because the margin is not in the browser to compute from.

interface Props { casks: CaskBoardRow[] }

type Strength = 'cs' | '55' | '45' | '40'

export default function EmbassyCasks({ casks }: Props) {
  const { t, lang } = useLang()
  const [strength, setStrength] = useState<Strength>('cs')
  const [open, setOpen] = useState<string | null>(null)

  // Bottles and unit price at the chosen strength. 45% and 40% arrived in a
  // later migration and are optional on the type, so a board served before it
  // ran simply has no figure — the card says so rather than printing a zero.
  const at = (c: CaskBoardRow, s: Strength) => {
    if (s === 'cs') return { bottles: c.bottles_cask_strength, unit: c.unit_vnd_cask_strength }
    if (s === '55') return { bottles: c.bottles_55, unit: c.unit_vnd_55 }
    if (s === '45') return { bottles: c.bottles_45 ?? null, unit: c.unit_vnd_45 ?? null }
    return { bottles: c.bottles_40 ?? null, unit: c.unit_vnd_40 ?? null }
  }

  const STRENGTHS: { k: Strength; label: string }[] = [
    { k: 'cs', label: t('Cask strength', 'Nguyên độ thùng') },
    { k: '55', label: '55%' },
    { k: '45', label: '45%' },
    { k: '40', label: '40%' },
  ]

  const regions = useMemo(() => [...new Set(casks.map(c => c.region))], [casks])

  return (
    <main style={{ background: NAVY, minHeight: '100vh', color: INK, overflowX: 'clip' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="eb-head">
        <div className="eb-mark">
          {LOGO_SRC ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={LOGO_SRC} alt="The Spirits Embassy" className="eb-logo" />
          ) : (
            /* No logo file exists yet (EmbassyBrand.LOGO_SRC). A typographic
               wordmark is an honest stand-in; a stretched placeholder is not. */
            <div className="eb-word">
              <span className="eb-word-1">THE SPIRITS</span>
              <span className="eb-word-2">EMBASSY</span>
            </div>
          )}
          <div className="eb-lang"><LangToggle /></div>
        </div>

        <h1 className="eb-title">{t('Tết Đinh Mùi 2027', 'Tết Đinh Mùi 2027')}</h1>
        <p className="eb-lede">
          {t('Ten single casks from Duncan Taylor, bottled to your strength and labelled for Tết. Each cask is one of one — when it is taken, it is gone.',
             'Mười thùng rượu đơn từ Duncan Taylor, đóng chai theo độ rượu bạn chọn và dán nhãn riêng cho Tết. Mỗi thùng là duy nhất — khi đã có người chọn, sẽ không còn thùng thứ hai.')}
        </p>
        <div className="eb-meta">
          {casks.length} {t('casks', 'thùng')} · {regions.length} {t('regions', 'vùng')} · {t('prices per bottle, incl. VAT', 'giá mỗi chai, đã gồm VAT')}
        </div>
      </header>

      {/* STRENGTH IS THE WHOLE CONVERSATION at a tasting: reduce the cask and
          you get more bottles at a lower price each. One tap switches every
          figure on the page. */}
      <div className="eb-strength" role="group" aria-label={t('Bottling strength', 'Độ rượu đóng chai')}>
        <span className="eb-strength-label">{t('Bottled at', 'Đóng chai ở')}</span>
        {STRENGTHS.map(s => (
          <button key={s.k} onClick={() => setStrength(s.k)}
            aria-pressed={strength === s.k}
            className={`eb-pill ${strength === s.k ? 'is-on' : ''}`}>{s.label}</button>
        ))}
      </div>

      <section className="eb-grid">
        {casks.map(c => {
          const { bottles, unit } = at(c, strength)
          const cs = strength === 'cs'
          const extra = !cs && bottles != null ? bottles - c.bottles_cask_strength : 0
          const isOpen = open === c.cask_ref
          return (
            <article key={c.cask_ref} className="eb-card">
              <button className="eb-cardhead" onClick={() => setOpen(isOpen ? null : c.cask_ref)} aria-expanded={isOpen}>
                <div>
                  <h2 className="eb-name">{c.distillery}</h2>
                  <div className="eb-ref">
                    {c.cask_ref} · {c.region} · {Math.floor(c.age_years)}
                    {t('yo', ' tuổi')} · {c.cask_abv_pct}%
                  </div>
                </div>
                <span className="eb-chev" aria-hidden>{isOpen ? '−' : '+'}</span>
              </button>

              <div className="eb-figs">
                <div className="eb-fig">
                  <span className="eb-figlabel">{t('Per bottle', 'Mỗi chai')}</span>
                  <span className="eb-figval">{unit == null ? '—' : vnd(unit)}</span>
                </div>
                <div className="eb-fig">
                  <span className="eb-figlabel">{t('Bottles', 'Số chai')}</span>
                  <span className="eb-figval">
                    {bottles == null ? '—' : bottles}
                    {extra > 0 && <span className="eb-extra"> +{extra}</span>}
                  </span>
                </div>
              </div>

              {/* Not every cask can be reduced: there is no 55% bottling of a
                  51% cask, and the quote refuses to invent one. Say it plainly
                  rather than showing an identical figure and letting a guest
                  wonder. */}
              {!cs && bottles != null && bottles === c.bottles_cask_strength && (
                <div className="eb-note">
                  {t('Already at or below this strength — the same bottling.',
                     'Thùng này đã ở mức đó hoặc thấp hơn — vẫn là cùng một lần đóng chai.')}
                </div>
              )}
              {!cs && bottles == null && (
                <div className="eb-note">{t('Ask for this strength.', 'Vui lòng hỏi về độ rượu này.')}</div>
              )}

              {isOpen && (
                <div className="eb-body">
                  <div className="eb-row"><span>{t('Cask', 'Loại thùng')}</span><span>{c.cask_type}{c.wood ? ` · ${c.wood}` : ''}</span></div>
                  {c.vintage_year && <div className="eb-row"><span>{t('Distilled', 'Năm chưng cất')}</span><span>{c.vintage_year}</span></div>}
                  <div className="eb-row"><span>{t('Whole cask', 'Toàn bộ thùng')}</span>
                    <span>{unit != null && bottles != null ? vnd(unit * bottles) : '—'}</span></div>
                  {(lang === 'vn' ? c.tasting_note_vn : c.tasting_note_en) && (
                    <p className="eb-tasting">{lang === 'vn' ? c.tasting_note_vn : c.tasting_note_en}</p>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </section>

      <footer className="eb-foot">
        <div className="eb-footline">
          {t('Prices are Duncan Taylor Vietnam’s list, per bottle, including VAT. One cask, one buyer.',
             'Giá theo bảng giá của Duncan Taylor Việt Nam, mỗi chai, đã gồm VAT. Mỗi thùng chỉ một người mua.')}
        </div>
        <div className="eb-footmark">{t('THE SPIRITS EMBASSY · 18+', 'THE SPIRITS EMBASSY · 18+')}</div>
      </footer>
    </main>
  )
}

const CSS = `
  .eb-head { padding: clamp(22px,4vw,48px) clamp(18px,4vw,56px) 0; max-width: 1500px; margin: 0 auto; }
  .eb-mark { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .eb-logo { height: 44px; width: auto; display: block; }
  .eb-word { line-height: 1; }
  .eb-word-1 { display: block; font-family: ${MONO}; font-size: 11px; letter-spacing: .42em;
               color: ${MUTED}; text-transform: uppercase; }
  .eb-word-2 { display: block; font-family: ${SERIF}; font-size: clamp(26px,3.4vw,40px);
               letter-spacing: .06em; color: ${BLUE}; margin-top: 4px; }
  .eb-lang { flex: 0 0 auto; }

  .eb-title { font-family: ${SERIF}; font-size: clamp(34px,5.4vw,66px); line-height: 1.02;
              color: ${INK}; margin: clamp(20px,3.5vh,40px) 0 0; font-weight: 400; letter-spacing: -0.01em; }
  .eb-lede { font-family: ${SERIF}; font-size: clamp(16px,1.6vw,20px); line-height: 1.6;
             color: ${INK}; opacity: .82; max-width: 58ch; margin: 14px 0 0; }
  .eb-meta { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase;
             color: ${MUTED}; margin-top: 16px; }

  /* Sticky, not fixed: it scrolls with the page and can never cover the last
     card the way a fixed bar does. */
  .eb-strength { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px;
                 align-items: center; padding: 14px clamp(18px,4vw,56px);
                 margin: clamp(18px,3vh,32px) auto 0; max-width: 1500px;
                 background: ${NAVY}; border-bottom: 1px solid ${LINE}; }
  .eb-strength-label { font-family: ${MONO}; font-size: 10px; letter-spacing: .14em;
                       text-transform: uppercase; color: ${MUTED}; margin-right: 6px; }
  .eb-pill { min-height: 44px; padding: 10px 18px; cursor: pointer; color: ${INK};
             background: rgba(127,178,217,.08); border: 1px solid ${LINE}; border-radius: 999px;
             font-family: ${MONO}; font-size: 12px; letter-spacing: .08em;
             -webkit-tap-highlight-color: transparent; }
  .eb-pill.is-on { background: ${BLUE}; border-color: ${BLUE}; color: ${NAVY}; font-weight: 600; }

  .eb-grid { display: grid; gap: 1px; background: ${LINE}; max-width: 1500px;
             margin: 0 auto; padding: 1px 0 0;
             grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
  .eb-card { background: ${NAVY}; padding: clamp(16px,2vw,24px) clamp(18px,2.4vw,28px) clamp(18px,2.2vw,26px); }
  .eb-cardhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
                 width: 100%; text-align: left; background: none; border: none; cursor: pointer;
                 color: inherit; padding: 0; min-height: 44px; -webkit-tap-highlight-color: transparent; }
  .eb-name { font-family: ${SERIF}; font-size: clamp(21px,2.2vw,27px); line-height: 1.15;
             color: ${INK}; margin: 0; font-weight: 400; }
  .eb-ref { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
            color: ${MUTED}; margin-top: 7px; }
  .eb-chev { font-family: ${MONO}; font-size: 20px; color: ${BLUE}; line-height: 1; flex: 0 0 auto; }

  .eb-figs { display: flex; gap: clamp(20px,3vw,40px); margin-top: 18px;
             padding-top: 16px; border-top: 1px solid ${LINE}; }
  .eb-fig { display: flex; flex-direction: column; gap: 5px; }
  .eb-figlabel { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em;
                 text-transform: uppercase; color: ${MUTED}; }
  .eb-figval { font-family: ${SERIF}; font-size: clamp(19px,2vw,25px); color: ${BLUE};
               font-variant-numeric: tabular-nums; line-height: 1.1; }
  .eb-extra { font-family: ${MONO}; font-size: 12px; color: #8FC48F; letter-spacing: .04em; }

  .eb-note { font-family: ${MONO}; font-size: 10.5px; line-height: 1.7; color: ${MUTED}; margin-top: 12px; }

  .eb-body { margin-top: 16px; padding-top: 14px; border-top: 1px solid ${LINE}; }
  .eb-row { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0;
            font-family: ${MONO}; font-size: 11.5px; color: ${INK}; }
  .eb-row span:first-child { color: ${MUTED}; letter-spacing: .1em; text-transform: uppercase; font-size: 9.5px; }
  .eb-tasting { font-family: ${SERIF}; font-size: 15px; line-height: 1.7; color: ${INK};
                opacity: .8; margin: 12px 0 0; }

  .eb-foot { max-width: 1500px; margin: 0 auto; padding: clamp(26px,4vh,52px) clamp(18px,4vw,56px);
             border-top: 1px solid ${LINE}; display: flex; flex-wrap: wrap; gap: 16px;
             justify-content: space-between; align-items: baseline; }
  .eb-footline { font-family: ${MONO}; font-size: 10.5px; line-height: 1.8; color: ${MUTED}; max-width: 62ch; }
  .eb-footmark { font-family: ${MONO}; font-size: 10px; letter-spacing: .28em; color: ${BLUE}; }

  /* A tablet held in portrait, and the small end of landscape. */
  @media (max-width: 760px) { .eb-grid { grid-template-columns: 1fr; } }
  @media (pointer: coarse) { .eb-pill { padding: 12px 20px; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`
