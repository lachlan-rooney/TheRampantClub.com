'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'
import { timeRemaining } from '@/lib/tet/queries'
import { vnd, type CaskBoardRow, type Countdown, type TetCategory } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT PROGRAMME, AS A BUYER SEES IT
// ───────────────────────────────────────────────────────────────────────────
// Two surfaces from the same rows: Duncan Taylor (the blends) and The Octave
// Selection (the casks), both bilingual out of tet_categories rather than out
// of hard-coded copy, so Miss Châu can change either without a deploy.
//
// NO PRICE IS SHOWN WHILE IT IS A PLACEHOLDER. Every figure in the system today
// is invented — the ex-works costs, the FX rate, even the cask ABVs — and the
// owner's rule is that nothing carrying that flag goes in front of a customer.
// So a provisional cask shows its shape and says the price is on request. One
// database flag flips and the numbers appear, with no change here.
//
// The countdown is the server's, corrected for the visitor's clock: a laptop
// with the wrong date still sees the true number of days left.
// ═══════════════════════════════════════════════════════════════════════════

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const AMBER = '#C49555'
const MUTED = 'rgba(229,212,194,.55)'

export default function TetProgramme({
  categories, casks, countdown,
}: {
  categories: TetCategory[]
  casks: CaskBoardRow[]
  countdown: Countdown | null
}) {
  const { t, lang } = useLang()
  const [reduced, setReduced] = useState(true)   // the 50% bottling, the story
  const vn = lang === 'vn'

  const blend = categories.find(c => c.kind === 'blend')
  const cask = categories.find(c => c.kind === 'cask')

  // Anything still flagged provisional anywhere means no prices on the page.
  const provisional = countdown?.is_placeholder || casks.some(c => c.is_placeholder)

  return (
    <main style={{ background: '#052E20', color: CREAM, minHeight: '100dvh' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #052E20 !important; }
        .tet-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
        .tet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
        .tet-card { border: 1px solid rgba(229,212,194,.14); border-radius: 12px; padding: 18px 20px;
                    background: rgba(229,212,194,.03); }
        .tet-card.is-held { opacity: .55; }
        @media (max-width: 640px) { .tet-wrap { padding: 0 18px; } }
      ` }} />

      <header className="tet-wrap" style={{ paddingTop: 34, paddingBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: GOLD }}>
            The Rampant Club · Duncan Taylor
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,6vw,64px)', fontWeight: 500, margin: '12px 0 0', lineHeight: 1.03 }}>
            {countdown?.season || 'Tết Đinh Mùi 2027'}
          </h1>
        </div>
        <LangToggle />
      </header>

      {countdown && <Countdown cd={countdown} t={t} />}

      {provisional && (
        <section className="tet-wrap" style={{ marginTop: 26 }}>
          <div style={{ border: `1px solid ${AMBER}55`, background: `${AMBER}12`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: AMBER, marginBottom: 6 }}>
              {t('Provisional', 'Tạm thời')}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.8, color: 'rgba(229,212,194,.8)' }}>
              {t('The cask list and pricing are being confirmed with Huntly. Nothing here is final, and prices are not shown until they are.',
                 'Danh sách thùng và bảng giá đang được xác nhận với Huntly. Mọi thông tin chưa phải là cuối cùng, và giá chưa được hiển thị.')}
            </div>
          </div>
        </section>
      )}

      {blend && <CategoryIntro c={blend} vn={vn} />}
      {cask && <CategoryIntro c={cask} vn={vn} />}

      <section className="tet-wrap" style={{ marginTop: 30, paddingBottom: 70 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', borderBottom: `1px solid ${GOLD}38`, paddingBottom: 10 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px,3vw,30px)', fontWeight: 500, margin: 0 }}>
            {t('The casks', 'Các thùng rượu')}
          </h2>
          {/* THE TOGGLE THAT SELLS IT. On a young, strong cask the bottle count
              jumps; on an old, weak one it barely moves — and the page says so
              either way rather than implying every cask has the same story. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setReduced(false)} style={toggle(!reduced)}>
              {t('At cask strength', 'Nguyên độ thùng')}
            </button>
            <button onClick={() => setReduced(true)} style={toggle(reduced)}>
              {t('Bottled at 50%', 'Đóng chai ở 50%')}
            </button>
          </div>
        </div>

        {casks.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: 13, color: MUTED, marginTop: 20, lineHeight: 1.9 }}>
            {t('The cask list is being confirmed.', 'Danh sách thùng đang được xác nhận.')}
          </p>
        ) : (
          <div className="tet-grid" style={{ marginTop: 20 }}>
            {casks.map(c => <CaskCard key={c.cask_ref} c={c} reduced={reduced} vn={vn} t={t} />)}
          </div>
        )}

        <p style={{ fontFamily: MONO, fontSize: 10.5, color: 'rgba(229,212,194,.4)', lineHeight: 1.9, marginTop: 34, maxWidth: 680 }}>
          {t('Nothing on this page is an offer for sale. Any order is completed on invoice by Duncan Taylor Vietnam. Not for anyone under 18.',
             'Nội dung trang này không phải là lời chào bán. Đơn hàng được hoàn tất bằng hóa đơn của Duncan Taylor Việt Nam. Không dành cho người dưới 18 tuổi.')}
        </p>
      </section>
    </main>
  )
}

/* ---------------------------------------------------------------- */

function Countdown({ cd, t }: { cd: Countdown; t: (en: string, vn: string) => string }) {
  const fetchedAt = useMemo(() => Date.now(), [])
  const [now, setNow] = useState(fetchedAt)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const gates: { label: string; date: string }[] = [
    { label: t('Casks, last order', 'Hạn đặt thùng'), date: cd.cutoffs.cask.date },
    { label: t('Blends, last order', 'Hạn đặt rượu pha trộn'), date: cd.cutoffs.blend.date },
    { label: t('Artwork', 'Thiết kế hộp'), date: cd.cutoffs.artwork.date },
    { label: t('In your hands', 'Giao đến tay khách'), date: cd.in_hand_date },
  ]

  return (
    <section className="tet-wrap" style={{ marginTop: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {gates.map(g => {
          const r = timeRemaining(g.date, cd.now, now, fetchedAt)
          return (
            <div key={g.label} className="tet-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED }}>{g.label}</div>
              <div style={{ fontFamily: SERIF, fontSize: 26, color: r.past ? AMBER : GOLD, marginTop: 6, lineHeight: 1 }}>
                {r.past ? t('passed', 'đã qua') : `${r.days}d`}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 6 }}>
                {new Date(g.date + 'T12:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CategoryIntro({ c, vn }: { c: TetCategory; vn: boolean }) {
  const name = vn ? c.name_vn : c.name_en
  const stand = vn ? c.standfirst_vn : c.standfirst_en
  const body = vn ? c.body_vn : c.body_en
  return (
    <section className="tet-wrap" style={{ marginTop: 34 }}>
      <div style={{ borderLeft: `3px solid ${c.accent_hex}`, paddingLeft: 18 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 500, margin: 0 }}>{name}</h2>
        {stand && <p style={{ fontFamily: MONO, fontSize: 13.5, lineHeight: 1.9, color: 'rgba(229,212,194,.8)', marginTop: 10, maxWidth: 640 }}>{stand}</p>}
        {body && <p style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.9, color: MUTED, marginTop: 8, maxWidth: 640 }}>{body}</p>}
      </div>
    </section>
  )
}

function CaskCard({ c, reduced, vn, t }: { c: CaskBoardRow; reduced: boolean; vn: boolean; t: (en: string, v: string) => string }) {
  const held = c.status !== 'available'
  const bottles = reduced ? c.bottles_reduced : c.bottles_cask_strength
  const unit = reduced ? c.unit_vnd_reduced : c.unit_vnd_cask_strength
  const note = vn ? c.tasting_note_vn : c.tasting_note_en

  return (
    <article className={`tet-card ${held ? 'is-held' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', color: c.colour_hex || GOLD }}>{c.cask_ref}</span>
        {held && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: AMBER }}>
            {c.status === 'reserved' ? t('held back', 'đã giữ') : t(c.status, c.status)}
          </span>
        )}
      </div>

      <h3 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, margin: '8px 0 0', lineHeight: 1.2 }}>{c.distillery}</h3>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED, marginTop: 4 }}>
        {[c.region, `${c.age_years}yo`, `${c.cask_abv_pct}%`, c.wood].filter(Boolean).join(' · ')}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(229,212,194,.1)' }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, color: CREAM, lineHeight: 1 }}>
          {bottles}<span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}> {t('bottles', 'chai')}</span>
        </div>
        {reduced && c.extra_bottles > 0 && (
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#7AB07A', marginTop: 6 }}>
            +{c.extra_bottles} {t('more than at cask strength', 'chai nhiều hơn so với nguyên độ')}
          </div>
        )}
        {reduced && c.extra_bottles === 0 && (
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED, marginTop: 6 }}>
            {t('no gain at this strength', 'không tăng thêm ở độ cồn này')}
          </div>
        )}

        <div style={{ fontFamily: MONO, fontSize: 12.5, color: c.is_placeholder ? AMBER : CREAM, marginTop: 10 }}>
          {/* The rule, in one line: a provisional cask has no price. */}
          {c.is_placeholder ? t('Price on request', 'Giá theo yêu cầu') : `${vnd(unit)} ${t('a bottle', 'mỗi chai')}`}
        </div>
      </div>

      {note && !c.is_placeholder && (
        <p style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 1.8, color: MUTED, marginTop: 12 }}>{note}</p>
      )}
    </article>
  )
}

const toggle = (on: boolean): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
  padding: '10px 14px', minHeight: 40, borderRadius: 8, cursor: 'pointer',
  background: on ? CREAM : 'none', color: on ? '#052E20' : CREAM,
  border: on ? 'none' : '1px solid rgba(229,212,194,.28)',
})
