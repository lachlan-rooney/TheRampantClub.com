'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Whisky } from '@/lib/types'
import BottleTile from './BottleTile'
import WhiskyRow from './WhiskyRow'

// The A–Z bottle shelf. Whiskies are grouped by their DISTILLERY's first letter
// (strip leading "The"; fall back to the name when distillery is blank) — this
// is how members think ("a Bowmore", "a Glenfiddich") and evens the spread
// (grouping by name piled 91 bottles under D from "Duncan Taylor…" bottlers).
// Click a letter → a modal of that letter's whiskies; each expands its radar
// inline (WhiskyRow). Empty letters stay on the shelf, dimmed + honest.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function letterOf(w: Whisky): string {
  const base = (w.distillery && w.distillery.trim()) ? w.distillery : w.name
  const stripped = base.replace(/^the\s+/i, '').trim()
  const m = stripped.match(/[a-zA-Z]/)
  return m ? m[0].toUpperCase() : '#'
}

export default function AlphabetShelf({ whiskies }: { whiskies: Whisky[] }) {
  const [openLetter, setOpenLetter] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // While the modal is open: scroll-lock the background + Esc closes.
  useEffect(() => {
    if (!openLetter) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenLetter(null) }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [openLetter])

  const byLetter = useMemo(() => {
    const m: Record<string, Whisky[]> = {}
    for (const L of ALPHABET) m[L] = []
    for (const w of whiskies) { const L = letterOf(w); (m[L] = m[L] || []).push(w) }
    for (const L of Object.keys(m)) m[L].sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [whiskies])

  const list = openLetter ? (byLetter[openLetter] || []) : []

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `
        .shelf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); column-gap: 0; row-gap: 26px; }
        @media (max-width: 460px) { .shelf-grid { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); row-gap: 22px; } }
        .bottle-tile { transition: transform 0.18s ease, filter 0.18s ease; }
        .bottle-tile:hover { transform: translateY(-4px); filter: drop-shadow(0 6px 10px rgba(212,184,90,0.25)); }
        .shelf-back { position: fixed; inset: 0; background: rgba(5,46,32,0.62); backdrop-filter: blur(8px); z-index: 99980; display: flex; align-items: flex-start; justify-content: center; padding: 56px 16px 40px; overflow-y: auto; animation: shelf-fade 0.3s ease; }
        @keyframes shelf-fade { from { opacity: 0 } to { opacity: 1 } }
        .shelf-modal { background: #052E20; border: 1px solid rgba(212,184,90,0.32); border-radius: 14px; max-width: 640px; width: 100%; padding: 28px 26px 32px; animation: shelf-rise 0.4s cubic-bezier(0.22,1,0.36,1); }
        @keyframes shelf-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      ` }} />

      <div className="shelf-grid">
        {ALPHABET.map(L => (
          <BottleTile key={L} letter={L} count={byLetter[L].length} onClick={() => setOpenLetter(L)} />
        ))}
      </div>

      {openLetter && mounted && createPortal(
        // Portal to <body> so position:fixed is viewport-relative, NOT trapped by
        // MemberPage's transformed wrapper (which made the modal open off-screen
        // + the backdrop miss clicks). Backdrop click + Esc both dismiss.
        <div className="shelf-back" onClick={() => setOpenLetter(null)}>
          <div className="shelf-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 600, color: '#E5D4C2' }}>
                {openLetter}
                <span style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', marginLeft: 10 }}>
                  {list.length ? `${list.length} whisk${list.length === 1 ? 'y' : 'ies'}` : ''}
                </span>
              </div>
              <button onClick={() => setOpenLetter(null)} style={{ background: 'transparent', border: 'none', color: '#B2AA98', fontSize: 22, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">×</button>
            </div>
            {list.length === 0 ? (
              <div style={{ fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.7, fontStyle: 'italic', padding: '24px 0' }}>
                No whiskies under {openLetter} yet.
              </div>
            ) : (
              <div>{list.map(w => <WhiskyRow key={w.id} w={w} />)}</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
