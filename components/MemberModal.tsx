'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Shared member-facing modal. Renders via a portal to <body> so position:fixed is
// viewport-relative — NOT trapped by MemberPage's transformed wrapper (the banked
// bug: a non-`none` transform on an ancestor re-bases fixed descendants, so a
// modal rendered inside MemberPage opened off-centre + missed backdrop clicks).
// Scroll-locks the background; Esc + backdrop click close. Every member composer
// (message, tasting note, Snug post, introduction) should build on this.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function MemberModal({ open, onClose, title, subtitle, children, maxWidth = 640 }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  maxWidth?: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mm-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mm-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        .mm-backdrop { position: fixed; inset: 0; background: rgba(5,46,32,0.62); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99980; display: flex; align-items: flex-start; justify-content: center; padding: 56px 16px 40px; overflow-y: auto; animation: mm-fade 0.3s ease; }
        .mm-modal { background: #052E20; border: 1px solid rgba(212,184,90,0.32); border-radius: 14px; width: 100%; padding: 26px 24px 30px; box-shadow: 0 24px 70px rgba(0,0,0,0.5); animation: mm-rise 0.4s cubic-bezier(0.22,1,0.36,1); }
        @media (max-width: 460px) { .mm-backdrop { padding: 40px 12px 32px; } .mm-modal { padding: 22px 18px 26px; } }
      ` }} />
      <div className="mm-backdrop" onClick={onClose}>
        <div className="mm-modal" style={{ maxWidth }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          {(title || subtitle) && (
            <div style={headerRow}>
              <div style={{ minWidth: 0 }}>
                {title && <div style={titleStyle}>{title}</div>}
                {subtitle && <div style={subStyle}>{subtitle}</div>}
              </div>
              <button onClick={onClose} aria-label="Close" style={closeBtn}>×</button>
            </div>
          )}
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 16 }
const titleStyle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 600, color: '#E5D4C2', letterSpacing: '0.02em' }
const subStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', marginTop: 3 }
const closeBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#B2AA98', fontSize: 22, cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '0 2px' }
