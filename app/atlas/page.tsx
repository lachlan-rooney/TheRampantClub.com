'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import NavOverlay from '@/components/NavOverlay'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ATLAS_REGIONS } from '@/lib/whisky-atlas-data'
import { PublicPage, Masthead, SectionHead, Rise, InkFloat, MONO } from '@/components/public/kit'

// /atlas — what is on the shelf, and where it came from.
//
// Set to the /studio benchmark: words left and large; the club's own shelves
// as a small pile of photographs in the masthead's empty half; the globe given
// room, with the shelf's totals set large beside it; and the regions as an
// editorial index — the name large, the character in ink — rather than a grid
// of boxed cards.

const AtlasGlobe = dynamic(() => import('./AtlasGlobe'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .62,
    }}>
      Loading the globe…
    </div>
  ),
})

// The masthead's pile of photographs from the shelves, with the lion and his
// bottle in front of them.
const SHELF: { src: string; w: string; left: string; top: string; rot: number; z: number }[] = [
  { src: 'whisky-library',    w: '46%', left: '27%', top: '0%',  rot: 2,  z: 1 },
  { src: 'bottle-collection', w: '40%', left: '0%',  top: '20%', rot: -7, z: 2 },
  { src: 'springbank',        w: '38%', left: '61%', top: '27%', rot: 7,  z: 2 },
]

