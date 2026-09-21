'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'
import { PublicPage, Masthead, SectionHead, Details, Cta, Rise, MONO, GOLD } from '@/components/public/kit'
import { timeRemaining } from '@/lib/tet/queries'
import { vnd, type BlendBoardRow, type CaskBoardRow, type Countdown, type TetCategory, type VolumeTier } from '@/lib/tet/types'
import TetEnquiry, { type EnquiryTarget } from '@/components/tet/TetEnquiry'
import TetTiers from '@/components/tet/TetTiers'
import SleeveStudio, { type SleeveDesign } from '@/components/tet/SleeveStudio'
import TetTimeline from '@/components/tet/TetTimeline'
import TetBleed from '@/components/tet/TetBleed'

// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT PROGRAMME — built from the public kit, like the rest of the site.
// ───────────────────────────────────────────────────────────────────────────
// Left-aligned, huge display type, mono for everything else, hairlines instead
// of boxes, and full-bleed pictures fading into the ground. The first version
// of this page was a wall of bordered cards — the admin portal's furniture on
// a page meant for a buyer.
//
// Pictures are Duncan Taylor's own photography now, not the club's stock art:
// an Octave in Scottish heather, a cooper closing a cask at Huntly, a bottle on
// rock. Was: the invitation for the masthead, the
// bottle in its bag for the gifting, the Octave artwork for the casks.
//
// NO PRICE APPEARS WHILE ANYTHING IS PROVISIONAL. What can be shown honestly
// is the SHAPE of the offer — the tier ladder (published terms, not prices),
// the bottle counts at each strength, and the dates. Those carry the argument
// on their own.
// ═══════════════════════════════════════════════════════════════════════════

const GROUND = '#052E20'
const CREAM = '#E5D4C2'
const AMBER = '#C49555'
const SAGE = '#7AB07A'

type Strength = 'cask' | '55' | '50' | '45' | '40'

// ── ONE TABLE, READ BY BOTH THE BUTTONS AND THE ROW ────────────────────────
// Three strengths fitted in a ternary. Five do not, and the ternary had the
// bottle count, the price and the gain each choosing independently — three
// places to forget a strength in. The columns are named here once.
//
// 40% is the last entry there will ever be: the quote refuses anything lower
// because Scotch below 40% abv is not Scotch.
const STRENGTHS: {
  key: Strength; en: string; vn: string
  bottles: keyof CaskBoardRow; unit: keyof CaskBoardRow; gain: keyof CaskBoardRow | null
}[] = [
  { key: 'cask', en: 'cask strength', vn: 'nguyên độ',
    bottles: 'bottles_cask_strength', unit: 'unit_vnd_cask_strength', gain: null },
  { key: '55', en: '55%', vn: '55%', bottles: 'bottles_55', unit: 'unit_vnd_55', gain: 'extra_bottles_55' },
  { key: '50', en: '50%', vn: '50%', bottles: 'bottles_reduced', unit: 'unit_vnd_reduced', gain: 'extra_bottles' },
  { key: '45', en: '45%', vn: '45%', bottles: 'bottles_45', unit: 'unit_vnd_45', gain: 'extra_bottles_45' },
  { key: '40', en: '40%', vn: '40%', bottles: 'bottles_40', unit: 'unit_vnd_40', gain: 'extra_bottles_40' },
]

