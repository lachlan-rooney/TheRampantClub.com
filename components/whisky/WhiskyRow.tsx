'use client'

import { useState } from 'react'
import type { Whisky } from '@/lib/types'
import FlavourRadar from './FlavourRadar'
import WhiskyNotes from './WhiskyNotes'

// One whisky's display + a self-contained tap-to-reveal flavour radar. Reused by
// the alphabet-shelf letter modal AND the search results — same row everywhere.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function WhiskyRow({ w }: { w: Whisky }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(229,212,194,0.1)', opacity: w.in_stock ? 1 : 0.5 }}>
      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 600, color: '#E5D4C2', marginBottom: 4 }}>
        {w.committees_pick && <span style={{ color: '#B2AA98', marginRight: 6 }}>◆</span>}{w.name}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 8 }}>
        {[w.distillery, w.region].filter(Boolean).join(' · ')}
      </div>
      {(w.cask_type || w.age || w.abv) && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(178,170,152,0.5)', marginBottom: 10 }}>
          {[w.cask_type, w.age, w.abv].filter(Boolean).join(' · ')}
        </div>
      )}
      {w.tasting_notes ? (
        <p style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.85, fontStyle: 'italic', margin: 0 }}>
          {w.tasting_notes}
        </p>
      ) : (
        <p style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(178,170,152,0.45)', fontStyle: 'italic', margin: 0 }}>
          Tasting notes coming soon — tap the flavour profile for its shape.
        </p>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          marginTop: 12, background: 'transparent', cursor: 'pointer',
          border: '1px solid rgba(212,184,90,0.3)', borderRadius: 20, padding: '5px 14px',
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: '#D4B85A',
        }}
      >
        {open ? '↑ Hide flavour profile' : '↓ Flavour profile'}
      </button>
      {open && <div style={{ marginTop: 14 }}><FlavourRadar whiskyId={w.id} /></div>}
      <WhiskyNotes whiskyId={w.id} />
    </div>
  )
}
