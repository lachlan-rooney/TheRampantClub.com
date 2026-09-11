'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Whisky } from '@/lib/types'
import FlavourRadar from './FlavourRadar'
import WhiskyNotes from './WhiskyNotes'
import { bare, RADAR } from './WhiskyStyle'
import { useLang } from '@/lib/lang'

// One whisky's display + a self-contained tap-to-reveal flavour radar. Reused by
// the alphabet-shelf letter modal AND the search results — same row everywhere.
//
// Set as a line of a bottle list: the name in the display face, where it comes
// from in tracked mono, the house note as text you can read, and the radar given
// its own column when there is room for one (the row is laid out by the width of
// its list — see .wl-list in WhiskyStyle — so in a letter's sheet it stacks).

export default function WhiskyRow({ w }: { w: Whisky }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const origin = [w.distillery, w.region].filter(Boolean).join(' · ')
  const spec = [w.cask_type, w.age, w.abv].filter(Boolean).join(' · ')
  return (
    <article className={`wl-row ${open ? 'is-open' : ''} ${w.in_stock ? '' : 'is-out'}`}>
      <div style={{ minWidth: 0 }}>
        <h3 className="wl-row-name">
          {w.committees_pick && <span className="wl-pick" aria-hidden="true">◆</span>}{w.name}
        </h3>
        {origin && <div className="wl-meta wl-row-origin">{origin}</div>}
        {spec && <div className="wl-row-spec">{spec}</div>}
        {w.tasting_notes ? (
          <p className="wl-row-note">{w.tasting_notes}</p>
        ) : (
          <p className="wl-row-note is-empty">
            {t('Tasting notes coming soon — tap the flavour profile for its shape.', 'Ghi chú nếm thử sắp có — chạm vào hồ sơ hương vị để xem hình dáng.')}
          </p>
        )}
        <div className="wl-acts">
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="wl-link is-gold">
            {open ? t('↑ Hide flavour profile', '↑ Ẩn hồ sơ hương vị') : t('↓ Flavour profile', '↓ Hồ sơ hương vị')}
          </button>
          <Link href={`/members/whisky/${w.id}`} className="wl-link is-quiet">
            {bare(t('↗ Bottle story', '↗ Câu chuyện chai'))} <span className="pk-go" aria-hidden="true">→</span>
          </Link>
        </div>
        <WhiskyNotes whiskyId={w.id} />
      </div>
      {open && <div className="wl-row-radar wl-radar"><FlavourRadar whiskyId={w.id} size={RADAR} /></div>}
    </article>
  )
}
