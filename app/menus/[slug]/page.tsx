'use client'

import { use } from 'react'
import Link from 'next/link'
import NavOverlay from '@/components/NavOverlay'
import { notFound } from 'next/navigation'
import { PublicPage, Rise, BleedImage, InkFloat, MONO, SERIF } from '@/components/public/kit'
import InkStill from '@/components/public/menus/InkStill'
import { FLOOR_MARK, ROOM_PHOTO } from '@/components/public/menus/rooms'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// ═══════════════════════════════════════════════════════════════════════════
// ONE FLOOR'S MENU — the cover of it, and the way in.
// ───────────────────────────────────────────────────────────────────────────
// The menu itself is a PDF (public/documents/menus/<slug>.pdf), so this page is
// its cover: the room's name set large with the floor's lion drifting beside
// it, the room itself bleeding into the ground as on /studio, then one big
// invitation to open it. The two quiet links in the masthead stay for those who
// want it in a tab or on their phone.

interface FloorMenu {
  slug: string
  floor: number
  name: string
  vn: string
  kind: string
  vnKind: string
  pdf: string
}

const MENUS: Record<string, FloorMenu> = {
  'library-bar': {
    slug: 'library-bar',
    floor: 1,
    name: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    kind: 'Cocktails & Spirits',
    vnKind: 'Cocktail & Rượu Mạnh',
    pdf: '/documents/menus/library-bar.pdf',
  },
  // Others to come — drop a PDF in /public/documents/menus/<slug>.pdf and add the entry here.
}

const CSS = `
  /* The EN/VN switch (2026-09-15) — same spot as /menus and the member portal,
     and visible on phones too: the public phone menu has no switch of its own. */
  .mp-lang { position: absolute; z-index: 60; top: calc(56px + env(safe-area-inset-top, 0px)); right: 40px; }
  @media (max-width: 768px) { .mp-lang { top: calc(70px + env(safe-area-inset-top, 0px)); right: 20px; } }
  .mp-en-only { font-family: ${MONO}; font-size: 12px; line-height: 1.8; opacity: .7; margin: 14px 0 0; }

  .mp-mast { padding-bottom: 72px; }
  .mp-back { display: inline-block; margin-bottom: 34px; color: inherit; text-decoration: none;
             font-family: ${MONO}; font-size: 12px; letter-spacing: .08em; }
  .mp-back .pk-go { margin-right: 6px; }
  .mp-back:hover .pk-go { transform: translateX(-6px); }
  .mp-kind { font-family: ${MONO}; font-size: 13px; letter-spacing: .04em; line-height: 2; margin-top: 18px; }
  .mp-actions { display: flex; flex-wrap: wrap; gap: 8px 34px; }
  .mp-art { position: relative; width: 88%; max-width: 480px; margin-left: auto; }

  .mp-view { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 320px); gap: 56px;
             align-items: center; padding-top: 40px; padding-bottom: 150px; }
  .mp-note { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 0; }
  .mp-phone { display: none; }
  .mp-big { display: inline-block; margin-top: 22px; color: inherit; text-decoration: none;
            font-family: ${SERIF}; font-weight: 400; font-size: clamp(44px, 6.4vw, 92px); line-height: .95;
            border-bottom: 2px solid currentColor; padding-bottom: 10px; }
  .mp-big .pk-go { font-family: ${MONO}; font-size: .62em; vertical-align: .08em; }
  .mp-big:hover .pk-go { transform: translateX(14px); }

  @media (max-width: 860px) {
    .mp-mast { padding-bottom: 44px; }
    .mp-back { margin-bottom: 26px; }
    .mp-art { width: 46%; max-width: 210px; margin: 0 0 0 auto; }
    .mp-view { grid-template-columns: 1fr; gap: 18px; padding-bottom: 110px; }
    .mp-tray { width: 52%; max-width: 220px; margin-left: auto; }
  }
  /* Phones get the words they got before — a PDF opens in its own viewer
     there, so it is a tap, not a viewer. */
  @media (max-width: 768px) {
    .mp-desk { display: none; }
    .mp-phone { display: block; }
  }
`

export default function FloorMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  // Before the not-found exit, so the hook order never depends on the slug.
  const { lang, t } = useLang()
  const vn = lang === 'vn'
  const menu = MENUS[slug]
  if (!menu) notFound()

  const photo = ROOM_PHOTO[menu.slug]
  const mark = FLOOR_MARK[menu.floor]

  return (
    <>
      <NavOverlay variant="public" />
      <PublicPage>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="mp-lang"><LangToggle tone="light" /></div>

        <header className="pk-wrap pk-mast mp-mast">
          <div>
            <Rise>
              <Link href="/menus" className="mp-back"><span className="pk-go">←</span>{t('All menus', 'Tất cả thực đơn')}</Link>
            </Rise>
            <Rise delay={.08}><h1 className="pk-h1">{vn ? menu.vn : menu.name}</h1></Rise>
            <Rise delay={.14}><div className="pk-sub">{vn ? menu.name : menu.vn}</div></Rise>
            <Rise delay={.2}><div className="mp-kind">{vn ? menu.vnKind : menu.kind}</div></Rise>
            {/* Said plainly, so the switch does not promise a Vietnamese menu that
                does not exist yet — the PDF is English only (2026-09-15). */}
            {vn && <Rise delay={.22}><p className="mp-en-only">Thực đơn hiện chỉ có bằng tiếng Anh.</p></Rise>}
            <Rise delay={.26}>
              <div className="mp-actions">
                <a href={menu.pdf} target="_blank" rel="noopener noreferrer" className="pk-cta">
                  {t('Open in new tab', 'Mở trong tab mới')} <span className="pk-go">↗</span>
                </a>
                <a href={menu.pdf} download className="pk-cta">
                  {t('Download PDF', 'Tải PDF')} <span className="pk-go">↓</span>
                </a>
              </div>
            </Rise>
          </div>
          {mark && (
            <Rise delay={.15}>
              <div className="mp-art">
                <InkFloat name={mark} width="100%" rot={-5} dur={8} />
              </div>
            </Rise>
          )}
        </header>

        {photo && <BleedImage src={photo.src} position={photo.position} />}

        {/* A LINK — not an embed with a fallback.
            The CSP sets object-src 'none', so <object> never rendered a PDF here
            either: 93e035a swapped a broken <iframe> for a broken <object>, and
            what actually shipped both times was a card like this one. It is the
            right surface — it just was not what the code claimed to be. */}
        <section className="pk-wrap mp-view">
          <Rise>
            <p className="mp-note mp-desk">{t('The menu opens in your PDF viewer.', 'Thực đơn sẽ mở trong trình xem PDF của bạn.')}</p>
            <p className="mp-note mp-phone">{t('Tap to view the full menu.', 'Chạm để xem toàn bộ thực đơn.')}</p>
            <a href={menu.pdf} target="_blank" rel="noopener noreferrer" className="mp-big">
              {t('View the menu', 'Xem thực đơn')}&nbsp;<span className="pk-go">→</span>
            </a>
          </Rise>
          <Rise delay={.12}>
            <InkStill className="mp-tray" aspect="1 / 0.9" objects={[
              { name: 'butler-tray', w: '78%', top: '0%',  left: '14%', rot: 6,   dur: 8, z: 2 },
              { name: 'cigar',       w: '42%', top: '62%', left: '0%',  rot: -14, dur: 7 },
            ]} />
          </Rise>
        </section>
      </PublicPage>
    </>
  )
}
