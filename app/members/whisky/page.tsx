'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import { useForYou, ForYouEmpty, ForYouList } from '@/components/whisky/ForYouRecs'
import AlphabetShelf from '@/components/whisky/AlphabetShelf'
import WhiskyRow from '@/components/whisky/WhiskyRow'
import { WhiskyStyle, bare } from '@/components/whisky/WhiskyStyle'
import { Rise, CREAM, GOLD, MONO, SERIF } from '@/components/public/kit'
import { useLang } from '@/lib/lang'

// The Whisky Library — set to the house standard on the portal's green.
// Under the masthead: the way into the Finder set large beside a small pile of
// photographs from the club's own shelves; the member's own recommendations,
// when there are any, across the full width; then the search, set in the
// display face on a hairline, and the A–Z shelf in two rows of thirteen.
// Searching swaps the shelf for a bottle list (WhiskyRow) — names large, the
// house notes as reading text, each radar given its own column.

// The pile of photographs, as on /atlas (a different three).
const PILE: { src: string; w: string; left: string; top: string; rot: number; z: number }[] = [
  { src: 'whisky-lounge',     w: '46%', left: '28%', top: '0%',  rot: 2,  z: 1 },
  { src: 'bottle-collection', w: '40%', left: '0%',  top: '19%', rot: -6, z: 2 },
  { src: 'trc/octave-glencairn', w: '38%', left: '62%', top: '26%', rot: 7,  z: 2 },
]

