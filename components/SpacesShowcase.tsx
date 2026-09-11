'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'
import {
  PublicPage, Masthead, Rise, Eyebrow, Cta, InkFloat, BleedImage,
  CREAM, INK, SAGE, SERIF, MONO, type Ink,
} from '@/components/public/kit'

// The club's spaces, floor by floor. ONE component drives two surfaces:
//   variant="internal" → /members/spaces (members: full CTAs incl. menu + events)
//   variant="public"   → /spaces         (public mirror: NO menu / events links)
// Menus and events are members-only, so their CTAs render only in the internal
// variant. Everything else — photos, descriptions, the Studio exhibition — is
// identical on both, so the public page is a true showcase of the building.
//
// ═══ SET TO THE /studio BENCHMARK, AT NIGHT ═══════════════════════════════
// The ground stays bottle green. It is the spaces' night look, it is the
// member portal's own ground (this component is rendered there too, so the
// page never paints a cream slab inside the portal), and warm interiors fading
// into dark green read as the building after hours — which is when it is used.
//
// Each room arrives as a full-bleed photograph fading into the ground (the
// /studio hero), with its name set large beneath it and the floor's lion as its
// emblem. The photographs are the SEAMS: each band fades in from the ground
// above it and out into its own, so there is never a hairline between floors.
//
// The Studio is the one band in sage — the room's own colour, exactly as the
// homepage's Studio invitation is — so it reads as a door to somewhere else.
//
// The house's ink drawings are black line on transparent, drawn for cream. On
// green they are turned to chalk (luminance inverted, hue kept) so the line
// goes cream and the whisky stays amber. On the sage band they are left as drawn.

interface Space {
  id: string
  floor: string
  en: string
  vn: string
  descEn: string
  descVn: string
  accent: string
  photo?: string
  // The floor's own lion, cream on transparent (public/images/floors/README.md).
  // NOT photography: the marketing shots in social/*.webp already carry /menus,
  // /membership and /origin, and a member who has seen them twice would notice
  // them a third time. When the rooms are shot properly — five spaces, one
  // evening, someone who can handle low light — THAT is the moment to swap, and
  // the swap is this one field.
  mark?: string
  // A room behind the mark. Not `photo`: that field is the eventual full swap
  // to photography, and this is the interim. It now runs as the floor's
  // full-bleed band.
  backdrop?: string
  // Where the band crops a portrait photograph into a wide strip.
  focus?: string
  // The house drawing that keeps the floor company.
  ink?: Ink
}

const SPACES: Space[] = [
  {
    id: 'lab',
    mark: '/images/floors/source-origin-lab.png',
    ink: 'glass-botanical',
    floor: '5',
    en: 'The Source & Origin Lab',
    vn: 'Phòng Thí Nghiệm Nguồn Gốc',
    descEn: "A collaboration with Duncan Taylor — our in-house innovation lab for cutting-edge beverages, experimental blends, and members-only bottlings.",
    descVn: 'Hợp tác với Duncan Taylor — phòng thí nghiệm đổi mới sáng tạo cho đồ uống tiên tiến và các phiên bản đóng chai dành riêng cho thành viên.',
    accent: '#3F5546',
  },
  {
    id: 'rampant-room',
    mark: '/images/floors/rampant-room.png',
    backdrop: '/images/floors/rampant-room-backdrop.jpg',
    focus: '50% 62%',
    ink: 'lion-bottle',
    floor: '4',
    en: 'The Rampant Room',
    vn: 'Phòng Rampant',
    descEn: 'Home to over 300 unique global whiskies. Our bottle-share room where members explore rare and unusual expressions together.',
    descVn: 'Nơi lưu giữ hơn 300 loại whisky độc đáo từ khắp nơi trên thế giới. Phòng chia sẻ chai nơi các thành viên cùng khám phá.',
    accent: '#5E4F3A',
  },
  {
    id: 'dining',
    mark: '/images/floors/dining-room.png',
    backdrop: '/images/floors/dining-room-backdrop.jpg',
    focus: '50% 58%',
    ink: 'butler-tray',
    floor: '3',
    en: 'The Dining Room',
    vn: 'Phòng Ăn',
    descEn: 'Private dining for meetings, birthday soirées, and intimate gatherings. Fine wines, gourmet cuisine, and a space that feels like home.',
    descVn: 'Phòng ăn riêng cho các cuộc họp, tiệc sinh nhật và những buổi họp mặt thân mật. Rượu vang hảo hạng và ẩm thực cao cấp.',
    accent: '#4A3F36',
  },
  {
    id: 'studio',
    mark: '/images/ink/floor-studio.webp',   // the green lion: this floor sits on sage
    backdrop: '/images/floors/studio-backdrop.jpg',
    focus: '50% 42%',
    floor: '2',
    en: 'The Studio',
    vn: 'Phòng Studio',
    descEn: "A quarterly rotating curated art space featuring immersive installations by Vietnamese and international artists. Each exhibition includes an artist-created member's whisky.",
    descVn: 'Không gian nghệ thuật luân chuyển theo quý với các tác phẩm sắp đặt đắm chìm từ các nghệ sĩ Việt Nam và quốc tế.',
    accent: '#5C4A3E',
  },
  {
    id: 'library-bar',
    mark: '/images/floors/library-bar.png',
    backdrop: '/images/floors/library-bar-backdrop.jpg',
    focus: '50% 60%',
    ink: 'gent-toast',
    floor: '1',
    en: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    descEn: 'A private cocktail bar with seasonal menus, vintage spirits, a curated book collection, board games, and regular live music evenings. The heart of the club.',
    descVn: 'Quầy bar cocktail riêng với thực đơn theo mùa, rượu cổ điển, bộ sưu tập sách, trò chơi board game và các buổi tối nhạc sống.',
    accent: '#3D5043',
  },
  {
    id: 'sports',
    mark: '/images/floors/sports-club.svg',
    backdrop: '/images/floors/sports-backdrop.jpg',
    focus: '50% 34%',
    ink: 'tee-glass',
    floor: '—',
    en: 'T.R.C Sports Club',
    vn: 'Câu Lạc Bộ Thể Thao',
    descEn: 'Golf, tennis, pickleball, padel, and sailing. Organised outings, friendly competitions, and an active community beyond the bar.',
    descVn: 'Golf, tennis, pickleball, padel và chèo thuyền buồm. Các chuyến đi có tổ chức, thi đấu giao hữu và cộng đồng năng động.',
    accent: '#46553F',
  },
]

