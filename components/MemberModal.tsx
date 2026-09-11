'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/lib/lang'

// Shared member-facing modal. Renders via a portal to <body> so position:fixed is
// viewport-relative — NOT trapped by MemberPage's transformed wrapper (the banked
// bug: a non-`none` transform on an ancestor re-bases fixed descendants, so a
// modal rendered inside MemberPage opened off-centre + missed backdrop clicks).
// Scroll-locks the background; Esc + backdrop click close. Every member composer
// (message, tasting note, Snug post, introduction) should build on this.
//
// Set like the rest of the portal: a sheet of the bottle green over a dimmed,
// blurred room, a hairline edge rather than a gold box, the title large in the
// display face and left-aligned, the subtitle in mono, and a plain × to close.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function MemberModal({ open, onClose, title, subtitle, children, maxWidth = 640 }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  maxWidth?: number
}) {
  const { t } = useLang()
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
        @keyframes mm-rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: translateY(0) } }
        .mm-backdrop { position: fixed; inset: 0; background: rgba(2,22,15,0.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                       z-index: 99980; display: flex; align-items: flex-start; justify-content: center;
                       padding: 72px 20px 48px; overflow-y: auto; animation: mm-fade 0.3s ease; }
        .mm-modal { position: relative; background: #052E20; color: #E5D4C2; text-align: left;
                    border: 1px solid rgba(229,212,194,0.16); border-radius: 16px;
                    width: 100%; padding: 34px 34px 36px; box-shadow: 0 40px 90px rgba(0,0,0,0.55);
                    animation: mm-rise 0.5s cubic-bezier(0.16,0.84,0.44,1); }
        .mm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px;
                   margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid rgba(229,212,194,0.14); }
        .mm-title { font-family: 'Rampant Sans', serif; font-weight: 400; font-size: clamp(28px, 4vw, 38px); line-height: 1.02;
                    color: #E5D4C2; margin: 0; }
        .mm-sub { font-family: ${MONO}; font-size: 12px; line-height: 1.7; letter-spacing: 0.06em; color: #E5D4C2; opacity: .75; margin-top: 10px; }
        .mm-close { flex-shrink: 0; width: 38px; height: 38px; margin: -4px -6px 0 0; border-radius: 50%;
                    display: inline-flex; align-items: center; justify-content: center;
                    background: transparent; border: 1px solid rgba(229,212,194,0.28); color: #E5D4C2;
                    font-family: ${MONO}; font-size: 20px; line-height: 1; cursor: pointer;
                    transition: border-color .25s ease, color .25s ease, transform .35s ease; }
        .mm-close:hover { border-color: #D4B85A; color: #D4B85A; transform: rotate(90deg); }
        @media (max-width: 460px) {
          .mm-backdrop { padding: 48px 12px 32px; }
          .mm-modal { padding: 26px 20px 28px; border-radius: 14px; }
          .mm-title { font-size: 28px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mm-backdrop, .mm-modal { animation: none; }
          .mm-close { transition: none; }
          .mm-close:hover { transform: none; }
        }
      ` }} />
      <div className="mm-backdrop" onClick={onClose}>
        <div className="mm-modal" style={{ maxWidth }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          {(title || subtitle) && (
            <div className="mm-head">
              <div style={{ minWidth: 0 }}>
                {title && <div className="mm-title">{title}</div>}
                {subtitle && <div className="mm-sub">{subtitle}</div>}
              </div>
              <button onClick={onClose} aria-label={t('Close', 'Đóng')} className="mm-close">×</button>
            </div>
          )}
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}
