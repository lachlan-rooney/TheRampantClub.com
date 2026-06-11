'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import FlavourRadar from '@/components/whisky/FlavourRadar'
import WhiskyNotes from '@/components/whisky/WhiskyNotes'

// A bottle's living story — its own data + the FlavourRadar + the members'
// conversation (WhiskyNotes: own notes any visibility, others' SNUG notes only —
// RLS-enforced; private notes never appear here). Provenance shows the house note
// when present, a graceful space when not — never fabricated.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function BottleStory() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  const [w, setW] = useState<Whisky | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    createBrowserSupabaseClient().from('whiskies').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { setW((data as Whisky) || null); setLoading(false) })
  }, [id])

  if (loading) return <MemberPage title="…" subtitle=""><p style={muted}>Pouring…</p></MemberPage>
  if (!w) return <MemberPage title="Not found" subtitle=""><p style={muted}>We couldn’t find that bottle.</p></MemberPage>

  const meta = [w.distillery, w.region].filter(Boolean).join(' · ')
  const spec = [w.cask_type, w.age, w.abv].filter(Boolean).join(' · ')

  return (
    <MemberPage title={w.name} subtitle={meta.toUpperCase() || 'A BOTTLE FROM THE SHELF'}>
      {spec && <p style={specLine}>{spec}</p>}

      {w.tasting_notes ? (
        <p style={house}>{w.tasting_notes}</p>
      ) : (
        <p style={{ ...house, opacity: 0.5 }}>No house note for this bottle yet — but the radar shows its shape, and the room may have something to say below.</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 28px' }}>
        <FlavourRadar whiskyId={w.id} />
      </div>

      <div style={divider} />
      <div style={convLabel}>The room on this bottle</div>
      <WhiskyNotes whiskyId={w.id} />
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', textAlign: 'center', opacity: 0.7 }
const specLine: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: 'rgba(178,170,152,0.6)', textAlign: 'center', marginBottom: 18 }
const house: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', lineHeight: 1.9, fontStyle: 'italic', textAlign: 'center', maxWidth: 520, margin: '0 auto' }
const divider: React.CSSProperties = { width: 6, height: 6, background: '#D4B85A', opacity: 0.4, transform: 'rotate(45deg)', margin: '8px auto 18px' }
const convLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#D4B85A', opacity: 0.8, textAlign: 'center', marginBottom: 6 }
