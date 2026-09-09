'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildDraft, type ShareInput } from '@/lib/share/draft'
import { useLang } from '@/lib/admin-lang'

// ═══════════════════════════════════════════════════════════════════════════
// SHARE PREVIEW — a ready-to-send Zalo/WhatsApp message, drafted from the entry.
// ───────────────────────────────────────────────────────────────────────────
// IT NEVER SENDS. No messaging API, no posting, no scheduling. It drafts, and a
// person presses send in their own app. An automated message to a member group
// is exactly the thing that goes out wrong at 2am with nobody to stop it.
//
// The caller decides whether this renders at all — a staff-only entry must get
// NO box, not a disabled one (see isShareable). Every private booking in the
// data is titled with a member's name.
//
// PLAIN TEXT. Zalo renders no markup, so asterisks would arrive as asterisks.
//
// The image half is PENDING the attachments build: there is nowhere to store an
// event image yet. The layout leaves the slot, and says so plainly rather than
// pretending. When attachments land, pass `attachment` and the Web Share path
// below gains `files` — no rewrite.
export default function ShareBox({
  entry, entityType, entityId,
}: {
  entry: ShareInput
  /** Where the entry's file lives, if it has one. */
  entityType?: 'fixture' | 'calendar_entry'
  entityId?: string
}) {
  const { t } = useLang()
  const [attachment, setAttachment] = useState<{ id: string; filename: string; verified_kind: string } | null>(null)
  useEffect(() => {
    if (!entityType || !entityId) return
    fetch(`/api/admin/entries/${entityType}/${entityId}/attachment`, { cache: 'no-store' })
      .then(r => r.json()).then(d => setAttachment(d.attachment ?? null)).catch(() => {})
  }, [entityType, entityId])
  const draft = useMemo(() => buildDraft(entry), [entry])
  const [open, setOpen] = useState(false)
  const [en, setEn] = useState(draft.en)
  const [vn, setVn] = useState(draft.vn)
  const [copied, setCopied] = useState<'en' | 'vn' | null>(null)

  // Editing the draft must not write back to the entry — this is a message, not
  // the record. Reset only when the entry itself changes.
  const key = `${entry.title}|${entry.date}|${entry.where}|${entry.type}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) { setLastKey(key); setEn(draft.en); setVn(draft.vn) }

  const copy = async (which: 'en' | 'vn') => {
    try {
      await navigator.clipboard.writeText(which === 'en' ? en : vn)
      setCopied(which); setTimeout(() => setCopied(null), 1800)
    } catch { /* clipboard blocked — the textarea is selectable as the fallback */ }
  }

  // navigator.share hands text (and later the image) to Zalo/WhatsApp natively in
  // one action. Feature-detected: desktop browsers mostly lack it.
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const share = async (which: 'en' | 'vn') => {
    try { await navigator.share({ text: which === 'en' ? en : vn }) } catch { /* dismissed */ }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={pill}>
        {t('Share message', 'Tin nhắn chia sẻ')}
      </button>
    )
  }

  const pane = (which: 'en' | 'vn', value: string, set: (s: string) => void, label: string) => (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={paneLabel}>{label}</div>
      <textarea
        value={value} onChange={e => set(e.target.value)} rows={9} spellCheck={false}
        style={{
          width: '100%', resize: 'vertical', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2',
          border: '1px solid rgba(229,212,194,0.14)', borderRadius: 8, padding: '10px 12px',
          fontFamily: "'Google Sans Code', monospace", fontSize: 11.5, lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => copy(which)} style={btn}>
          {copied === which ? t('Copied', 'Đã sao chép') : t('Copy', 'Sao chép')}
        </button>
        {canShare && <button onClick={() => share(which)} style={btnGhost}>{t('Share…', 'Chia sẻ…')}</button>}
      </div>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={title}>{t('Share message', 'Tin nhắn chia sẻ')}</div>
        <button onClick={() => setOpen(false)} style={btnGhost}>{t('Close', 'Đóng')}</button>
      </div>

      <div style={note}>
        {t('Copy and paste into Zalo or WhatsApp. Nothing sends from here. Edit freely — changes do not alter the entry.',
           'Sao chép và dán vào Zalo hoặc WhatsApp. Không có gì được gửi từ đây. Chỉnh sửa thoải mái — không ảnh hưởng đến mục.')}
      </div>

      {!draft.vnComplete && (
        <div style={warn}>
          {t('No Vietnamese title on this entry — the Vietnamese draft below repeats the English title. Add title_vn, or send the English only.',
             'Mục này chưa có tiêu đề tiếng Việt — bản tiếng Việt bên dưới đang dùng tiêu đề tiếng Anh. Hãy thêm title_vn, hoặc chỉ gửi bản tiếng Anh.')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {pane('en', en, setEn, t('English', 'Tiếng Anh'))}
        {pane('vn', vn, setVn, t('Vietnamese', 'Tiếng Việt'))}
      </div>

      {/* THE PICTURE THAT GOES WITH IT. A share preview that doesn't show the
          image isn't a preview. Text and an image cannot go on the clipboard
          together reliably, so it is Copy for the words and Save for the file —
          two taps, predictable, works everywhere. */}
      <div style={{ marginTop: 14, borderTop: '1px solid rgba(212,184,90,0.18)', paddingTop: 12 }}>
        {!attachment ? (
          <div style={{ ...note, marginBottom: 0 }}>
            {t('No artwork on this entry. The message goes out as text — add a file above if a partner sent one.',
               'Mục này chưa có hình. Tin nhắn sẽ gửi dạng văn bản — hãy thêm tệp ở trên nếu đối tác đã gửi.')}
          </div>
        ) : attachment.verified_kind === 'pdf' ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 20 }}>📄</div>
            <div style={{ flex: 1 }}>
              <div style={{ ...note, marginBottom: 2, color: '#E5D4C2' }}>{attachment.filename}</div>
              {/* No thumbnail, deliberately: a PDF cannot render inline anywhere on
                  this site (CSP object-src 'none'), and a broken preview is worse
                  than an honest label. It shares as a FILE. */}
              <div style={{ ...note, marginBottom: 0 }}>
                {t('A PDF shares as a file, not a picture — there is no preview.',
                   'PDF được gửi dưới dạng tệp, không phải ảnh — không có bản xem trước.')}
              </div>
            </div>
            <a href={`/api/entries/attachment/${attachment.id}`} target="_blank" rel="noreferrer" style={btnGhost}>
              {t('Save file', 'Lưu tệp')}
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/entries/attachment/${attachment.id}`} alt={attachment.filename}
                 style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(229,212,194,0.14)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...note, marginBottom: 2, color: '#E5D4C2' }}>{attachment.filename}</div>
              <div style={{ ...note, marginBottom: 0 }}>
                {t('Copy the words, save the picture, then send both.',
                   'Sao chép lời nhắn, lưu ảnh, rồi gửi cả hai.')}
              </div>
            </div>
            <a href={`/api/entries/attachment/${attachment.id}`} download={attachment.filename} style={btnGhost}>
              {t('Save image', 'Lưu ảnh')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  marginTop: 12, padding: '14px 16px', borderRadius: 10,
  background: 'rgba(212,184,90,0.05)', border: '1px solid rgba(212,184,90,0.20)',
}
const title: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2', letterSpacing: '0.02em',
}
const paneLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#B2AA98', marginBottom: 6,
}
const note: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98',
  opacity: 0.75, lineHeight: 1.7, marginBottom: 12,
}
const warn: React.CSSProperties = { ...note, color: '#D4B85A', opacity: 0.95 }
const btn: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, padding: '6px 14px', borderRadius: 6,
  border: 'none', background: '#D4B85A', color: '#052E20', fontWeight: 700, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, padding: '6px 12px', borderRadius: 6,
  border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer',
}
const pill: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, letterSpacing: '0.06em',
  padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
  border: '1px solid rgba(212,184,90,0.35)', background: 'transparent', color: '#D4B85A',
}