export default function AtlasPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<{ singleMalt: number; bourbon: number; blended: number }>({ singleMalt: 0, bourbon: 0, blended: 0 })
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  // The globe gets more room on a desk; a phone keeps it short enough to
  // scroll past, since a drag on the globe spins it rather than the page.
  const [globeHeight, setGlobeHeight] = useState(420)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)')
    const set = () => setGlobeHeight(mq.matches ? 600 : 420)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies')
      .select('region, in_stock, name, added_at')
      .then(({ data, error }) => {
        if (error) console.warn('[atlas] whiskies fetch error:', error)
        if (!data) return
        const c: Record<string, number> = {}
        const cats = { singleMalt: 0, bourbon: 0, blended: 0 }
        let maxAdded: string | null = null
        for (const w of data as { region: string | null; in_stock: boolean; name: string | null; added_at: string | null }[]) {
          if (!w.in_stock) continue
          if (w.region) c[w.region] = (c[w.region] || 0) + 1
          // Categorise: bourbon (USA region or "bourbon" in name) → blend → else single malt
          const n = (w.name || '').toLowerCase()
          if (n.includes('bourbon') || w.region === 'USA') cats.bourbon++
          else if (n.includes('blend')) cats.blended++
          else cats.singleMalt++
          if (w.added_at && (!maxAdded || w.added_at > maxAdded)) maxAdded = w.added_at
        }
        setCounts(c)
        setCategories(cats)
        setLastUpdated(maxAdded)
      })
  }, [])

  const fmtRelative = (iso: string | null) => {
    if (!iso) return null
    const ms = Date.now() - new Date(iso).getTime()
    const days = Math.round(ms / 86400000)
    if (days < 1) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30) return `${days} days ago`
    const months = Math.round(days / 30)
    if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`
    return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }

  const hasStats = (categories.singleMalt + categories.bourbon + categories.blended) > 0

  return (
    <PublicPage>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        /* the pile of photographs */
        .atl-shelf { position: relative; width: calc(100% + 56px); max-width: 600px; aspect-ratio: 1 / .92; margin-left: -56px; }
        .atl-shot { position: absolute; }
        .atl-shot .pk-thumb { aspect-ratio: 4 / 5; }
        .atl-shelf-ink { position: absolute; z-index: 3; left: 34%; top: 55%; }

        /* the globe, and the shelf's totals beside it */
        .atl-globe { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, .75fr); gap: 40px; align-items: center; }
        .atl-globe-stage { position: relative; min-width: 0; }
        .atl-hint { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; opacity: .62;
                    margin-top: 10px; text-align: center; }
        .atl-stats { display: grid; gap: 26px; }
        .atl-stat-num { font-family: 'Rampant Sans', serif; font-size: clamp(64px, 7.2vw, 108px); line-height: .86; }
        .atl-stat-label { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; margin-top: 10px; opacity: .75; }
        .atl-updated { font-family: ${MONO}; font-size: 12.5px; line-height: 2; margin-top: 4px; }
        .atl-stats-ink { margin-top: 10px; }

        /* the regions, as an index */
        .atl-regions { padding-bottom: 140px; }
        .atl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 64px 48px; margin-top: 64px; }
        .atl-card-header { display: flex; align-items: baseline; gap: 12px; }
        .atl-flag { font-size: 22px; line-height: 1; transform: translateY(-2px); }
        .atl-card-name { font-family: 'Rampant Sans', serif; font-size: clamp(26px, 2.6vw, 34px); line-height: 1; }
        .atl-card-native { font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; opacity: .7; margin-top: 8px; }
        .atl-card-blurb { font-family: ${MONO}; font-size: 12.5px; line-height: 1.95; margin: 16px 0 0; }
        .atl-chips { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase;
                     margin-top: 14px; opacity: .75; line-height: 1.9; }
        .atl-card-footer { font-family: ${MONO}; font-size: 12px; margin-top: 14px; display: flex; align-items: center; gap: 10px; }
        .atl-card-footer.is-empty { opacity: .62; }
        .atl-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF7A1F; flex-shrink: 0;
                   box-shadow: 0 0 0 4px rgba(255,122,31,.16); }

        /* Strip the default dark frame react-globe.gl wraps tooltips in */
        .float-tooltip-kap {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          color: inherit !important;
        }

        @media (max-width: 1000px) { .atl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 860px) {
          .atl-shelf { width: 100%; max-width: 400px; margin: 0 auto; aspect-ratio: 1 / .86; }
          .atl-hint { font-size: 9.5px; letter-spacing: .12em; }
          .atl-globe { grid-template-columns: 1fr; gap: 20px; }
          .atl-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .atl-stat-num { font-size: clamp(44px, 13vw, 64px); }
          .atl-stat-label { font-size: 9.5px; letter-spacing: .16em; }
          .atl-updated, .atl-stats-ink { grid-column: 1 / -1; }
          .atl-stats-ink { display: none; }
          .atl-regions { padding-bottom: 100px; }
        }
        @media (max-width: 600px) {
          .atl-grid { grid-template-columns: 1fr; gap: 44px; margin-top: 44px; }
        }
      `}} />

      <NavOverlay variant="public" />

      <Masthead
        title={<>What&rsquo;s currently stocked in the club?</>}
        lede={<>Members constantly bring new whiskies into the club. Tap a region to see its character,
          signature distilleries, and how many bottles are on the shelf right now.</>}
        art={
          <div className="atl-shelf">
            {SHELF.map(s => (
              <div key={s.src} className="atl-shot pk-hover"
                   style={{ width: s.w, left: s.left, top: s.top, zIndex: s.z, transform: `rotate(${s.rot}deg)` }}>
                <div className="pk-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/social/${s.src}.webp`} alt="" />
                </div>
              </div>
            ))}
            <InkFloat name="lion-bottle" width="30%" rot={-5} dur={8} className="atl-shelf-ink" />
          </div>
        }
      />

      <section className="pk-wrap">
        <div className="atl-globe">
          <Rise className="atl-globe-stage">
            <AtlasGlobe counts={counts} height={globeHeight} />
            <div className="atl-hint">
              Drag to spin · scroll to zoom · tap a marker
            </div>
          </Rise>

          {hasStats && (
            <Rise delay={.12}>
              <div className="atl-stats">
                <div className="atl-stat">
                  <div className="atl-stat-num">{categories.singleMalt}</div>
                  <div className="atl-stat-label">Single Malts</div>
                </div>
                <div className="atl-stat">
                  <div className="atl-stat-num">{categories.bourbon}</div>
                  <div className="atl-stat-label">Bourbons</div>
                </div>
                <div className="atl-stat">
                  <div className="atl-stat-num">{categories.blended}</div>
                  <div className="atl-stat-label">Blends</div>
                </div>
                {lastUpdated && (
                  <div className="atl-updated">
                    Last bottle added {fmtRelative(lastUpdated)}
                  </div>
                )}
                <InkFloat name="glass" width={120} rot={8} dur={7} className="atl-stats-ink" />
              </div>
            </Rise>
          )}
        </div>
      </section>

      <section className="pk-wrap pk-section atl-regions">
        <SectionHead
          title="The Regions"
          art={<InkFloat name="lion-reclining" width="clamp(200px, 24vw, 300px)" rot={-3} dur={9} />}
        />

        <div className="atl-grid">
          {ATLAS_REGIONS.map((r, i) => (
            <Rise key={r.key} as="article" delay={(i % 3) * .06} className="atl-card">
              <div className="atl-card-header">
                <span className="atl-flag" aria-hidden>{r.flag}</span>
                <div className="atl-card-name">{r.name}</div>
              </div>
              {r.native && r.native !== r.name && (
                <div className="atl-card-native">{r.native}</div>
              )}
              <p className="atl-card-blurb">{r.blurb}</p>
              <div className="atl-chips">
                {r.character.slice(0, 3).join('  ·  ')}
              </div>
              {counts[r.key] > 0 ? (
                <div className="atl-card-footer">
                  <span className="atl-dot" aria-hidden />
                  <span>
                    {counts[r.key] > 99 ? '99+' : counts[r.key]} {counts[r.key] === 1 ? 'bottle' : 'bottles'} in the Rampant Room
                  </span>
                </div>
              ) : (
                <div className="atl-card-footer is-empty">{r.country}</div>
              )}
            </Rise>
          ))}
        </div>
      </section>
    </PublicPage>
  )
}