export default function WhiskyPage() {
  const { t } = useLang()
  const [whiskies, setWhiskies] = useState<Whisky[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const forYou = useForYou()

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies').select('*').order('committees_pick', { ascending: false }).order('name')
      .then(({ data }) => {
        if (data) {
          setWhiskies(data)
          // Deep-link from the Finder / For-You (?focus=<id>): seed the search
          // with that bottle's name so it lands showing the whisky directly.
          const focus = new URLSearchParams(window.location.search).get('focus')
          if (focus) { const w = data.find(x => x.id === focus); if (w) setSearch(w.name) }
        }
        setLoading(false)
      })
  }, [])

  const results = useMemo(() => {
    const toks = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (toks.length === 0) return null
    return whiskies.filter(w => {
      const hay = `${w.name} ${w.distillery || ''} ${w.region || ''}`.toLowerCase()
      return toks.every(tok => hay.includes(tok))
    })
  }, [search, whiskies])

  return (
    <>
      <MemberPage
        title="The Whisky Library"
        subtitle="Thư Viện Whisky"
        icon="/images/whisky-glass-icon-opt.png"
        description={t(`${whiskies.length} bottle${whiskies.length === 1 ? '' : 's'} and counting`, `${whiskies.length} chai, và con số vẫn đang tăng`)}
      >
        <WhiskyStyle />
        <style dangerouslySetInnerHTML={{ __html: `
          .wlib-band { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .82fr); gap: 56px; align-items: center; }
          .wlib-finder { display: inline-block; color: ${CREAM}; text-decoration: none;
                         font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 3.7vw, 52px); line-height: 1.02;
                         border-bottom: 1px solid rgba(212,184,90,.55); padding-bottom: 12px; transition: border-color .3s ease; }
          .wlib-finder .pk-go { font-family: ${MONO}; font-size: 20px; color: ${GOLD}; margin-left: 14px; vertical-align: .18em; }
          .wlib-finder:hover { border-bottom-color: ${GOLD}; }
          .wlib-finder:hover .pk-go { transform: translateX(9px); }
          .wlib-fy { margin-top: 28px; }

          .wlib-pile { position: relative; width: 100%; max-width: 520px; aspect-ratio: 1 / .8; justify-self: end; }
          .wlib-shot { position: absolute; }
          .wlib-shot .pk-thumb { aspect-ratio: 4 / 5; box-shadow: 0 18px 40px rgba(0,0,0,.42); }

          .wlib-foryou { margin-top: 110px; }
          .wlib-search { margin-top: 84px; }
          .wlib-input { display: block; width: 100%; box-sizing: border-box; outline: none;
                        background: transparent; color: ${CREAM}; border: none; border-bottom: 1px solid rgba(229,212,194,.34); border-radius: 0;
                        font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 3.3vw, 46px); line-height: 1.15; padding: 6px 0 14px;
                        transition: border-color .25s ease; }
          .wlib-input::placeholder { color: rgba(229,212,194,.44); }
          .wlib-input:focus { border-bottom-color: ${GOLD}; }
          .wlib-input::-webkit-search-cancel-button { filter: invert(1); opacity: .5; }
          .wlib-shelf { margin-top: 64px; }
          .wlib-count { margin: 44px 0 4px; }
          .wlib-none { margin-top: 40px; }

          @media (max-width: 860px) {
            .wlib-band { grid-template-columns: minmax(0, 1fr); gap: 36px; }
            .wlib-pile { justify-self: start; max-width: 420px; }
            .wlib-foryou { margin-top: 80px; }
            .wlib-search { margin-top: 64px; }
          }
          @media (max-width: 640px) {
            .wlib-pile { display: none; }
            .wlib-finder { font-size: clamp(26px, 7.6vw, 34px); }
            .wlib-finder .pk-go { font-size: 16px; margin-left: 10px; }
            .wlib-search { margin-top: 56px; }
            .wlib-input { font-size: 24px; }
            .wlib-shelf { margin-top: 44px; }
          }
        ` }} />

        <section className="wlib-band">
          <div>
            <Rise>
              <Link href="/members/whisky/finder" className="wlib-finder">
                {bare(t('◆ Find your dram — match by flavour →', '◆ Tìm ly của bạn — theo hương vị →'))}<span className="pk-go" aria-hidden="true">→</span>
              </Link>
            </Rise>
            {forYou.empty && <Rise delay={.08} className="wlib-fy"><ForYouEmpty /></Rise>}
          </div>
          <Rise delay={.12} className="wlib-pile">
            {PILE.map(s => (
              <div key={s.src} className="wlib-shot pk-hover"
                   style={{ width: s.w, left: s.left, top: s.top, zIndex: s.z, transform: `rotate(${s.rot}deg)` }}>
                <div className="pk-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.src.startsWith('trc/') ? `/images/${s.src}-800.webp` : `/images/social/${s.src}.webp`} alt="" loading="lazy" />
                </div>
              </div>
            ))}
          </Rise>
        </section>

        {!forYou.loading && !forYou.empty && forYou.data && (
          <div className="wlib-foryou"><ForYouList data={forYou.data} /></div>
        )}

        {/* Search — the fast path: type a name/distillery, skip the alphabet. */}
        <div className="wlib-search">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search by name or distillery…', 'Tìm theo tên hoặc nhà chưng cất…')}
            aria-label={t('Search by name or distillery…', 'Tìm theo tên hoặc nhà chưng cất…')}
            className="wlib-input"
          />
        </div>

        {loading ? (
          <p className="wl-text wlib-none">{t('Loading…', 'Đang tải…')}</p>
        ) : results !== null ? (
          // Search active → matching whiskies (alphabet bypassed)
          results.length === 0 ? (
            <p className="wl-text wlib-none">
              {t(`No whiskies match “${search}”.`, `Không có whisky nào khớp “${search}”.`)}
            </p>
          ) : (
            <div>
              <div className="wl-meta wlib-count">
                {t(`${results.length} match${results.length === 1 ? '' : 'es'}`, `${results.length} kết quả`)}
              </div>
              <div className="wl-list">
                {results.map(w => <WhiskyRow key={w.id} w={w} />)}
              </div>
            </div>
          )
        ) : (
          // The shelf — browse by letter
          <div className="wlib-shelf"><AlphabetShelf whiskies={whiskies} /></div>
        )}
      </MemberPage>
    </>
  )
}
