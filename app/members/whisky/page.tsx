'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

export default function WhiskyPage() {
  const [whiskies, setWhiskies] = useState<Whisky[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies').select('*').order('committees_pick', { ascending: false }).order('name')
      .then(({ data }) => { if (data) setWhiskies(data); setLoading(false) })
  }, [])

  const inStock = whiskies.filter(w => w.in_stock)
  const pastWhiskies = whiskies.filter(w => !w.in_stock)

  // Build dynamic regions from actual data
  const regionSet = new Set(inStock.map(w => w.region).filter((r): r is string => Boolean(r)))
  const regions = ['All', ...Array.from(regionSet).sort(), ...(pastWhiskies.length > 0 ? ['Past Drams'] : [])]

  const filtered = filter === 'Past Drams' ? pastWhiskies : filter === 'All' ? inStock : inStock.filter(w => w.region === filter)

  return (
    <>
      <NavOverlay variant="members" dark />
      <MemberPage
        title="The Whisky Library"
        subtitle="Thư Viện Whisky"
        icon="/images/Whisky Glass.svg"
        description={`${whiskies.length} bottle${whiskies.length === 1 ? '' : 's'} and counting`}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32, justifyContent: 'center' }}>
          {regions.map(r => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                borderRadius: 20, padding: '6px 16px', cursor: 'pointer',
                border: filter === r ? 'none' : '1px solid rgba(229,212,194,0.2)',
                background: filter === r ? 'rgba(229,212,194,0.12)' : 'transparent',
                color: filter === r ? '#E5D4C2' : '#B2AA98',
                transition: 'all 0.2s',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center', fontStyle: 'italic' }}>No whiskies in this region</p>
        ) : (
          filtered.map(w => (
            <div key={w.id} style={{ padding: '24px 0', borderBottom: '1px solid rgba(229,212,194,0.1)', opacity: w.in_stock ? 1 : 0.4 }}>
              <div style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 600,
                color: '#E5D4C2', marginBottom: 4,
              }}>
                {w.committees_pick && <span style={{ color: '#B2AA98', marginRight: 6 }}>◆</span>}
                {w.name}
              </div>
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 8 }}>
                {[w.distillery, w.region].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: 'rgba(178,170,152,0.5)', marginBottom: 10 }}>
                {[w.cask_type, w.age, w.abv].filter(Boolean).join(' · ')}
              </div>
              {w.tasting_notes && (
                <p style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                  color: '#B2AA98', lineHeight: 1.85, fontStyle: 'italic', margin: 0,
                }}>
                  {w.tasting_notes}
                </p>
              )}
            </div>
          ))
        )}

      </MemberPage>
    </>
  )
}
