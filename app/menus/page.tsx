'use client'

import Link from 'next/link'
import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Masthead, Rise, inkSrc, MONO } from '@/components/public/kit'
import InkStill from '@/components/public/menus/InkStill'
import { FLOOR_MARK, ROOM_PHOTO } from '@/components/public/menus/rooms'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// ═══════════════════════════════════════════════════════════════════════════
// THE MENUS — one door per floor.
// ───────────────────────────────────────────────────────────────────────────
// Set to the /studio standard: the title left and large with a still life of
// the house's ink beside it, then each floor's menu as a big editorial choice —
// the room (its photograph, or a drawing where there is none), the floor's own
// lion, the name in display type, and the way in. Rows alternate sides and are
// separated by space, never rules. A menu that is not ready keeps its place
// and says so, in ink rather than faded out.
//
// Members reach this page from their portal nav too, so it is the same page
// for both — nothing here assumes a visitor.

interface FloorMenu {
  slug: string
  floor: number | string
  name: string
  vn: string
  kind: string
  vnKind: string
  available: boolean
  href: string
}

const MENUS: FloorMenu[] = [
  {
    slug: 'library-bar',
    floor: 1,
    name: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    kind: 'Cocktails & Spirits',
    vnKind: 'Cocktail & Rượu Mạnh',
    available: true,
    href: '/menus/library-bar',
  },
  {
    slug: 'dining-room',
    floor: 3,
    name: 'The Dining Room',
    vn: 'Phòng Ăn Riêng',
    kind: 'Food & Wine',
    vnKind: 'Món Ăn & Rượu Vang',
    available: false,
    href: '/menus/dining-room',
  },
  {
    slug: 'rampant-room',
    floor: 4,
    name: 'The Rampant Room',
    vn: 'Phòng Rampant',
    kind: 'Whisky List',
    vnKind: 'Danh Sách Whisky',
    available: false,
    href: '/members/whisky',
  },
  {
    slug: 'source-origin-lab',
    floor: 5,
    name: 'Source & Origin Lab',
    vn: 'Phòng Thí Nghiệm',
    kind: 'Experimental Pours',
    vnKind: 'Thử Nghiệm',
    available: false,
    href: '/menus/source-origin-lab',
  },
]

const CSS = `
  /* The EN/VN switch (2026-09-15) — the member portal's spot: 56px down, 40px
     in. Public pages have no switch in their phone menu, so unlike the portal it
     stays visible below 768px instead of moving into the menu. */
  .mn-lang { position: absolute; z-index: 60; top: calc(56px + env(safe-area-inset-top, 0px)); right: 40px; }
  @media (max-width: 768px) { .mn-lang { top: calc(70px + env(safe-area-inset-top, 0px)); right: 20px; } }

  .mn-list { padding-top: 20px; padding-bottom: 140px; display: grid; gap: 120px; }
  .mn-link { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); gap: 72px; align-items: center;
             color: inherit; text-decoration: none; }
  .mn-row.is-flip .mn-pic { order: 2; }
  .mn-photo { aspect-ratio: 5 / 4; }
  .mn-row.is-soon .mn-photo img { filter: saturate(.55); }
  .mn-row.is-soon .mn-photo:hover img { transform: none; }
  .mn-drawn { aspect-ratio: 5 / 4; display: flex; align-items: center; }

  .mn-mark { display: flex; align-items: center; gap: 18px; }
  .mn-lion { width: 64px; height: auto; display: block; transform: rotate(-5deg);
             transition: transform .6s cubic-bezier(.16,.84,.44,1); }
  .mn-link:hover .mn-lion { transform: rotate(5deg) scale(1.08); }
  .mn-floor { font-family: ${MONO}; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; }
  .mn-name { margin-top: 22px; }
  .mn-vn { font-family: 'Rampant Sans', serif; font-size: clamp(19px, 2.4vw, 26px); opacity: .62; margin-top: 12px; }
  .mn-kind { font-family: ${MONO}; font-size: 13px; line-height: 2; margin-top: 18px; }
  .mn-soon { display: inline-block; margin-top: 26px; font-family: ${MONO}; font-size: 12px; letter-spacing: .12em;
             text-transform: uppercase; color: #8A6A1F; }

  @media (max-width: 860px) {
    .mn-list { gap: 76px; padding-bottom: 100px; }
    .mn-link { grid-template-columns: 1fr; gap: 26px; }
    .mn-row.is-flip .mn-pic { order: 0; }
    .mn-photo, .mn-drawn { aspect-ratio: 4 / 3; }
    .mn-lion { width: 52px; }
    .mn-name { margin-top: 16px; }
    .mn-still { max-width: 330px; margin-left: auto; }
  }
  @media (prefers-reduced-motion: reduce) { .mn-lion { transition: none; } }
`

