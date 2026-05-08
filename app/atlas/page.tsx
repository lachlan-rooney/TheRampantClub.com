'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import NavOverlay from '@/components/NavOverlay'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ATLAS_REGIONS } from '@/lib/whisky-atlas-data'

const AtlasGlobe = dynamic(() => import('./AtlasGlobe'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Google Sans Code', monospace", fontSize: 11,
      color: 'rgba(5,46,32,0.4)', letterSpacing: '0.06em',
    }}>
      Loading the globe…
    </div>
  ),
})

export default function AtlasPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies')
      .select('region, in_stock')
      .then(({ data }) => {
        if (!data) return
        const c: Record<string, number> = {}
        for (const w of data as { region: string | null; in_stock: boolean }[]) {
          if (!w.in_stock || !w.region) continue
          c[w.region] = (c[w.region] || 0) + 1
        }
        setCounts(c)
      })
  }, [])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        :root {
          --atl-cream: #E5D4C2;
          --atl-cream-dim: #B2AA98;
          --atl-green-deep: #052E20;
          --atl-green-mid: #28483C;
          --atl-green-accent: #5E6650;
          --atl-gold: #D4B85A;
        }
        body { background: var(--atl-cream); }

        .atl-hero {
          padding: 140px 24px 60px;
          text-align: center;
          background: linear-gradient(180deg, #F2E5D2 0%, var(--atl-cream) 100%);
        }
        .atl-eyebrow {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          color: var(--atl-cream-dim);
          letter-spacing: 0.06em;
          margin-bottom: 16px;
        }
        .atl-title {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 500;
          color: var(--atl-green-deep);
          letter-spacing: 0.02em;
          margin: 0 0 24px;
        }
        .atl-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; line-height: 1.8;
          color: var(--atl-cream-dim);
          letter-spacing: 0.04em;
          max-width: 540px; margin: 0 auto;
        }

        .atl-globe-wrap {
          position: relative;
          background: radial-gradient(ellipse at center, #F2E5D2 0%, var(--atl-cream) 70%, #DBC9B4 100%);
          padding: 12px 0 20px;
          margin-top: 16px;
        }
        .atl-globe-hint {
          text-align: center;
          font-family: 'Google Sans Code', monospace;
          font-size: 10px;
          color: rgba(5,46,32,0.5);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-top: 12px;
        }

        .atl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          padding: 40px 24px 80px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .atl-card {
          background: rgba(5, 46, 32, 0.04);
          border: 1px solid rgba(5, 46, 32, 0.08);
          border-radius: 10px;
          padding: 14px 16px;
          cursor: pointer;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      background 0.35s ease,
                      border-color 0.35s ease,
                      box-shadow 0.35s ease;
        }
        .atl-card:hover {
          transform: translateY(-3px);
          background: rgba(5, 46, 32, 0.07);
          border-color: rgba(212, 184, 90, 0.4);
          box-shadow: 0 12px 24px rgba(5, 46, 32, 0.1);
        }
        .atl-card-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 8px;
        }
        .atl-flag { font-size: 20px; line-height: 1; }
        .atl-card-name {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 500;
          color: var(--atl-green-deep);
          letter-spacing: 0.02em;
        }
        .atl-card-native {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          color: var(--atl-cream-dim);
          letter-spacing: 0.06em;
          margin-top: 1px;
        }
        .atl-card-blurb {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px;
          line-height: 1.55;
          color: var(--atl-green-accent);
          opacity: 0.85;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .atl-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .atl-chip {
          font-family: 'Google Sans Code', monospace;
          font-size: 8px;
          letter-spacing: 0.05em;
          padding: 3px 7px;
          border-radius: 10px;
          background: rgba(212, 184, 90, 0.12);
          color: var(--atl-green-mid);
        }
        .atl-card-footer {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px;
          color: var(--atl-green-accent);
          opacity: 0.7;
          padding-top: 8px;
          border-top: 1px solid rgba(5, 46, 32, 0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .atl-card-count {
          color: var(--atl-gold);
          font-weight: 600;
          font-size: 10px;
          letter-spacing: 0.04em;
        }

        .atl-card { cursor: default; }

        /* Strip the default dark frame react-globe.gl wraps tooltips in */
        .float-tooltip-kap {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          color: inherit !important;
        }

        @media (max-width: 720px) {
          .atl-hero { padding: 100px 20px 40px; }
          .atl-grid { padding: 40px 20px 80px; gap: 12px; }
        }
      `}} />

      <NavOverlay variant="public" />

      <main>
        <section className="atl-hero">
          <div className="atl-eyebrow">Bản Đồ Whisky · The Atlas</div>
          <h1 className="atl-title">What&rsquo;s currently stocked in the club?</h1>
          <p className="atl-sub">
            Members constantly bring new whiskies into the club. Tap a region to see its character,
            signature distilleries, and how many bottles are on the shelf right now.
          </p>
        </section>

        <section className="atl-globe-wrap">
          <AtlasGlobe counts={counts} height={420} />
          <div className="atl-globe-hint">
            Drag to spin · scroll to zoom · tap a marker
          </div>
        </section>

        <section className="atl-grid">
          {ATLAS_REGIONS.map(r => (
            <div key={r.key} className="atl-card">
              <div className="atl-card-header">
                <span className="atl-flag" aria-hidden>{r.flag}</span>
                <div>
                  <div className="atl-card-name">{r.name}</div>
                  {r.native && r.native !== r.name && (
                    <div className="atl-card-native">{r.native}</div>
                  )}
                </div>
              </div>
              <div className="atl-card-blurb">{r.blurb}</div>
              <div className="atl-chips">
                {r.character.slice(0, 3).map(c => (
                  <span key={c} className="atl-chip">{c}</span>
                ))}
              </div>
              <div className="atl-card-footer">
                <span>{r.country}</span>
                {counts[r.key] > 0 && (
                  <span className="atl-card-count">
                    {counts[r.key]} {counts[r.key] === 1 ? 'bottle' : 'bottles'} in the Rampant Room
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>

    </>
  )
}

