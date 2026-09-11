'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Ink } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// Shared branded empty-state for the member portal. The portal's empty-state
// COPY is already excellent but was hand-rolled per page with drifting styles
// (and one page fell through with a bare "No notices"). This unifies the look,
// now in the public site's language: left-aligned, a display-face headline, a
// line of mono you can read, and the CTA as an underlined line with an arrow
// that slides. No centred diamond — pass `ink` for one of the house's drawings,
// re-inked cream, drifting beside the words instead.
//
// `glyph` is still accepted so existing callers compile, but it is no longer
// drawn: the ornament it made was the centred diamond the site has dropped.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

export default function EmptyState({
  title,
  body,
  cta,
  ink,
}: {
  /** @deprecated no longer drawn — see the note above. */
  glyph?: ReactNode
  title: ReactNode
  body?: ReactNode
  cta?: { href: string; label: string }
  ink?: Ink
}) {
  // The arrow may already be in a caller's label; don't print two.
  const label = cta?.label.replace(/\s*→\s*$/, '')
  return (
    <div className="es" style={wrap}>
      <style dangerouslySetInnerHTML={{ __html: `
        .es-cta { display: inline-block; margin-top: 22px; color: #D4B85A; text-decoration: none;
                  border-bottom: 1px solid #D4B85A; padding-bottom: 6px;
                  font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
        .es-go { display: inline-block; transition: transform .35s ease; }
        .es-cta:hover .es-go { transform: translateX(7px); }
        @media (prefers-reduced-motion: reduce) { .es-go { transition: none; } }
      ` }} />
      {ink && (
        <div style={{ width: 110, flex: '0 0 auto' }}>
          <CreamInkDefs />
          <CreamInk name={ink} width="100%" rot={-6} dur={8.5} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={titleStyle}>{title}</div>
        {body && <div style={bodyStyle}>{body}</div>}
        {cta && <Link href={cta.href} className="es-cta">{label} <span className="es-go">→</span></Link>}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
  textAlign: 'left', padding: '40px 0', maxWidth: 560,
}
const titleStyle: React.CSSProperties = {
  fontFamily: SERIF, fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 400, color: '#E5D4C2', lineHeight: 1.05,
}
const bodyStyle: React.CSSProperties = {
  fontFamily: MONO, fontSize: 13, color: '#E5D4C2', opacity: 0.85, lineHeight: 1.9, marginTop: 12,
}
