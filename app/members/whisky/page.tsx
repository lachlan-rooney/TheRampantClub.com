'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'
import ForYouRecs from '@/components/whisky/ForYouRecs'
import FlavourRadar from '@/components/whisky/FlavourRadar'

export default function WhiskyPage() {
  const [whiskies, setWhiskies] = useState<Whisky[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  // Tap-to-reveal the flavour radar per bottle — lazy, so only the bottles a
  // member opens fetch their spokes (not all 105 mapped at once).
  const [openRadar, setOpenRadar] = useState<Set<string>>(new Set())
  const toggleRadar = (id: string) => setOpenRadar(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('whiskies').select('*').order('committees_pick', { ascending: false }).order('name')
      .then(({ data }) => { if (data) setWhiskies(data); setLoading(false) })
    setFocusId(new URLSearchParams(window.location.search).get('focus'))
  }, [])

  // Deep-link from the Finder (?focus=<id>) → reveal (clear any region/stock
  // filter that would hide it), scroll to it, brief highlight. Works for an
  // out-of-stock match too (switches to "Past Drams" so the row isn't hidden).
  useEffect(() => {
    if (!focusId || loading) return
    const w = whiskies.find(x => x.id === focusId)
    if (!w) return
    setFilter(w.in_stock ? 'All' : 'Past Drams')
    const t = setTimeout(() => {
      document.getElementById(`w-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(focusId)
      setTimeout(() => setHighlightId(null), 2400)
    }, 150)
    return () => clearTimeout(t)
  }, [focusId, loading, whiskies])

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
        icon="/images/whisky-glass-icon-opt.png"
        description={`${whiskies.length} bottle${whiskies.length === 1 ? '' : 's'} and counting`}
      >
        <Link href="/members/whisky/finder" style={{
          display: 'block', textAlign: 'center', marginBottom: 24, textDecoration: 'none',
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, letterSpacing: '0.04em',
          color: '#D4B85A', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 24, padding: '11px 20px',
        }}>
          ◆ Find your dram — match by flavour →
        </Link>
        <ForYouRecs />
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
            <div key={w.id} id={`w-${w.id}`} style={{
              padding: '24px 0', borderBottom: '1px solid rgba(229,212,194,0.1)', opacity: w.in_stock ? 1 : 0.4,
              ...(highlightId === w.id ? { background: 'rgba(212,184,90,0.10)', boxShadow: 'inset 0 0 0 1px rgba(212,184,90,0.4)', borderRadius: 8 } : {}),
              transition: 'background 0.6s ease, box-shadow 0.6s ease', scrollMarginTop: 90,
            }}>
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
              <button
                onClick={() => toggleRadar(w.id)}
                aria-expanded={openRadar.has(w.id)}
                style={{
                  marginTop: 12, background: 'transparent', cursor: 'pointer',
                  border: '1px solid rgba(212,184,90,0.3)', borderRadius: 20, padding: '5px 14px',
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                  letterSpacing: '0.06em', color: '#D4B85A',
                }}
              >
                {openRadar.has(w.id) ? '↑ Hide flavour profile' : '↓ Flavour profile'}
              </button>
              {openRadar.has(w.id) && (
                <div style={{ marginTop: 14 }}>
                  <FlavourRadar whiskyId={w.id} />
                </div>
              )}
            </div>
          ))
        )}

      </MemberPage>
    </>
  )
}
