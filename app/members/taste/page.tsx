'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import RadarChart from '@/components/whisky/RadarChart'
import { fetchCategories, RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { buildTasteNarrative, vectorToShape, type TasteVector, type TasteSources } from '@/lib/whisky/taste-narrative'

// A linked member's OWN palate, in TRC voice — narrative + radar + the bottles
// that shape it. NO raw scores/parameters. member_taste_profiles is read via the
// member-own RLS (proven 0a), so the query returns only their row.

const FAMILY = "'Google Sans Code', 'DM Mono', monospace"

export default function MyTastePage() {
  const [loading, setLoading] = useState(true)
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [shape, setShape] = useState<ShapeValues | null>(null)
  const [narrative, setNarrative] = useState('')
  const [lovedBottles, setLovedBottles] = useState<string[]>([])
  // Responsive radar: MemberPage gives ~280px of content width at 360px, so a
  // fixed 300 would overflow. Cap to the viewport (clamped 240–300).
  const [radarSize, setRadarSize] = useState(300)

  useEffect(() => {
    const fit = () => setRadarSize(Math.max(240, Math.min(300, window.innerWidth - 96)))
    fit(); window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    Promise.all([
      fetchCategories(supabase),
      supabase.from('member_taste_profiles').select('vector, sources').maybeSingle(),
    ]).then(([c, { data }]) => {
      setCats(c)
      if (data) {
        const vector = (data.vector || {}) as TasteVector
        const sources = (data.sources || {}) as TasteSources
        setNarrative(buildTasteNarrative(vector, sources))
        setShape(vectorToShape(vector))
        setLovedBottles(sources.loved_bottles || [])
      }
      setLoading(false)
    })
  }, [])

  const hasProfile = !!narrative || lovedBottles.length > 0 || (shape && Object.keys(shape).length > 0)

  return (
    <MemberPage title="Your Palate" subtitle="Khẩu Vị Của Bạn">
      {loading ? (
        <p style={muted}>Reading your palate…</p>
      ) : !hasProfile ? (
        <div style={emptyWrap}>
          <p style={muted}>We&apos;re still learning your palate. Tell us the drams you love — explore the <Link href="/members/whisky" style={link}>Whisky Library</Link> or try the <Link href="/members/whisky/finder" style={link}>Flavour Finder</Link>, and your profile will take shape.</p>
        </div>
      ) : (
        <>
          {narrative && <p style={narrativeText}>{narrative}</p>}

          {cats && shape && Object.keys(shape).length > 0 && (
            <div style={radarWrap}>
              <RadarChart cats={cats} shapes={[{ values: shape, color: RADAR_GOLD, label: '' }]} size={radarSize} />
            </div>
          )}

          {lovedBottles.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={sectionLabel}>The drams that shape your profile</div>
              <ul style={bottleList}>
                {lovedBottles.map((b, i) => <li key={i} style={bottleItem}>{b}</li>)}
              </ul>
              <Link href="/members/whisky" style={{ ...link, fontSize: 11 }}>Explore the library →</Link>
            </div>
          )}
        </>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#B2AA98', lineHeight: 1.7, textAlign: 'center' }
const emptyWrap: React.CSSProperties = { maxWidth: 460, margin: '24px auto', textAlign: 'center' }
const narrativeText: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 21, lineHeight: 1.55, color: '#E5D4C2', textAlign: 'center', maxWidth: 520, margin: '4px auto 8px' }
const radarWrap: React.CSSProperties = { display: 'flex', justifyContent: 'center', margin: '12px 0 24px' }
const sectionLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }
const bottleList: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '0 auto 14px', maxWidth: 460 }
const bottleItem: React.CSSProperties = { fontFamily: FAMILY, fontSize: 13, color: '#E5D4C2', padding: '9px 0', borderBottom: '1px solid rgba(229,212,194,0.08)', textAlign: 'center' }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
