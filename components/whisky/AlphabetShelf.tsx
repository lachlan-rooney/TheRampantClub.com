'use client'

import { useMemo, useState } from 'react'
import type { Whisky } from '@/lib/types'
import BottleTile from './BottleTile'
import WhiskyRow from './WhiskyRow'
import MemberModal from '@/components/MemberModal'
import { useLang } from '@/lib/lang'

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
  const { t } = useLang()
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
        /* Two shelves of thirteen on a desk — the alphabet in two rows, like
           bottles standing on a back bar — then three, then four on a phone. */
        .shelf-grid { display: grid; grid-template-columns: repeat(13, minmax(0, 1fr)); column-gap: 0; row-gap: 38px; }
        @media (max-width: 1000px) { .shelf-grid { grid-template-columns: repeat(9, minmax(0, 1fr)); } }
        @media (max-width: 640px)  { .shelf-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 28px; } }
        .bottle-tile { transition: transform 0.25s cubic-bezier(.16,.84,.44,1), filter 0.25s ease; }
        .bottle-tile:hover { transform: translateY(-5px); filter: drop-shadow(0 8px 12px rgba(212,184,90,0.28)); }
        @media (prefers-reduced-motion: reduce) { .bottle-tile, .bottle-tile:hover { transition: none; transform: none; } }
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
        subtitle={openLetter && list.length ? t(`${list.length} whisk${list.length === 1 ? 'y' : 'ies'}`, `${list.length} whisky`) : undefined}
      >
        {list.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.9, color: '#E5D4C2', opacity: 0.78, padding: '24px 0' }}>
            {t(`No whiskies under ${openLetter} yet.`, `Chưa có whisky nào ở chữ ${openLetter}.`)}
          </div>
        ) : (
          <div className="wl-list">{list.map(w => <WhiskyRow key={w.id} w={w} />)}</div>
        )}
      </MemberModal>
    </div>
  )
}
