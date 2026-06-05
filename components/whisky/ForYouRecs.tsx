'use client'

import { useEffect, useState } from 'react'
import RecResults, { type RecItem } from './RecResults'

// Member-facing "For You" — reads the logged-in member's OWN taste profile
// (server-resolved) → recs. Honest empty-state when there's no profile (no
// linked member yet, or no mapped loves) → points to the Flavour Finder rather
// than inventing a taste. Dormant until profiles link to members.

const FAMILY = "'Google Sans Code', 'DM Mono', monospace"
interface RecResp { recs: RecItem[]; target: Record<string, number>; bestIsClose: boolean; profileEmpty: boolean }

export default function ForYouRecs() {
  const [data, setData] = useState<RecResp | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/whisky/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!data || data.profileEmpty || !data.recs?.length) {
    return (
      <div style={empty}>
        Tell us what you love — try the <a href="/members/whisky/finder" style={{ color: '#D4B85A', textDecoration: 'none' }}>Flavour Finder</a>{' '}and we&apos;ll match you a dram.
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={heading}>Recommended for you</div>
      <RecResults recs={data.recs} target={data.target} bestIsClose={data.bestIsClose} theme="member" />
    </div>
  )
}

const heading: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', textAlign: 'center', marginBottom: 16 }
const empty: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.8, textAlign: 'center', marginBottom: 28, lineHeight: 1.7 }