export default function TetProgramme({
  categories, casks, blends, tiers, countdown,
}: {
  categories: TetCategory[]
  casks: CaskBoardRow[]
  blends: BlendBoardRow[]
  tiers: VolumeTier[]
  countdown: Countdown | null
}) {
  const { t, lang } = useLang()
  const vn = lang === 'vn'
  const [strength, setStrength] = useState<Strength>('50')
  const [target, setTarget] = useState<EnquiryTarget | null>(null)
  const [design, setDesign] = useState<SleeveDesign | null>(null)

  // ── ONLY OFFER A STRENGTH THE BOARD CAN ANSWER FOR ──────────────────────
  // The 45% and 40% columns arrive with a migration. Until it has run they are
  // simply absent, and a row asked for a figure it does not have would have
  // said "already below 45%" about a 60% cask — a confident lie. A missing
  // column is not an option, so it is not a button.
  //
  // Once the migration HAS run the column is never null: a cask too weak to be
  // reduced is quoted at its own strength, and the row says so on its own.
  const offered = STRENGTHS.filter(s =>
    s.key === 'cask' || casks.length === 0 || casks.some(c => c[s.bottles] != null))

  const blendCat = categories.find(c => c.kind === 'blend')
  const caskCat = categories.find(c => c.kind === 'cask')
  const provisional = !!countdown?.is_placeholder || casks.some(c => c.is_placeholder)

  const openBlend = () => setTarget({ kind: 'blend', title: blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor' })

  return (
    <PublicPage ground={GROUND} ink={CREAM}>
      {/* THE SWITCH STAYS WITH YOU. It was absolute, so it scrolled away after
          the masthead — on a page this long that is the same as not having one.
          And it was tone="light", which is the control for a CREAM page: on
          this ground it all but disappeared. */}
      <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 8000 }}>
        <LangToggle />
      </div>

      <Masthead
        title={<>Tết<br />Đinh Mùi</>}
        sub="2027"
        lede={t('Whisky for the companies you thank at Tết — three blends in a sleeve carrying your name, or a single cask with every bottle numbered.',
                'Rượu whisky để tri ân đối tác dịp Tết — ba dòng pha trộn trong hộp in tên công ty, hoặc trọn một thùng đơn với từng chai được đánh số.')}
        art={
          <div className="pk-thumb" style={{ aspectRatio: '4 / 5' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/tet/blend.webp" alt="" width={620} height={880} />
          </div>
        }
      >
        <Cta onClick={openBlend}>{t('Register interest', 'Đăng ký quan tâm')}</Cta>
      </Masthead>

      {countdown && <NextGate cd={countdown} t={t} />}
      {/* The first photograph, straight under the masthead — an Octave in
          Scottish heather. Loaded eagerly and at high priority because it is
          the page's first impression; everything below it waits its turn. */}
      <TetBleed
        src="/images/tet/hero.webp" sm="/images/tet/hero-sm.webp" width={1700} smWidth={900} eager
        height="clamp(300px, 50vw, 620px)" position="50% 55%" strength={10}
        alt={t('An Octave single malt among Scottish heather',
               'Một chai Octave single malt giữa đồng thạch nam Scotland')}
      />

      {countdown && <TetTimeline cd={countdown} t={t} locale={vn ? 'vi-VN' : 'en-GB'} />}

      {/* ── THE BLENDS ────────────────────────────────────────────────── */}
      <section className="pk-wrap pk-section">
        <SectionHead
          eyebrow={t('From fifty bottles', 'Từ năm mươi chai')}
          title={blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor'}
        />
        {blendCat && (
          <p className="pk-lede">{vn ? blendCat.standfirst_vn : blendCat.standfirst_en}</p>
        )}

        <div style={{ marginTop: 40 }}>
          <Details rows={blends.map(b => ({
            label: b.expression || b.sku,
            value: (
              <>
                {vn ? b.name_vn : b.name_en}
                <span style={{ opacity: .55 }}>
                  {' · '}{b.abv_pct}% · {b.bottle_size_ml}ml
                  {b.min_order_bottles ? ` · ${t('from', 'từ')} ${b.min_order_bottles} ${t('bottles', 'chai')}` : ''}
                </span>
              </>
            ),
          }))} />
        </div>

        {tiers.length > 0 && (
          <div style={{ marginTop: 52 }}>
            <TetTiers tiers={tiers} provisional={provisional} />
            <p className="pk-meta" style={{ marginTop: 22, maxWidth: 560, lineHeight: 1.9 }}>
              {t('The tier is set by the total across all three, so a mixed order still climbs. Sleeves are printed with your company’s name.',
                 'Mức chiết khấu tính trên tổng số chai của cả ba dòng, nên đơn hàng pha trộn vẫn được nâng mức. Hộp in tên công ty.')}
            </p>
          </div>
        )}

        <Cta onClick={openBlend}>{t('Register interest', 'Đăng ký quan tâm')}</Cta>
      </section>

      {/* ── THE SLEEVE STUDIO ─────────────────────────────────────────
          The question a buyer is actually asking is "what will it look like
          with our logo on it". Prose cannot answer that. */}
      <section className="pk-wrap pk-section">
        <SectionHead
          eyebrow={t('Make it yours', 'Cá nhân hoá')}
          title={t('The sleeve', 'Hộp đựng')}
        />
        <p className="pk-lede">
          {t('Every bottle comes in a sleeve printed with your name. Set the colour, drop your logo on it, and write the line that goes underneath.',
             'Mỗi chai đều có hộp in tên công ty. Chọn màu, tải logo lên, và viết dòng chữ bên dưới.')}
        </p>
        <div style={{ marginTop: 44 }}>
          <SleeveStudio onUse={d => {
            setDesign(d)
            setTarget({ kind: 'blend', title: d.company || (blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor') })
          }} />
        </div>
      </section>

      <div style={{ marginTop: 90 }}>
        {/* Was the club's bottle-and-bag stock shot, which is about the club
            rather than about this offer. An Octave on Scottish rock says what
            is actually being sold. */}
        <TetBleed
          src="/images/tet/rock.webp" sm="/images/tet/rock-sm.webp"
          width={1400} smWidth={760}
          height="clamp(260px, 40vw, 500px)" position="50% 45%"
          alt={t('An Octave single malt on Scottish rock',
                 'Chai Octave single malt trên đá Scotland')}
        />
      </div>

      {/* Before the casks, the man who closes them. This is the picture that
          makes the cask section mean something: a real cooper, in Huntly,
          doing the thing being sold. */}
      <div style={{ marginTop: 90 }}>
        <TetBleed
          src="/images/tet/cooper-band.webp" sm="/images/tet/cooper-band-sm.webp"
          width={1500} smWidth={820}
          height="clamp(260px, 42vw, 520px)" position="50% 40%"
          alt={t('A cooper closing a cask at Huntly',
                 'Thợ đóng thùng tại Huntly')}
        />
      </div>

      {/* ── THE CASKS ─────────────────────────────────────────────────── */}
      <section className="pk-wrap pk-section">
        <SectionHead
          eyebrow={t('Fourteen single casks', 'Mười bốn thùng đơn')}
          title={caskCat ? (vn ? caskCat.name_vn : caskCat.name_en) : 'The Octave Selection'}
          art={
            <div className="pk-thumb" style={{ width: 'clamp(120px, 18vw, 200px)', aspectRatio: '1 / 1' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/tet/blackbull.webp" alt="" width={700} height={950} loading="lazy" />
            </div>
          }
        />
        {caskCat && <p className="pk-lede">{vn ? caskCat.standfirst_vn : caskCat.standfirst_en}</p>}

        {/* THE TOGGLE IS THE ARGUMENT. Duty and tax are charged on value, not
            on alcohol, so bottling a strong young cask at 50% multiplies the
            bottles without multiplying the tax — and on a weak old cask it
            does almost nothing. The page shows both, honestly. */}
        <div style={{ display: 'flex', gap: 22, alignItems: 'baseline', marginTop: 40, flexWrap: 'wrap' }}>
          <span className="pk-eyebrow">{t('Bottled at', 'Đóng chai ở')}</span>
          {offered.map(s => (
            <button key={s.key} onClick={() => setStrength(s.key)} style={pick(strength === s.key)}>
              {t(s.en, s.vn)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {casks.map(c => (
            <CaskRow key={c.cask_ref} c={c} strength={strength} vn={vn} t={t} provisional={provisional}
                     onChoose={() => setTarget({
                       kind: 'cask', cask_ref: c.cask_ref,
                       title: `${c.cask_ref} · ${c.distillery}`,
                       target_abv: strength === 'cask' ? null : Number(strength),
                     })} />
          ))}
        </div>
      </section>

      <footer className="pk-wrap" style={{ paddingTop: 80, paddingBottom: 110 }}>
        {provisional && (
          <p className="pk-meta" style={{ color: AMBER, maxWidth: 620, lineHeight: 1.9 }}>
            {t('The cask list and prices are being confirmed with Huntly. Nothing here is final, and no price is shown until it is.',
               'Danh sách thùng và bảng giá đang được xác nhận với Huntly. Mọi thông tin chưa phải cuối cùng; giá chưa hiển thị.')}
          </p>
        )}
        <p className="pk-meta" style={{ marginTop: 14, maxWidth: 620, lineHeight: 1.9 }}>
          {t('Nothing on this page is an offer for sale. Orders are completed on invoice by Duncan Taylor Vietnam. Not for anyone under 18.',
             'Nội dung trang này không phải lời chào bán. Đơn hàng hoàn tất bằng hóa đơn của Duncan Taylor Việt Nam. Không dành cho người dưới 18 tuổi.')}
        </p>
      </footer>

      {target && (
        <TetEnquiry
          target={target}
          provisional={provisional}
          // The design only travels with a blend enquiry: a sleeve is a blend
          // thing, and attaching it to a cask would promise something the cask
          // offer does not include.
          design={target.kind === 'blend' && design ? design : undefined}
          onClose={() => setTarget(null)}
        />
      )}
    </PublicPage>
  )
}

/* ---------------------------------------------------------------- */

// THE GATE THAT IS ACTUALLY NEXT, COUNTING DOWN.
// Five dates in a list are a reference; one of them moving is a reason to act
// today. It ticks every second, corrected for the visitor's own clock, and it
// names which gate it is — a bare number counting down to nothing in particular
// is decoration.
function NextGate({ cd, t }: { cd: Countdown; t: (en: string, vn: string) => string }) {
  const fetchedAt = useMemo(() => Date.now(), [])
  const [now, setNow] = useState(fetchedAt)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  // The owner's words, and better than mine: a deadline means nothing until it
  // says what shuts. "Casks close" is jargon; "the window closes to order casks
  // from Scotland" is the actual constraint — they are bottled at Huntly and
  // put on a ship.
  const gates = [
    { label: t('until the window closes to order casks from Scotland',
               'đến khi đóng cửa sổ đặt thùng từ Scotland'), date: cd.cutoffs.cask.date },
    { label: t('until the sleeve artwork must be agreed',
               'đến hạn chốt thiết kế hộp'), date: cd.cutoffs.artwork.date },
    { label: t('until the last order for the blends',
               'đến hạn đặt cuối cho rượu pha trộn'), date: cd.cutoffs.blend.date },
  ]
    .map(g => ({ ...g, r: timeRemaining(g.date, cd.now, now, fetchedAt) }))
    .filter(g => !g.r.past)
    .sort((a, b) => (a.r.days * 86400 + a.r.hours * 3600 + a.r.minutes * 60 + a.r.seconds)
                  - (b.r.days * 86400 + b.r.hours * 3600 + b.r.minutes * 60 + b.r.seconds))

  const g = gates[0]
  if (!g) return null
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <section className="pk-wrap" style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap',
                    borderTop: '1px solid rgba(229,212,194,.14)', paddingTop: 22 }}>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(34px,5vw,58px)', lineHeight: 1, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
          {g.r.days}
          {/* A margin is not a space: "43days" is what a margin gives you when
              the number and the word are separate elements. */}
          <span style={{ fontFamily: MONO, fontSize: 'clamp(13px,1.4vw,16px)', color: CREAM, marginLeft: 10 }}>
            {`${t('days', 'ngày')} ${pad(g.r.hours)}:${pad(g.r.minutes)}:${pad(g.r.seconds)}`}
          </span>
        </div>
        <div className="pk-meta" style={{ fontSize: 12.5 }}>{g.label}</div>
      </div>
    </section>
  )
}

function CaskRow({ c, strength, vn, t, provisional, onChoose }: {
  c: CaskBoardRow; strength: Strength; vn: boolean
  t: (en: string, v: string) => string
  provisional: boolean
  onChoose: () => void
}) {
  const gone = c.status !== 'available'
  const spec = STRENGTHS.find(s => s.key === strength) ?? STRENGTHS[0]
  const num = (k: keyof CaskBoardRow | null) => {
    const v = k ? c[k] : 0
    return typeof v === 'number' ? v : null
  }
  const bottles = num(spec.bottles)
  const gain = num(spec.gain) ?? 0

  // A cask at or below the chosen strength has no bottling AT that strength:
  // the board returns its own figures rather than inventing one, and the row
  // says so instead of showing a gain of nothing as if it were a choice. This
  // used to be asked about 55% alone, which meant a 48% cask offered a "50%"
  // bottling that silently repeated its cask-strength count.
  //
  // The null check is the same sentence for a different reason: the 45% and
  // 40% columns arrive with a migration, and until it has run the figure is
  // simply absent. Either way the honest answer is "not this one", never
  // "undefined".
  const asked = strength === 'cask' ? null : Number(strength)
  const noSuchStrength = asked !== null && c.cask_abv_pct <= asked

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) auto',
      gap: 18, alignItems: 'baseline', padding: '16px 0',
      borderTop: '1px solid rgba(229,212,194,.14)', opacity: gone ? .42 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="pk-h3">{c.distillery}</div>
        <div className="pk-meta" style={{ marginTop: 4 }}>
          {c.cask_ref} · {c.region} · {c.age_years}{t('yo', ' năm')} · {c.cask_abv_pct}%
        </div>
      </div>

      <div className="pk-meta" style={{ fontSize: 12.5 }}>
        {noSuchStrength ? (
          <span style={{ opacity: .6 }}>{t(`already below ${asked}%`, `đã dưới ${asked}%`)}</span>
        ) : (
          <>
            <span style={{ color: CREAM, fontSize: 15 }}>{bottles}</span> {t('bottles', 'chai')}
            {gain > 0 && <span style={{ color: SAGE }}> · +{gain}</span>}
          </>
        )}
        {!provisional && (
          <span style={{ display: 'block', marginTop: 4, color: CREAM }}>
            {vnd(num(spec.unit))}
          </span>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        {gone ? (
          <span className="pk-eyebrow" style={{ color: AMBER }}>
            {c.status === 'sold' ? t('Sold', 'Đã bán') : t('Being confirmed', 'Đang xác nhận')}
          </span>
        ) : (
          <button onClick={onChoose} className="pk-cta" style={{ marginTop: 0 }}>
            {provisional ? t('Interest', 'Quan tâm') : t('Reserve', 'Giữ chỗ')} <span className="pk-go">→</span>
          </button>
        )}
      </div>
    </div>
  )
}

const pick = (on: boolean): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
  color: on ? GOLD : CREAM, opacity: on ? 1 : .5,
  borderBottom: on ? `1px solid ${GOLD}` : '1px solid transparent',
})
