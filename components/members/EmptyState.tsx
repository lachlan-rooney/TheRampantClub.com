'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

// Shared branded empty-state for the member portal. The portal's empty-state
// COPY is already excellent but was hand-rolled per page with drifting styles
// (and one page fell through with a bare "No notices"). This unifies the look:
// a faint diamond, a serif headline, a monospace line, and an optional CTA.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

export default function EmptyState({
  glyph = '❖',
  title,
  body,
  cta,
}: {
  glyph?: ReactNode
  title: ReactNode
  body?: ReactNode
  cta?: { href: string; label: string }
}) {
  return (
    <div style={wrap}>
      <div style={glyphStyle} aria-hidden>{glyph}</div>
      <div style={titleStyle}>{title}</div>
      {body && <div style={bodyStyle}>{body}</div>}
      {cta && <Link href={cta.href} style={ctaStyle}>{cta.label} →</Link>}
    </div>
  )
}

const wrap: React.CSSProperties = {
  textAlign: 'center', padding: '48px 24px', maxWidth: 440, margin: '0 auto',
}
const glyphStyle: React.CSSProperties = {
  fontFamily: SERIF, fontSize: 30, color: '#D4B85A', opacity: 0.55, marginBottom: 16, lineHeight: 1,
}
const titleStyle: React.CSSProperties = {
  fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.02em', lineHeight: 1.3,
}
const bodyStyle: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, marginTop: 12,
}
const ctaStyle: React.CSSProperties = {
  display: 'inline-block', marginTop: 20, fontFamily: MONO, fontSize: 12, color: '#D4B85A',
  textDecoration: 'none', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 22, padding: '9px 20px',
}