const NIGHT = INK                     // the ground: bottle green
const groundOf = (s: Space) => (s.id === 'studio' ? SAGE : NIGHT)

// The CTA strings carry their own "→" (and their translations with them). The
// kit's CTA draws a sliding arrow of its own, so the typed one is dropped at
// render time rather than editing the strings.
const bare = (s: string) => s.replace(/\s*→\s*$/, '')

// The masthead's still life — things on a table in an empty room, after hours.
const STILL: { name: Ink; w: string; top: string; left: string; rot: number; dur: number }[] = [
  { name: 'lion-reclining', w: '66%', top: '34%', left: '14%', rot: -3,  dur: 9 },
  { name: 'glass',          w: '25%', top: '2%',  left: '64%', rot: 8,   dur: 7.5 },
  { name: 'key',            w: '15%', top: '6%',  left: '22%', rot: -24, dur: 7 },
  { name: 'newspaper',      w: '24%', top: '74%', left: '70%', rot: 10,  dur: 8 },
]

const CSS = `
  .sp { position: relative; }
  .sp .pk-float.sp-chalk img { filter: invert(.9) hue-rotate(180deg) sepia(.35) saturate(1.4); }

  .sp-back { color: inherit; text-decoration: none; border-bottom: 1px solid currentColor; padding-bottom: 3px; }

  /* the lobby board: every floor, top to bottom */
  .sp-dir { list-style: none; margin: 40px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 32px; max-width: 580px; }
  .sp-dir a { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: baseline; padding: 8px 0;
              color: inherit; text-decoration: none; }
  .sp-dir-no { font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; opacity: .7; }
  .sp-dir-name { font-family: ${SERIF}; font-size: 19px; line-height: 1.15; }

  .sp-still { position: relative; width: 88%; aspect-ratio: 1 / .9; margin-left: auto; }

  /* the floor rail — LEFT, not right: on the right it landed on the pictures
     half as often as not. Hidden on a phone, where the lobby board does it. */
  .sp-rail { position: fixed; top: 50%; left: 22px; transform: translateY(-50%); z-index: 20;
             display: flex; flex-direction: column; gap: 6px; padding: 10px 7px; border-radius: 20px;
             background: rgba(5,46,32,.42); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .sp-rail button { width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer; background: transparent;
                    color: ${CREAM}; opacity: .55; font-family: ${SERIF}; font-size: 14px;
                    transition: opacity .25s, background .25s, color .25s, transform .25s; }
  .sp-rail button:hover { opacity: 1; }
  .sp-rail button.is-on { opacity: 1; background: ${CREAM}; color: ${INK}; transform: scale(1.06); }
  @media (max-width: 860px) { .sp-rail { display: none; } }

  /* a floor */
  .sp-floor { position: relative; padding-bottom: 130px; scroll-margin-top: 0; }
  .sp-floor.is-plain { padding-top: 40px; }
  .sp-band { position: relative; }
  .sp-band-top { position: absolute; inset: 0; pointer-events: none; }
  .sp-body { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: start; }
  /* Only the words step up into the fade — the lion straddles the seam. The
     other column stays on the ground: nothing is set over a photograph. */
  .sp-band + .sp-body .sp-words { margin-top: -96px; }
  .sp-side { align-self: center; }
  .sp-side.is-top { align-self: start; padding-top: 28px; }
  .sp-floor.is-flipped .sp-words { order: 2; }
  .sp-floor.is-flipped .sp-side  { order: 1; }

  .sp-crest { display: block; height: 104px; width: auto; margin: 0 0 22px;
              transform: rotate(-4deg); filter: drop-shadow(0 4px 18px rgba(5,46,32,.35)); }
  .sp-title { max-width: 12ch; }
  .sp-words .pk-lede { margin-top: 26px; }
  .sp-other { margin: 16px 0 0; max-width: 560px; }
  .sp-ctas { display: flex; flex-wrap: wrap; gap: 0 28px; }

  .sp-art { width: min(320px, 72%); margin: 0 auto; }
  .sp-art.is-tall { width: min(250px, 60%); }

  .sp-h3 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 3.6vw, 46px); line-height: 1; margin: 14px 0 0; }
  .sp-by { font-family: ${SERIF}; font-size: clamp(17px, 2vw, 22px); opacity: .72; margin: 10px 0 22px; }
  .sp-film { position: relative; padding-bottom: 56.25%; height: 0; border-radius: 14px; overflow: hidden;
             box-shadow: 0 18px 44px rgba(0,0,0,.28); }
  .sp-film iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
  .sp-film-wide { max-width: 1000px; margin-top: 72px; }
  .sp-cup-ink { width: 150px; margin: 0 0 -26px auto; position: relative; z-index: 1; }

  @media (max-width: 860px) {
    .sp-dir { grid-template-columns: 1fr; gap: 0; }
    .sp-still { width: 100%; max-width: 400px; margin: 8px auto 0; }
    .sp-floor { padding-bottom: 92px; }
    .sp-floor.is-plain { padding-top: 8px; }
    .sp-body { grid-template-columns: 1fr; gap: 36px; }
    .sp-band + .sp-body .sp-words { margin-top: -72px; }
    .sp-side.is-top { padding-top: 0; }
    .sp-floor.is-flipped .sp-words { order: 0; }
    .sp-floor.is-flipped .sp-side  { order: 0; }
    .sp-crest { height: 80px; margin-bottom: 16px; }
    .sp-art { width: 58vw; max-width: 260px; margin: 0 0 0 auto; }
    .sp-film-wide { margin-top: 48px; }
    .sp-cup-ink { width: 110px; margin-bottom: -18px; }
    .sp .pk-bleed { height: min(64vh, 540px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sp-rail button { transition: none; }
  }
`

