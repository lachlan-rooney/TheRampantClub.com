'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE EVENT'S FILE — one image or PDF, on a fixture or a calendar entry.
// ───────────────────────────────────────────────────────────────────────────
// Works on an entry that ALREADY EXISTS, not only at creation: the events that
// most need artwork are the ones already in the calendar.
//
// THE PROMPT. An uploaded file carries exactly what the titling convention was
// written to prevent — a seating plan, a partner's guest list, a private-hire
// invitation with a member's name on it — and it arrives through a door the
// title rule does not cover. So the warning sits HERE, at the moment of
// choosing the file, and it says what actually happens to it.
export interface Attachment {
  id: string; mime: string; filename: string; bytes: number; verified_kind: string
}

export default function AttachmentField({
  entityType, entityId, memberVisible, onChange,
}: {
  entityType: 'fixture' | 'calendar_entry'
  entityId: string
  memberVisible: boolean
  onChange?: (a: Attachment | null) => void
}) {
  const { t } = useLang()
  const [att, setAtt] = useState<Attachment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const base = `/api/admin/entries/${entityType}/${entityId}/attachment`

  useEffect(() => {
    fetch(base, { cache: 'no-store' }).then(r => r.json())
      .then(d => setAtt(d.attachment ?? null)).catch(() => {}).finally(() => setLoaded(true))
  }, [base])

  const set = useCallback((a: Attachment | null) => { setAtt(a); onChange?.(a) }, [onChange])

  const upload = async (file: File) => {
    setBusy(true); setError(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(base, { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({}))
      // The server's refusal is written for a staff member to act on — show it
      // rather than replacing it with "upload failed".
      if (!r.ok) { setError(j.error || t('Could not upload that file.', 'Không thể tải tệp lên.')); return }
      set(j.attachment)
    } catch { setError(t('Could not upload that file.', 'Không thể tải tệp lên.')) }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const remove = async () => {
    setBusy(true); setError(null)
    try { await fetch(base, { method: 'DELETE' }); set(null) }
    catch { setError(t('Could not remove it.', 'Không thể xoá.')) }
    finally { setBusy(false) }
  }

  if (!loaded) return null

  return (
    <div style={wrap}>
      <div style={label}>{t('Artwork or invitation', 'Hình ảnh hoặc thư mời')}</div>

      <div style={note}>
        {memberVisible
          ? t('Members see this on What’s On, and it may go out to the club’s Zalo and WhatsApp groups. Never upload a seating plan, a guest list, or anything else naming a member or a guest.',
              'Hội viên sẽ thấy tệp này trong What’s On, và nó có thể được gửi tới nhóm Zalo và WhatsApp của câu lạc bộ. Tuyệt đối không tải lên sơ đồ chỗ ngồi, danh sách khách, hay bất cứ thứ gì có tên hội viên hoặc khách.')
          : t('This entry is staff-only, so the file stays internal — a member cannot open it. If you make the entry member-visible, the file becomes visible too.',
              'Mục này chỉ dành cho nhân viên nên tệp được giữ nội bộ — hội viên không mở được. Nếu chuyển mục sang chế độ hội viên thấy được, tệp cũng sẽ hiển thị.')}
      </div>

      {att ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 10 }}>
          {att.verified_kind === 'pdf' ? (
            // A PDF is a LINK CARD, never an embed. The site's CSP sets
            // object-src 'none', so an inline PDF never renders anywhere here —
            // naming it a link card stops someone rebuilding the embed later.
            <a href={`/api/entries/attachment/${att.id}`} target="_blank" rel="noreferrer" style={pdfCard}>
              <div style={{ fontSize: 18 }}>📄</div>
              <div>
                <div style={{ color: '#E5D4C2' }}>{att.filename}</div>
                <div style={{ opacity: .7 }}>{t('PDF · opens as a file', 'PDF · mở dưới dạng tệp')}</div>
              </div>
            </a>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/entries/attachment/${att.id}`} alt={att.filename}
                 style={{ width: 128, height: 128, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(229,212,194,0.14)' }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={meta}>{att.filename}</div>
            <div style={meta}>{(att.bytes / 1024).toFixed(0)} KB</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fileRef.current?.click()} disabled={busy} style={btnGhost}>
                {t('Replace', 'Thay thế')}
              </button>
              <button onClick={remove} disabled={busy} style={btnGhost}>{t('Remove', 'Xoá')}</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...btnGhost, marginTop: 10 }}>
          {busy ? t('Uploading…', 'Đang tải lên…') : t('Add a file', 'Thêm tệp')}
        </button>
      )}

      <input
        ref={fileRef} type="file" hidden
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
      />
      <div style={{ ...meta, marginTop: 8, opacity: .55 }}>
        {t('JPEG, PNG, WebP or PDF · up to 5MB · one per event', 'JPEG, PNG, WebP hoặc PDF · tối đa 5MB · một tệp cho mỗi sự kiện')}
      </div>
      {error && <div style={{ ...meta, color: '#C27070', marginTop: 6 }}>{error}</div>}
    </div>
  )
}

const wrap: React.CSSProperties = {
  marginTop: 12, padding: '14px 16px', borderRadius: 10,
  background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)',
}
const label: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#B2AA98', marginBottom: 8,
}
const note: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A',
  opacity: .9, lineHeight: 1.7,
}
const meta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98',
}
const btnGhost: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, padding: '6px 12px', borderRadius: 6,
  border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer',
}
const pdfCard: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 8,
  border: '1px solid rgba(229,212,194,0.16)', background: 'rgba(5,46,32,0.4)', textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', minWidth: 220,
}
