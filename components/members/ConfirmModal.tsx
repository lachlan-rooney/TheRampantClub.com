'use client'

import type { ReactNode } from 'react'
import MemberModal from '@/components/MemberModal'
import { useLang } from '@/lib/lang'

// Branded confirm dialog for the member portal, built on MemberModal — replaces
// the off-brand native window.confirm() used for destructive actions (Snug post
// delete, note delete, block member). Portal-rendered so it isn't trapped by
// MemberPage's transform. The two answers are the site's CTAs — mono lines with
// an underline, no pills: the confirm in gold (or a soft red when it destroys
// something), with the arrow that slides.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function ConfirmModal({
  open, onClose, onConfirm, title, body,
  confirmLabel, cancelLabel, danger = false, busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
}) {
  const { t } = useLang()
  return (
    <MemberModal open={open} onClose={onClose} maxWidth={440} title={title}>
      <style dangerouslySetInnerHTML={{ __html: `
        .cm-btn { background: none; border: none; border-bottom: 1px solid currentColor; border-radius: 0;
                  padding: 0 0 6px; cursor: pointer; font-family: ${MONO}; font-size: 12px;
                  letter-spacing: .12em; text-transform: uppercase; }
        .cm-btn:disabled { cursor: default; }
        .cm-go { display: inline-block; transition: transform .35s ease; }
        .cm-btn:hover:not(:disabled) .cm-go { transform: translateX(7px); }
        @media (prefers-reduced-motion: reduce) { .cm-go { transition: none; } }
      ` }} />
      {body && <p style={bodyStyle}>{body}</p>}
      <div style={actions}>
        <button onClick={onClose} disabled={busy} className="cm-btn" style={cancelBtn}>{cancelLabel ?? t('Cancel', 'Hủy')}</button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="cm-btn"
          style={{ color: danger ? '#E89B9B' : '#D4B85A', opacity: busy ? 0.5 : 1 }}
        >
          {busy ? t('Working…', 'Đang xử lý…') : (confirmLabel ?? t('Confirm', 'Xác nhận'))}
          {!busy && <> <span className="cm-go" aria-hidden="true">→</span></>}
        </button>
      </div>
    </MemberModal>
  )
}

const bodyStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#E5D4C2', opacity: 0.85, lineHeight: 1.85, marginTop: -4, marginBottom: 26 }
const actions: React.CSSProperties = { display: 'flex', gap: 30, justifyContent: 'flex-end', alignItems: 'baseline', flexWrap: 'wrap' }
const cancelBtn: React.CSSProperties = { color: '#E5D4C2', opacity: 0.7 }