export default function SpacesShowcase({ variant }: { variant: 'internal' | 'public' }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const internal = variant === 'internal'
  const { t, lang } = useLang()
  const vn = lang === 'vn'

  // The floor that crosses the middle of the screen is the one the rail lights.
  // A ratio threshold stopped working once a floor could be taller than three
  // screens (the Studio, with its film): its ratio never reached the mark.
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setActiveIdx(Number((e.target as HTMLElement).dataset.idx || 0))
      })
    }, { rootMargin: '-45% 0px -45% 0px' })
    sectionRefs.current.forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const goTo = (idx: number) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sectionRefs.current[idx]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const nameOf = (s: Space) => (vn ? s.vn : s.en)

  return (
    <PublicPage ground={NIGHT} ink={CREAM}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sp">
        {/* ══ THE MASTHEAD ═════════════════════════════════════════════════
            VN promotes the Vietnamese to the heading and demotes the English,
            as MemberPage does. */}
        <Masthead
          eyebrow={internal
            ? <Link href="/members" className="sp-back">&larr; {t('Back to dashboard', 'Về Trang Chính')}</Link>
            : <Link href="/" className="sp-back">&larr; {t('Back to home', 'Về trang chủ')}</Link>}
          title={vn ? 'Không gian của câu lạc bộ' : internal ? 'Our Spaces' : 'Club Spaces'}
          sub={vn ? (internal ? 'Our Spaces' : 'Club Spaces') : 'Không gian của câu lạc bộ'}
          lede={t('Five floors and a sports club. Each space has its own character; each floor, its own purpose. Scroll through to walk the building, top to bottom.',
            'Năm tầng lầu và một câu lạc bộ thể thao. Mỗi không gian một cá tính; mỗi tầng một mục đích riêng. Cuộn xuống để dạo quanh toà nhà, từ trên xuống dưới.')}
          art={
            <div className="sp-still" aria-hidden="true">
              {STILL.map(o => (
                <InkFloat key={o.name} name={o.name} width={o.w} rot={o.rot} dur={o.dur} className="sp-chalk"
                          style={{ position: 'absolute', top: o.top, left: o.left }} />
              ))}
            </div>
          }
        >
          {/* The lobby board — the building, top to bottom, as the rail has it. */}
          <nav aria-label={t('Floor navigator', 'Điều hướng tầng')}>
            <ul className="sp-dir">
              {SPACES.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="pk-hover"
                     onClick={e => { e.preventDefault(); goTo(i) }}>
                    <span className="sp-dir-no">{s.floor === '—' ? '—' : s.floor.padStart(2, '0')}</span>
                    <span className="sp-dir-name">{nameOf(s)}</span>
                    <span className="pk-go" aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Masthead>

        {/* ══ THE RAIL ═════════════════════════════════════════════════════
            Outside every Rise: those carry a transform, and a transformed
            ancestor would trap a fixed element inside it. */}
        <nav className="sp-rail" aria-label={t('Floor navigator', 'Điều hướng tầng')}>
          {SPACES.map((s, i) => (
            <button
              key={s.id}
              className={activeIdx === i ? 'is-on' : ''}
              onClick={() => goTo(i)}
              aria-label={t(`Go to ${s.en}`, `Đến ${s.vn}`)}
              aria-current={activeIdx === i || undefined}
            >
              {s.floor}
            </button>
          ))}
        </nav>

        {/* ══ THE FLOORS ═══════════════════════════════════════════════════ */}
        {SPACES.map((s, i) => {
          const ground = groundOf(s)
          const above = i === 0 ? NIGHT : groundOf(SPACES[i - 1])
          const onSage = ground === SAGE
          const picture = s.photo || s.backdrop
          const flipped = i % 2 === 0
          return (
            <section
              key={s.id}
              id={s.id}
              ref={el => { sectionRefs.current[i] = el }}
              data-idx={i}
              className={`sp-floor${flipped ? ' is-flipped' : ''}${picture ? '' : ' is-plain'}`}
              style={{ background: ground, color: onSage ? INK : CREAM, ['--pk-ink' as string]: onSage ? INK : CREAM } as CSSProperties}
            >
              {/* The room, full-bleed, fading in from the floor above and out
                  into its own ground — the photograph is the seam. */}
              {picture && (
                <div className="sp-band">
                  <BleedImage src={picture} alt={s.photo ? nameOf(s) : ''} ground={ground} position={s.focus} />
                  <div className="sp-band-top" style={{ background: `linear-gradient(to bottom, ${above} 0%, transparent 26%)` }} />
                </div>
              )}

              <div className="pk-wrap sp-body">
                <div className="sp-words">
                  {s.mark && (
                    <Rise>
                      {/* The floor's own lion, above its name. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="sp-crest" src={s.mark} alt="" loading="lazy" />
                    </Rise>
                  )}
                  {/* No "01 · Quầy Bar Thư Viện" eyebrow over the name — the
                      owner took them off; the lion and the name carry it. */}
                  <Rise delay={.1}><h2 className="pk-h2 sp-title">{nameOf(s)}</h2></Rise>
                  <Rise delay={.16}>
                    <p className="pk-lede">{vn ? s.descVn : s.descEn}</p>
                    <p className="pk-body sp-other">{vn ? s.descEn : s.descVn}</p>
                  </Rise>

                  <Rise delay={.22}>
                    <div className="sp-ctas">
                      {/* Menu link — members only. */}
                      {internal && s.id === 'library-bar' && (
                        <Cta href="/menus/library-bar">{bare(t('Library Bar Menu →', 'Thực Đơn Quầy Bar Thư Viện →'))}</Cta>
                      )}

                      {/* Whisky shelf — members see their live stock; the public gets the
                          Atlas (the public whisky map), so the link is useful either way. */}
                      {s.id === 'rampant-room' && (
                        <Cta href={internal ? '/members/whisky' : '/atlas'}>
                          {internal ? bare(t('Current Whisky Stock →', 'Whisky Hiện Có →')) : bare(t('Explore the Atlas →', 'Khám Phá Atlas →'))}
                        </Cta>
                      )}

                      {/* Sports calendar is an events surface — members only. */}
                      {internal && s.id === 'sports' && (
                        <Cta href="/sports">{bare(t('Sports calendar →', 'Lịch Thể Thao →'))}</Cta>
                      )}
                    </div>
                  </Rise>
                </div>

                <div className={`sp-side${s.id === 'studio' || s.id === 'sports' ? ' is-top' : ''}`}>
                  {/* ── The Studio: the most recent exhibition ── */}
                  {s.id === 'studio' ? (
                    <Rise delay={.12}>
                      {/* NOT "Now Showing". The exhibition ran 6–7 February 2026 and the
                          April calendar recorded it closing; a stale "Now Showing" in
                          September reads as neglect, where naming it as the most recent
                          reads as deliberate. The same question the board's no_event had:
                          what does a room say when nothing is currently on. */}
                      <Eyebrow>{t('Most recently', 'Gần đây nhất')}</Eyebrow>
                      <h3 className="sp-h3">Terroir of Memories</h3>
                      <div className="sp-by">Quỳnh Anh Lê &times; The Octave by Duncan Taylor</div>
                      <p className="pk-body">
                        {t('A collaboration between Vietnamese contemporary artist Quỳnh Anh Lê and The Octave, exploring how place becomes character — through whisky, through paint, through the slow work of time. It was centred on 88 collaboration bottles carrying the artist’s label, alongside a single hand-painted bottle: the first of three by three Vietnamese artists, to be auctioned for charity at the series’ end. It was a multi-sensory experience, with bespoke soundscape, signature scent, and curated canapés.',
                          'Sự hợp tác giữa nghệ sĩ đương đại Việt Nam Quỳnh Anh Lê và The Octave, khám phá cách một vùng đất hun đúc nên cá tính — qua whisky, qua màu vẽ, qua sự chắt lọc chậm rãi của thời gian. Trọng tâm là 88 chai hợp tác mang nhãn của nghệ sĩ, cùng một chai duy nhất được vẽ tay: chai đầu tiên trong bộ ba của ba nghệ sĩ Việt Nam, sẽ được đấu giá gây quỹ từ thiện khi chuỗi triển lãm khép lại. Đó là một trải nghiệm đa giác quan, với âm thanh được thiết kế riêng, mùi hương đặc trưng và các món canapé tuyển chọn.')}
                      </p>
                      <p className="pk-body">
                        {t('A members-only whisky was created for the occasion — the Octave Auchentoshan 14, bottled for the exhibition.',
                          'Một loại whisky dành riêng cho hội viên đã được tạo ra cho dịp này — Octave Auchentoshan 14, đóng chai riêng cho triển lãm.')}
                      </p>
                      <Cta href="/studio" style={{ marginTop: 8 }}>{bare(t('Past exhibitions →', 'Các Triển Lãm Trước →'))}</Cta>
                    </Rise>
                  ) : s.id === 'sports' ? (
                    /* ── The Rampant Cup film ── */
                    <Rise delay={.12}>
                      {s.ink && (
                        <div className="sp-cup-ink">
                          <InkFloat name={s.ink} width="100%" rot={8} dur={7} className="sp-chalk" />
                        </div>
                      )}
                      <h3 className="sp-h3">The Rampant Cup</h3>
                      <div className="sp-by">The Bluffs, Hồ Tràm</div>
                      <div className="sp-film">
                        <iframe
                          src="https://www.youtube.com/embed/n7D-p3hGh-c"
                          title="The Rampant Cup"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </Rise>
                  ) : s.ink ? (
                    <Rise delay={.14}>
                      <div className={`sp-art${s.ink === 'glass-botanical' ? ' is-tall' : ''}`}>
                        <InkFloat name={s.ink} width="100%" rot={i % 2 ? 6 : -6} dur={7 + (i % 3)}
                                  className={onSage ? '' : 'sp-chalk'} />
                      </div>
                    </Rise>
                  ) : null}
                </div>
              </div>

              {/* The Studio's process film runs wide, under the room and its show. */}
              {s.id === 'studio' && (
                <div className="pk-wrap">
                  <Rise>
                    <div className="sp-film sp-film-wide">
                      <iframe
                        src="https://www.youtube.com/embed/DOY4fYCpQC0"
                        title={t('Terroir of Memories — Process Film', 'Terroir of Memories — Phim quá trình sáng tác')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </Rise>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </PublicPage>
  )
}