export default function MenusIndex() {
  // Vietnamese labels here are a first draft (2026-09-15) — Miss Châu to review.
  // Room names stay recognisable in both: the chosen language leads, the other
  // sits underneath, because a member looking for a room needs the word on the door.
  const { lang, t } = useLang()
  const vn = lang === 'vn'
  return (
    <>
      <NavOverlay variant="public" />
      <PublicPage>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="mn-lang"><LangToggle tone="light" /></div>

        <Masthead
          title={t('The Menus', 'Thực Đơn')}
          lede={t(
            'Each floor has its own offering. Cocktails by the Library Bar, bottle-share in the Rampant Room, private dining on the third, experimental work in the Source & Origin Lab.',
            'Mỗi tầng có thực đơn riêng. Cocktail tại Library Bar, chia sẻ chai tại Rampant Room, bữa tối riêng tư ở tầng ba, và những thử nghiệm tại Source & Origin Lab.',
          )}
          art={
            <InkStill className="mn-still" objects={[
              { name: 'glass',       w: '46%', top: '24%', left: '30%', rot: -5,  dur: 9,   z: 2 },
              { name: 'butler-tray', w: '34%', top: '0%',  left: '62%', rot: 8,   dur: 7.5 },
              { name: 'cigar',       w: '30%', top: '4%',  left: '4%',  rot: -16, dur: 8 },
              { name: 'gent-toast',  w: '30%', top: '62%', left: '2%',  rot: 6,   dur: 6.5 },
              { name: 'key',         w: '14%', top: '72%', left: '80%', rot: -22, dur: 7 },
            ]} />
          }
        />

        <section className="pk-wrap mn-list" aria-label={t('The menus', 'Thực đơn')}>
          {MENUS.map((m, i) => {
            const Tag = (m.available ? Link : 'div') as React.ElementType
            const photo = ROOM_PHOTO[m.slug]
            const mark = FLOOR_MARK[Number(m.floor)]
            return (
              <Rise as="article" key={m.slug} className={`mn-row ${i % 2 ? 'is-flip' : ''} ${m.available ? '' : 'is-soon'}`}>
                <Tag {...(m.available ? { href: m.href } : {})} className={`mn-link ${m.available ? 'pk-hover' : ''}`}>
                  <div className="mn-pic">
                    {photo ? (
                      <div className="pk-thumb mn-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.src} alt="" loading="lazy" style={{ objectPosition: photo.position }} />
                      </div>
                    ) : (
                      <div className="mn-drawn">
                        <InkStill aspect="5 / 4" objects={[
                          { name: 'lion-bottle',     w: '44%', top: '4%',  left: '12%', rot: -6, dur: 8.5, z: 2 },
                          { name: 'glass-botanical', w: '34%', top: '22%', left: '58%', rot: 7,  dur: 7 },
                        ]} />
                      </div>
                    )}
                  </div>

                  <div className="mn-text">
                    <div className="mn-mark">
                      {mark && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={inkSrc(mark)} alt="" aria-hidden="true" className="mn-lion" />
                      )}
                      <span className="mn-floor">{t(`FLOOR ${m.floor}`, `TẦNG ${m.floor}`)}</span>
                    </div>
                    <h2 className="pk-h2 mn-name">{vn ? m.vn : m.name}</h2>
                    <div className="mn-vn">{vn ? m.name : m.vn}</div>
                    <div className="mn-kind">{vn ? m.vnKind : m.kind}</div>
                    {m.available
                      ? <span className="pk-cta">{t('View menu', 'Xem thực đơn')} <span className="pk-go">→</span></span>
                      : <span className="mn-soon">{t('Coming soon', 'Sắp ra mắt')}</span>}
                  </div>
                </Tag>
              </Rise>
            )
          })}
        </section>
      </PublicPage>
    </>
  )
}
