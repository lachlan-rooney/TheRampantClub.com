'use client'

import type { ReactNode } from 'react'
import MemberModal from '@/components/MemberModal'

// Branded confirm dialog for the member portal, built on MemberModal — replaces
// the off-brand native window.confirm() used for destructive actions (Snug post
// delete, note delete, block member). Portal-rendered so it isn't trapped by
// MemberPage's transform.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

export default function ConfirmModal({
  open, onClose, onConfirm, title, body,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false,
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
  return (
    <MemberModal open={open} onClose={onClose} maxWidth={440} title={title}>
      {body && <p style={bodyStyle}>{body}</p>}
      <div style={actions}>
        <button onClick={onClose} disabled={busy} style={cancelBtn}>{cancelLabel}</button>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            ...confirmBtn,
            background: danger ? '#B45656' : '#D4B85A',
            color: danger ? '#F5E9E9' : '#052E20',
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </MemberModal>
  )
}

const bodyStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.7, marginTop: -4, marginBottom: 20 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end' }
const cancelBtn: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.22)', borderRadius: 22, padding: '9px 18px', fontFamily: MONO, fontSize: 12, cursor: 'pointer' }
const confirmBtn: React.CSSProperties = { border: 'none', borderRadius: 22, padding: '9px 20px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
