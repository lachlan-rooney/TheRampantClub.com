'use client'

import { useCallback, useState } from 'react'

// Shared branded dialogs for the admin surface — one source of truth for the
// confirm modal, the prompt (text-entry) modal, and the toast. Replaces the
// per-page inline copies and the native window.confirm / alert / prompt.
//
// Usage:
//   const { showToast, toastNode } = useToast()
//   ...
//   <ConfirmModal open={!!target} eyebrow="⚠ PERMANENT" title="Delete X?"
//     subject={target?.name} body="…" confirmLabel="Delete"
//     onCancel={() => setTarget(null)} onConfirm={run} busy={busy} />
//   {toastNode}

const FAMILY = "'Google Sans Code', monospace"

// ── Confirm modal ───────────────────────────────────────────────────
export type ConfirmTone = 'danger' | 'info' | 'success'

const TONE_ACCENT: Record<ConfirmTone, string> = {
  danger:  '#C27070',
  info:    '#D4B85A',
  success: '#7AB07A',
}
const TONE_GO_BG: Record<ConfirmTone, string> = {
  danger:  '#C27070',
  info:    '#5E6650',
  success: '#5E8A5E',
}

export function ConfirmModal({
  open, eyebrow, title, subject, body,
  confirmLabel, busyLabel, busy = false,
  tone = 'danger', onConfirm, onCancel,
}: {
  open: boolean
  eyebrow: string
  title: string
  subject?: React.ReactNode
  body: React.ReactNode
  confirmLabel: string
  busyLabel?: string
  busy?: boolean
  tone?: ConfirmTone
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  const accent = TONE_ACCENT[tone]
  return (
    <>
      <div style={backdrop} onClick={() => { if (!busy) onCancel() }} />
      <div
        style={{ ...modalBox, border: `1px solid ${accent}73`, borderLeft: `3px solid ${accent}` }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ ...eyebrowStyle, color: accent }}>{eyebrow}</div>
        <div style={titleStyle}>{title}</div>
        {subject != null && <div style={subjectStyle}>{subject}</div>}
        <div style={bodyStyle}>{body}</div>
        <div style={actionsStyle}>
          <button onClick={onCancel} disabled={busy} style={cancelBtn}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ ...goBtn, background: TONE_GO_BG[tone], opacity: busy ? 0.5 : 1 }}
          >
            {busy ? (busyLabel || 'Working…') : confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Prompt (text-entry) modal ───────────────────────────────────────
// Branded replacement for window.prompt. onConfirm receives the trimmed
// value. `validate` returns an error string (shown inline) or null to allow.
export function PromptModal(props: {
  open: boolean
  eyebrow?: string
  title: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  multiline?: boolean
  busy?: boolean
  validate?: (value: string) => string | null
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  if (!props.open) return null
  return <PromptModalInner {...props} />
}

function PromptModalInner({
  eyebrow = '✎ INPUT', title, label, placeholder, defaultValue = '',
  confirmLabel = 'Save', multiline = false, busy = false,
  validate, onConfirm, onCancel,
}: {
  eyebrow?: string
  title: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  multiline?: boolean
  busy?: boolean
  validate?: (value: string) => string | null
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const trimmed = value.trim()
    const err = validate ? validate(trimmed) : (trimmed ? null : 'Required.')
    if (err) { setError(err); return }
    onConfirm(trimmed)
  }

  return (
    <>
      <div style={backdrop} onClick={() => { if (!busy) onCancel() }} />
      <div
        style={{ ...modalBox, border: '1px solid #D4B85A73', borderLeft: '3px solid #D4B85A' }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ ...eyebrowStyle, color: '#D4B85A' }}>{eyebrow}</div>
        <div style={titleStyle}>{title}</div>
        {label && <div style={{ ...subjectStyle, marginBottom: 6 }}>{label}</div>}
        {multiline ? (
          <textarea
            autoFocus
            rows={3}
            value={value}
            placeholder={placeholder}
            onChange={e => { setValue(e.target.value); if (error) setError(null) }}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        ) : (
          <input
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={e => { setValue(e.target.value); if (error) setError(null) }}
            onKeyDown={e => { if (e.key === 'Enter' && !multiline) submit() }}
            style={inputStyle}
          />
        )}
        {error && <div style={inputError}>{error}</div>}
        <div style={{ ...actionsStyle, marginTop: 14 }}>
          <button onClick={onCancel} disabled={busy} style={cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={busy}
            style={{ ...goBtn, background: '#5E6650', opacity: busy ? 0.5 : 1 }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Toast ───────────────────────────────────────────────────────────
export type ToastTone = 'info' | 'success' | 'error' | 'warn'

const TOAST_ACCENT: Record<ToastTone, string> = {
  info:    '#7AB07A',
  success: '#7AB07A',
  error:   '#C27070',
  warn:    '#D4B85A',
}
const TOAST_GLYPH: Record<ToastTone, string> = {
  info: '✓', success: '✓', error: '✕', warn: '!',
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)
  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4200)
  }, [])
  const accent = toast ? TOAST_ACCENT[toast.tone] : ''
  const toastNode = toast ? (
    <div
      style={{ ...toastBox, border: `1px solid ${accent}73`, borderLeft: `3px solid ${accent}` }}
      role="status"
    >
      <span style={{ marginRight: 8, color: accent }}>{TOAST_GLYPH[toast.tone]}</span>
      {toast.message}
    </div>
  ) : null
  return { showToast, toastNode }
}

// ── shared styles ───────────────────────────────────────────────────
const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 600,
}
const modalBox: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(480px, 92vw)',
  background: '#0A3526',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 601,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const eyebrowStyle: React.CSSProperties = {
  fontFamily: FAMILY, fontSize: 9,
  letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
  marginBottom: 8,
}
const titleStyle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.02em', marginBottom: 6,
}
const subjectStyle: React.CSSProperties = {
  fontFamily: FAMILY, fontSize: 11,
  color: '#B2AA98', marginBottom: 12,
}
const bodyStyle: React.CSSProperties = {
  fontFamily: FAMILY, fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, marginBottom: 14,
}
const actionsStyle: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
}
const cancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const goBtn: React.CSSProperties = {
  color: '#FFFFFF',
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: FAMILY, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6,
  padding: '10px 12px', fontFamily: FAMILY,
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const inputError: React.CSSProperties = {
  marginTop: 8, fontFamily: FAMILY, fontSize: 10, color: '#C27070',
}
const toastBox: React.CSSProperties = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 700,
  padding: '12px 18px', maxWidth: 'min(420px, 92vw)',
  background: '#0A3526',
  borderRadius: 8,
  fontFamily: FAMILY, fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.02em',
  display: 'flex', alignItems: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
}
