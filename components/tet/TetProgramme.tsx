'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'
import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Masthead, SectionHead, Details, Cta, MONO, GOLD } from '@/components/public/kit'
import { timeRemaining } from '@/lib/tet/queries'
import { caskColour } from '@/lib/tet/colour'
import { vnd, type BlendBoardRow, type CaskBoardRow, type Countdown, type TetCategory, type VolumeTier } from '@/lib/tet/types'
import TetEnquiry, { type EnquiryTarget } from '@/components/tet/TetEnquiry'
import TetTiers from '@/components/tet/TetTiers'
import SleeveStudio, { type SleeveDesign } from '@/components/tet/SleeveStudio'
import TetTimeline from '@/components/tet/TetTimeline'
import TetLabels from '@/components/tet/TetLabels'
import TetFlight from '@/components/tet/TetFlight'
import TetCaskChart from '@/components/tet/TetCaskChart'
import TetPlate, { TET_PLATE_CSS } from '@/components/tet/TetPlate'
import { Reveal, ScrollRail, TET_SCROLL_CSS } from '@/components/tet/TetScroll'

// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT PROGRAMME — built from the public kit, like the rest of the site.
// ───────────────────────────────────────────────────────────────────────────
// Left-aligned, huge display type, mono for everything else, hairlines instead
// of boxes, and full-bleed pictures fading into the ground. The first version
// of this page was a wall of bordered cards — the admin portal's furniture on
// a page meant for a buyer.
//
// PICTURES ARE SHOWN WHOLE, AND THEY ARE NOT CROPPED EITHER. They used to be full-bleed bands, which sounds
// generous and is the opposite: a band crops the photograph to the band's
// shape, and on a picture of a bottle the part that does not fit IS the
// bottle. Every photograph here is now a TetPlate, framed at its own aspect
// ratio, so nothing is cut off at any screen width. See components/tet/TetPlate.
//
// The second half of that took another pass. Boxing the files I had only ever
// preserved the ratio of MY OWN CROPS — the first version had resized the
// source photography to fit the bands with fit:'cover', so the frame was
// honest about a picture that had already lost its edges. These are the
// photographs at their native shape, lifted from Duncan Taylor's own decks
// (The Octave Brand Guidelines, The Octave, the 2025 deck) where they sit as
// embedded images at full resolution, and exported with fit:'inside' so no
// pixel is thrown away: 1828×1372 stays 1.332, 1082×592 stays 1.828.
//
// Two pictures were dropped rather than re-framed. The Blend 18 and the Black
// Bull 30 are pack shots on a WHITE background — on this green ground they
// are white boxes with a bottle in them, and no amount of framing fixes that.
// The Black Bull was also in the Octave section, which is single casks: it is
// a blend, so it was arguing against the words next to it.
//
// The blends came back as their LABELS (2026-09-22, the owner: "use the images
// of the 5 star, 12 and 18"): Duncan Taylor's print artwork cut inside the
// dieline, so there is no white ground to fight — see TetLabels. The tasting
// flight moved down to the casks, where its five bottles now each carry a fact
// about a wood in that list (TetFlight), and the casks gained a chart of the
// whole selection (TetCaskChart).
//
// The masthead carries the Duncan Taylor crest instead. It is the right mark
// for a page that is a Duncan Taylor programme, it is gold on green rather
// than a white rectangle, and it is drawn from the high-resolution master and
// tinted, not scaled up from a thumbnail.
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
  // One at a time. Several open at once turns the list back into the wall of
  // text it was, and nothing is being compared side by side anyway.
  const [openCask, setOpenCask] = useState<string | null>(null)
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
      <style dangerouslySetInnerHTML={{ __html: TET_PLATE_CSS + CASK_CSS + TET_SCROLL_CSS }} />
      <ScrollRail />
      {/* THE SWITCH STAYS WITH YOU. It was absolute, so it scrolled away after
          the masthead — on a page this long that is the same as not having one.
          And it was tone="light", which is the control for a CREAM page: on
          this ground it all but disappeared. */}
      {/* THE WAY OUT, WHICH THIS PAGE DID NOT HAVE. Every other public surface
          carries NavOverlay; /tet was built as a standalone campaign page and
          got neither the menu nor the crest that returns you home — so a
          visitor who followed a QR code into it was stuck with the back
          gesture. `dark` because the ground is #052E20.
          No collision with the switch below: the trigger is pinned top-LEFT
          and the crest sits centre-right. */}
      <NavOverlay variant="public" dark />

      <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 8000 }}>
        <LangToggle />
      </div>

      <Masthead
        title={<>Tết<br />Đinh Mùi</>}
        sub="2027"
        lede={t('Whisky for the companies you thank at Tết — three blends in a sleeve carrying your name, or a single cask with every bottle numbered.',
                'Rượu whisky để tri ân đối tác dịp Tết — ba dòng pha trộn trong hộp in tên công ty, hoặc trọn một thùng đơn với từng chai được đánh số.')}
        art={
          /* The Octave Huntly 27 by the fire, from The Octave Brand Guidelines,
             at its own 2:3 — the owner: "a portrait Octave bottle photo… the
             beautiful ones". The Duncan Taylor crest that stood here moved to
             the foot of the page, as "brought to you by". */
          <div className="pk-thumb" style={{ aspectRatio: '800 / 1201', maxWidth: 360, marginInline: 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/tet/octave-fire.webp"
                 srcSet="/images/tet/octave-fire-sm.webp 480w, /images/tet/octave-fire.webp 800w"
                 sizes="(max-width: 780px) 70vw, 360px" width={800} height={1201}
                 alt={t('The Octave Huntly 27 by the fire, a glass poured', 'The Octave Huntly 27 bên lò sưởi, một ly đã rót')}
                 fetchPriority="high" />
          </div>
        }
      >
        <Cta onClick={openBlend}>{t('Register interest', 'Đăng ký quan tâm')}</Cta>
      </Masthead>

      {countdown && <NextGate cd={countdown} t={t} />}

      {/* The first photograph, straight under the masthead — an Octave in
          Scottish heather. Eager and high priority because it is the page's
          first impression; everything below it waits its turn. As a band this
          one lost its neck and its base to the crop. */}
      <section className="pk-wrap" style={{ paddingTop: 64 }}>
        <TetPlate
          src="/images/tet/burn.webp" sm="/images/tet/burn-sm.webp"
          width={1400} height={1051} smWidth={820} eager
          alt={t('An Octave blended malt beside a Highland burn',
                 'Chai Octave blended malt bên dòng suối vùng cao nguyên')}
          caption={t('The Octave · Campbeltown', 'The Octave · Campbeltown')}
        />
      </section>

      {countdown && <TetTimeline cd={countdown} t={t} locale={vn ? 'vi-VN' : 'en-GB'} />}

      {/* ── THE BLENDS ────────────────────────────────────────────────── */}
      <section className="pk-wrap pk-section">
        <Reveal>
          <SectionHead
            eyebrow={t('From fifty bottles', 'Từ năm mươi chai')}
            title={blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor'}
          />
        </Reveal>
        {blendCat && (
          <Reveal step={1}>
            <p className="pk-lede">{vn ? blendCat.standfirst_vn : blendCat.standfirst_en}</p>
          </Reveal>
        )}

        {/* The three labels, before the words about them. */}
        <Reveal step={2}>
          <TetLabels blends={[...new Map(blends.map(b => [b.sku, b])).values()].map(b => ({
            sku: b.sku,
            name: b.expression || (vn ? b.name_vn : b.name_en),
            detail: `${b.abv_pct}% · ${b.bottle_size_ml}ml`,
          }))} />
        </Reveal>

        <Reveal step={3} style={{ marginTop: 40 }}>
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
        </Reveal>

        {tiers.length > 0 && (
          <div style={{ marginTop: 52 }}>
            <TetTiers tiers={tiers} provisional={provisional} />
            <p className="pk-meta" style={{ marginTop: 22, maxWidth: 560, lineHeight: 1.9 }}>
              {t('The tier is set by the total across all three, so a mixed order still climbs. Every sleeve carries your logo.',
                 'Mức chiết khấu tính trên tổng số chai của cả ba dòng, nên đơn hàng pha trộn vẫn được nâng mức. Mỗi hộp đều in logo của quý vị.')}
            </p>
          </div>
        )}

        <Cta onClick={openBlend}>{t('Register interest', 'Đăng ký quan tâm')}</Cta>
      </section>

      {/* ── THE SLEEVE STUDIO ─────────────────────────────────────────
          The question a buyer is actually asking is "what will it look like
          with our logo on it". Prose cannot answer that. */}
      <section className="pk-wrap pk-section">
        <Reveal>
          <SectionHead
            eyebrow={t('Make it yours', 'Cá nhân hoá')}
            title={t('The sleeve', 'Hộp đựng')}
          />
        </Reveal>
        <Reveal step={1}>
        <p className="pk-lede">
          {t('Every bottle comes in Duncan Taylor’s Tết sleeve. Put your logo on its blank face and see it where it will print.',
             'Mỗi chai đều có hộp Tết của Duncan Taylor. Đặt logo của quý vị lên mặt trống và xem vị trí sẽ in.')}
        </p>
        </Reveal>
        <div style={{ marginTop: 44 }}>
          <SleeveStudio onUse={d => {
            setDesign(d)
            setTarget({ kind: 'blend', title: blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor' })
          }} />
        </div>
      </section>

      {/* Before the casks: the man who closes them, and the thing itself. Side
          by side because they are one argument — a single cask is a place and
          a pair of hands, not a product line. Each keeps its own shape; they
          stack on a phone rather than shrinking to stamps. */}
      <section className="pk-wrap" style={{ paddingTop: 96 }}>
        <div className="tp-pair">
          <TetPlate
            src="/images/tet/cooper.webp" sm="/images/tet/cooper-sm.webp"
            width={1082} height={592} smWidth={820} maxWidth={620}
            alt={t('A cooper at work among the casks', 'Thợ đóng thùng làm việc giữa những thùng rượu')}
            caption={t('Huntly · the cooperage', 'Huntly · xưởng đóng thùng')}
          />
          <TetPlate
            src="/images/tet/char.webp" sm="/images/tet/char-sm.webp"
            width={1152} height={768} smWidth={820} maxWidth={620}
            step={2}
            alt={t('A cask being charred', 'Thùng gỗ đang được nung cháy bề mặt')}
            caption={t('The char that makes the whisky', 'Lớp than tạo nên hương vị')}
          />
        </div>
      </section>

      {/* ── THE CASKS ─────────────────────────────────────────────────── */}
      <section className="pk-wrap pk-section">
        <Reveal>
          <SectionHead
            eyebrow={t('Fourteen single casks', 'Mười bốn thùng đơn')}
            title={caskCat ? (vn ? caskCat.name_vn : caskCat.name_en) : 'The Octave Selection'}
          />
        </Reveal>
        {caskCat && (
          <Reveal step={1}>
            <p className="pk-lede">{vn ? caskCat.standfirst_vn : caskCat.standfirst_en}</p>
          </Reveal>
        )}

        {/* THE OFFER — the owner's words, 2026-09-22: "Every octave bought
            this tet will be shipped out with its cask end!" Nothing added to
            it: no size, weight or finish is promised, because none was given.
            The drawing is a cask end — the staves, the hoops' line — and it
            draws itself once, when it arrives. */}
        <Reveal step={2}>
          <div className="ck-offer">
            <svg className="ck-end" viewBox="0 0 64 64" aria-hidden>
              <circle cx="32" cy="32" r="29" />
              <circle cx="32" cy="32" r="24" />
              {[-16, -8, 0, 8, 16].map(x => (
                <line key={x} x1={32 + x} y1={32 - Math.sqrt(24 * 24 - x * x)} x2={32 + x} y2={32 + Math.sqrt(24 * 24 - x * x)} />
              ))}
            </svg>
            <div>
              <div className="pk-eyebrow" style={{ color: '#D4B85A' }}>{t('This Tết only', 'Chỉ trong dịp Tết này')}</div>
              <p className="ck-offer-line">
                {t('Every Octave bought this Tết is shipped with its cask end.',
                   'Mỗi thùng Octave mua trong dịp Tết này sẽ được giao kèm mặt thùng của chính nó.')}
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal step={3}>
          <TetCaskChart casks={casks} t={t} onPick={ref => {
            setOpenCask(ref)
            requestAnimationFrame(() => document.getElementById(`cask-${ref}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
          }} />
        </Reveal>

        {/* THE TOGGLE IS THE ARGUMENT. Duty and tax are charged on value, not
            on alcohol, so bottling a strong young cask at 50% multiplies the
            bottles without multiplying the tax — and on a weak old cask it
            does almost nothing. The page shows both, honestly. */}
        <Reveal step={4} style={{ display: 'flex', gap: 22, alignItems: 'baseline', marginTop: 48, flexWrap: 'wrap' }}>
          <span className="pk-eyebrow">{t('Bottled at', 'Đóng chai ở')}</span>
          {offered.map(s => (
            <button key={s.key} onClick={() => setStrength(s.key)} style={pick(strength === s.key)}>
              {t(s.en, s.vn)}
            </button>
          ))}
        </Reveal>

        {/* The list arrives in order, capped at eight steps — fourteen rows
            each waiting on the one above is a queue, not a reveal. */}
        <div style={{ marginTop: 24 }}>
          {casks.map((c, i) => (
            <Reveal key={c.cask_ref} variant="slide" step={Math.min(i, 8)}>
            <CaskRow c={c} strength={strength} vn={vn} t={t} provisional={provisional}
                     open={openCask === c.cask_ref}
                     onToggle={() => setOpenCask(o => o === c.cask_ref ? null : c.cask_ref)}
                     onChoose={() => setTarget({
                       kind: 'cask', cask_ref: c.cask_ref,
                       title: `${c.cask_ref} · ${c.distillery}`,
                       target_abv: strength === 'cask' ? null : Number(strength),
                     })} />
            </Reveal>
          ))}
        </div>

        {/* The flight, after the list: five samples, each a fact about a wood
            the list above is made of. */}
        <div style={{ marginTop: 88 }}>
          <TetFlight casks={casks} t={t} />
        </div>
      </section>

      <section className="pk-wrap" style={{ paddingTop: 96 }}>
        <TetPlate
          src="/images/tet/moss.webp" sm="/images/tet/moss-sm.webp"
          width={1400} height={933} smWidth={820}
          alt={t('An Octave single malt on a Speyside hillside',
                 'Chai Octave single malt trên sườn đồi Speyside')}
          caption={t('Fons et origo · the source', 'Fons et origo · khởi nguồn')}
          overlay={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 1.6vw, 20px)' }}>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(20px, 2.8vw, 36px)', lineHeight: 1,
                             color: '#E5D4C2', letterSpacing: '.01em' }}>
                {t('brought to you by', 'được mang đến bởi')}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/tet/dt-crest.png" width={900} height={913} alt="Duncan Taylor Scotch Whisky"
                   style={{ width: 'clamp(58px, 7vw, 92px)', height: 'auto', display: 'block' }} />
            </div>
          }
        />
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

// ═══════════════════════════════════════════════════════════════════════════
// A CASK, WHICH OPENS WHERE IT SITS.
// ───────────────────────────────────────────────────────────────────────────
// Fourteen casks were fourteen identical lines of small type. Everything that
// makes one cask different from the next — the wood it sat in, the year it
// went in, what it actually tastes like — was in the database and on none of
// the page. A buyer choosing between Glen A and Glen B had a distillery name
// and a bottle count to do it with.
//
// The row opens in place rather than into a modal. A modal would cover the
// strength buttons, which are the one control that changes what the row says;
// opening downward keeps the comparison on screen, and closing it leaves you
// exactly where you were in a long list.
//
// The height animates with grid-template-rows: 0fr → 1fr. A tasting note has
// no height anybody can know in advance, and max-height guesses either clip a
// long note or crawl through empty space on a short one.
// ═══════════════════════════════════════════════════════════════════════════
function CaskRow({ c, strength, vn, t, provisional, onChoose, open, onToggle }: {
  c: CaskBoardRow; strength: Strength; vn: boolean
  t: (en: string, v: string) => string
  provisional: boolean
  onChoose: () => void
  open: boolean
  onToggle: () => void
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
  const asked = strength === 'cask' ? null : Number(strength)
  const noSuchStrength = asked !== null && c.cask_abv_pct <= asked
  const note = vn ? (c.tasting_note_vn || c.tasting_note_en) : c.tasting_note_en

  return (
    <div id={`cask-${c.cask_ref}`} className={`ck ${open ? 'is-open' : ''}`} style={{ opacity: gone ? .42 : 1, scrollMarginTop: 90 }}>
      <button className="ck-head" onClick={onToggle} aria-expanded={open}>
        <span className="ck-name">
          <span className="pk-h3">{c.distillery}</span>
          <span className="pk-meta ck-sub">
            {c.cask_ref} · {c.region} · {c.age_years}{t('yo', ' năm')} · {c.cask_abv_pct}%
          </span>
        </span>

        <span className="pk-meta ck-figs">
          {noSuchStrength ? (
            <span style={{ opacity: .6 }}>{t(`already below ${asked}%`, `đã dưới ${asked}%`)}</span>
          ) : (
            <>
              <span style={{ color: CREAM, fontSize: 15 }}>{bottles}</span> {t('bottles', 'chai')}
              {gain > 0 && <span style={{ color: SAGE }}> · +{gain}</span>}
            </>
          )}
          {!provisional && (
            <span style={{ display: 'block', marginTop: 4, color: CREAM }}>{vnd(num(spec.unit))}</span>
          )}
        </span>

        <span className="ck-chev" aria-hidden>
          {gone
            ? <span className="pk-eyebrow" style={{ color: AMBER }}>
                {c.status === 'sold' ? t('Sold', 'Đã bán') : t('Being confirmed', 'Đang xác nhận')}
              </span>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>}
        </span>
      </button>

      <div className="ck-wrap">
        <div className="ck-inner">
          <div className="ck-body">
            <div>
              {note
                ? <p className="ck-note">{note}</p>
                : <p className="ck-note" style={{ opacity: .45 }}>
                    {t('The tasting note is written when the cask is confirmed with Huntly.',
                       'Ghi chú hương vị sẽ được viết khi thùng được xác nhận với Huntly.')}
                  </p>}

              {/* WHAT THE STRENGTH BUTTONS ACTUALLY DO, in a sentence, for this
                  cask. The number above answers "how many"; this answers "why",
                  and it is the argument the whole section is making. */}
              {!noSuchStrength && gain > 0 && (
                <p className="ck-gain">
                  {t(`Bottled at ${asked}% this cask gives ${gain} more bottles than at cask strength — duty is charged on value, not on alcohol.`,
                     `Đóng chai ở ${asked}%, thùng này cho thêm ${gain} chai so với nguyên độ — thuế tính trên giá trị, không theo nồng độ.`)}
                </p>
              )}
            </div>

            <dl className="ck-spec">
              <div><dt>{t('Cask', 'Thùng')}</dt><dd>{c.cask_type}{c.wood ? ` · ${c.wood}` : ''}</dd></div>
              {c.vintage_year && <div><dt>{t('Filled', 'Năm vào thùng')}</dt><dd>{c.vintage_year}</dd></div>}
              <div><dt>{t('Region', 'Vùng')}</dt><dd>{c.region}</dd></div>
              <div>
                <dt>{t('Colour', 'Màu')}</dt>
                <dd>
                  {(() => {
                    // EBC, the scale Scotch is quoted in, with the SRM it
                    // converts from. Estimated FROM THE SWATCH — see
                    // lib/tet/colour — so it wears a ≈ and says so below.
                    const col = caskColour(c.colour_hex)
                    if (!c.colour_hex) return <span style={{ opacity: .45 }}>—</span>
                    return (
                      <span className="ck-colour">
                        <span className="ck-swatch" style={{ background: c.colour_hex }} />
                        {col && (
                          <span className="ck-ebc">
                            ≈ {col.ebc} EBC
                            <span className="ck-srm"> · {col.srm} SRM</span>
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </dd>
              </div>
              <div className="ck-ebcnote">
                {t('Colour is estimated from the swatch, not measured. Huntly’s figures replace it when the cask is confirmed.',
                   'Màu được ước tính từ mẫu hiển thị, chưa đo bằng máy. Số liệu từ Huntly sẽ thay thế khi thùng được xác nhận.')}
              </div>
            </dl>
          </div>

          {!gone && (
            <button onClick={onChoose} className="pk-cta" style={{ marginTop: 18 }}>
              {provisional ? t('Interest', 'Quan tâm') : t('Reserve', 'Giữ chỗ')} <span className="pk-go">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const CASK_CSS = `
.ck-offer { display: grid; grid-template-columns: 64px 1fr; gap: 24px; align-items: center;
            margin-top: 44px; padding: 26px 0; border-top: 1px solid rgba(212,184,90,.45);
            border-bottom: 1px solid rgba(212,184,90,.45); }
.ck-offer-line { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(21px, 2.6vw, 30px);
                 line-height: 1.2; margin: 8px 0 0; color: #E5D4C2; }
.ck-end { width: 64px; height: 64px; fill: none; stroke: #D4B85A; stroke-width: 1.2; }
.ck-end * { stroke-dasharray: 190; stroke-dashoffset: 190;
            transition: stroke-dashoffset 1.6s cubic-bezier(.16,.84,.44,1) .35s; }
.ck-end line { transition-delay: .9s; }
.tr.is-in .ck-end * { stroke-dashoffset: 0; }
@media (max-width: 560px) { .ck-offer { grid-template-columns: 44px 1fr; gap: 16px; } .ck-end { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .ck-end * { transition: none; stroke-dashoffset: 0; } }
.ck { border-top: 1px solid rgba(229,212,194,.14); }
.ck-head { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1fr) auto;
           gap: 18px; align-items: baseline; width: 100%; text-align: left;
           background: none; border: none; padding: 16px 0; cursor: pointer;
           color: inherit; font: inherit; -webkit-tap-highlight-color: transparent; }
.ck-head:hover .ck-name .pk-h3, .ck.is-open .ck-name .pk-h3 { color: ${GOLD}; }
.ck-name .pk-h3 { display: block; transition: color .3s ease; }
.ck-sub { display: block; margin-top: 4px; }
.ck-figs { font-size: 12.5px; }
.ck-chev { display: flex; justify-content: flex-end; align-items: center;
           color: rgba(229,212,194,.5); transition: transform .4s cubic-bezier(.16,.84,.44,1); }
.ck.is-open .ck-chev { transform: rotate(180deg); color: ${GOLD}; }

/* 0fr → 1fr: animates to a height nobody had to measure. */
.ck-wrap { display: grid; grid-template-rows: 0fr;
           transition: grid-template-rows .5s cubic-bezier(.16,.84,.44,1); }
.ck.is-open .ck-wrap { grid-template-rows: 1fr; }
.ck-inner { overflow: hidden; }
.ck.is-open .ck-inner { padding-bottom: 26px; }

.ck-body { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr);
           gap: clamp(20px, 4vw, 56px); padding-top: 4px; }
@media (max-width: 720px) { .ck-body { grid-template-columns: 1fr; gap: 22px; }
                            .ck-head { grid-template-columns: minmax(0,1fr) auto; }
                            .ck-figs { grid-column: 1 / -1; } }

.ck-note { font-family: ${MONO}; font-size: 13.5px; line-height: 1.95;
           color: rgba(229,212,194,.8); margin: 0; max-width: 56ch; }
.ck-gain { font-family: ${MONO}; font-size: 12px; line-height: 1.85;
           color: ${SAGE}; margin: 14px 0 0; max-width: 56ch; }

.ck-spec { margin: 0; font-family: ${MONO}; font-size: 12px; }
.ck-spec > div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 7px 0;
                 border-top: 1px solid rgba(229,212,194,.1); }
.ck-spec dt { letter-spacing: .12em; text-transform: uppercase; opacity: .45; margin: 0; }
.ck-spec dd { margin: 0; color: rgba(229,212,194,.85); }
.ck-colour { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ck-swatch { display: inline-block; width: 42px; height: 14px; border-radius: 2px;
             border: 1px solid rgba(229,212,194,.25); vertical-align: middle; }
.ck-ebc { font-family: ${MONO}; font-size: 12px; color: ${GOLD}; letter-spacing: .04em; }
.ck-srm { opacity: .45; color: rgba(229,212,194,.85); }
.ck-ebcnote { display: block; grid-template-columns: none; border: none;
              font-family: ${MONO}; font-size: 10.5px; line-height: 1.7;
              opacity: .4; padding-top: 10px; max-width: 42ch; }

@media (prefers-reduced-motion: reduce) {
  .ck-wrap, .ck-chev, .ck-name .pk-h3 { transition: none; }
}
`

const pick = (on: boolean): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
  color: on ? GOLD : CREAM, opacity: on ? 1 : .5,
  borderBottom: on ? `1px solid ${GOLD}` : '1px solid transparent',
})
