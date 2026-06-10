'use client'

import { useMemo, useState } from 'react'
import type { Whisky } from '@/lib/types'
import BottleTile from './BottleTile'
import WhiskyRow from './WhiskyRow'
import MemberModal from '@/components/MemberModal'

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
      ` }} />

      <div className="shelf-grid">
        {ALPHABET.map(L => (
          <BottleTile key={L} letter={L} count={byLetter[L].length} onClick={() => setOpenLetter(L)} />
        ))}
      </div>

      <MemberModal
        open={!!openLetter}
        onClose={() => setOpenLetter(null)}
        title={openLetter || ''}
        subtitle={openLetter && list.length ? `${list.length} whisk${list.length === 1 ? 'y' : 'ies'}` : undefined}
      >
        {list.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.7, fontStyle: 'italic', padding: '24px 0' }}>
            No whiskies under {openLetter} yet.
          </div>
        ) : (
          <div>{list.map(w => <WhiskyRow key={w.id} w={w} />)}</div>
        )}
      </MemberModal>
    </div>
  )
}
