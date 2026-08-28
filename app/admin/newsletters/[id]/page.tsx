'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

// Kept in sync with NEWSLETTER_SECTIONS in lib/newsletter/render.ts.
const SECTIONS = [
  { key: 'intro', en: 'Opening note', vi: 'Lời mở đầu', hint: 'A warm welcome / what this issue covers.' },
  { key: 'feature', en: 'Feature', vi: 'Bài chính', hint: 'The main story — a recap, an announcement.' },
  { key: 'spotlight', en: 'Spotlight', vi: 'Điểm nhấn', hint: 'A member spotlight, a dram of the month, a moment.' },
  { key: 'closing', en: 'Closing', vi: 'Lời kết', hint: 'A sign-off. Links welcome: [label](https://…).' },
]

interface NL {
  id: string; subject: string; status: string; sections: Record<string, string>
  auto_data: { period?: { label: string }; stats?: Record<string, number>; new_members?: { name: string }[] } | Record<string, never>
  share_token: string; recipient_count: number | null; sent_at: string | null
}

export default function NewsletterEditor() {
  const { t } = useLang()
  const id = useParams<{ id: string }>().id
  const [nl, setNl] = useState<NL | null>(null)
  const [subject, setSubject] = useState('')
  const [sections, setSections] = useState<Record<string, string>>({})
  const [recipientCount, setRecipientCount] = useState(0)
  const [sendEnabled, setSendEnabled] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const load = useCallback(async () => {
    const [r, list] = await Promise.all([
      fetch(`/api/admin/newsletters/${id}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/newsletters', { cache: 'no-store' }).then(r => r.json()),
    ])
    if (r.newsletter) { setNl(r.newsletter); setSubject(r.newsletter.subject); setSections(r.newsletter.sections || {}) }
    setRecipientCount(list.recipient_count || 0); setSendEnabled(!!list.settings?.send_enabled)
  }, [id])
  useEffect(() => { load() }, [load])

  const locked = nl ? (nl.status !== 'draft' && nl.status !== 'pending_approval') : true

  const save = async () => {
    setBusy('save'); setMsg(null)
    try {
      const r = await fetch(`/api/admin/newsletters/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, sections }) })
      const j = await r.json()
      setMsg(r.ok ? t('Saved.', 'Đã lưu.') : (j.error || 'Error'))
    } finally { setBusy(null) }
  }
  const act = async (path: string, okMsg: string) => {
    setBusy(path); setMsg(null)
    try {
      const r = await fetch(`/api/admin/newsletters/${id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(j.error || 'Error'); return }
      setMsg(okMsg); await load()
    } finally { setBusy(null) }
  }
  const previewPost = async () => {
    const r = await fetch(`/api/admin/newsletters/${id}/send?dry=1`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const html = await r.text(); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() }
  }
  const testSend = async () => {
    setBusy('test'); setMsg(null)
    try {
      const r = await fetch(`/api/admin/newsletters/${id}/send?mode=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await r.json(); setMsg(r.ok ? `${t('Test sent', 'Đã gửi thử')}: ${j.sent}` : (j.error || 'Error'))
    } finally { setBusy(null) }
  }
  const liveSend = async () => {
    setBusy('send'); setMsg(null)
    try {
      const r = await fetch(`/api/admin/newsletters/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmText.trim() }) })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error || 'Error'); if (j.need) setMsg(`${j.error} ${t('Type', 'Nhập')}: ${j.need}`); return }
      setMsg(`${t('Sent to', 'Đã gửi đến')} ${j.sent} ${t('members', 'hội viên')}${j.failed ? `, ${j.failed} failed` : ''}.`)
      setConfirmSend(false); setConfirmText(''); await load()
    } finally { setBusy(null) }
  }

  if (!nl) return <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98' }}>{t('Loading…', 'Đang tải…')}</div>

  const a = nl.auto_data && 'stats' in nl.auto_data ? nl.auto_data : null
  const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 7, padding: '10px 12px', fontFamily: MONO, fontSize: 13, outline: 'none' }
  const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 11, borderRadius: 7, padding: '9px 16px', cursor: 'pointer', border: '1px solid rgba(229,212,194,0.2)', background: 'rgba(229,212,194,0.04)', color: '#B2AA98' }
  const gold: React.CSSProperties = { ...btn, background: '#D4B85A', color: '#052E20', border: 'none', fontWeight: 700 }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link href="/admin/newsletters" style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }}>← {t('All newsletters', 'Tất cả bản tin')}</Link>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, color: '#E5D4C2', margin: '14px 0 2px' }}>{a?.period?.label || t('Newsletter', 'Bản tin')}</h1>
      <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginBottom: 18 }}>{t('Status', 'Trạng thái')}: {nl.status}{a ? ` · ${a.stats?.new_member_count || 0} ${t('new members', 'hội viên mới')} · ${a.stats?.visits || 0} ${t('visits', 'lượt ghé')}` : ''}</div>

      {msg && <div style={{ fontFamily: MONO, fontSize: 11, color: '#E7C766', marginBottom: 12 }}>{msg}</div>}

      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B2AA98', margin: '0 0 5px' }}>{t('Subject line', 'Tiêu đề email')}</div>
      <input style={{ ...input, marginBottom: 18 }} value={subject} onChange={e => setSubject(e.target.value)} disabled={locked} />

      {SECTIONS.map(s => (
        <div key={s.key} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D4B85A', margin: '0 0 4px' }}>{t(s.en, s.vi)} <span style={{ color: '#7E7864', textTransform: 'none', letterSpacing: 0 }}>— {s.hint}</span></div>
          <textarea style={{ ...input, minHeight: 80, lineHeight: 1.6, resize: 'vertical' }} value={sections[s.key] || ''} onChange={e => setSections(v => ({ ...v, [s.key]: e.target.value }))} disabled={locked} />
        </div>
      ))}

      {!locked && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={save} disabled={busy === 'save'} style={gold}>{busy === 'save' ? t('Saving…', 'Đang lưu…') : t('Save', 'Lưu')}</button>
          <button onClick={() => act('refresh-data', t('Recap refreshed.', 'Đã cập nhật tổng kết.'))} disabled={busy === 'refresh-data'} style={btn}>{t('Refresh recap data', 'Cập nhật dữ liệu')}</button>
          <button onClick={previewPost} style={btn}>{t('Preview email ↗', 'Xem trước email ↗')}</button>
          <Link href={`/newsletter/${nl.share_token}`} target="_blank" style={{ ...btn, textDecoration: 'none' }}>{t('Preview page ↗', 'Xem trang ↗')}</Link>
        </div>
      )}

      {/* Lifecycle controls */}
      <div style={{ borderTop: '1px solid rgba(229,212,194,0.12)', paddingTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {nl.status === 'draft' && <button onClick={() => act('submit', t('Submitted for approval.', 'Đã gửi để duyệt.'))} disabled={busy === 'submit'} style={gold}>{t('Submit for approval', 'Gửi để duyệt')}</button>}
        {nl.status === 'pending_approval' && <>
          <button onClick={() => act('approve', t('Approved.', 'Đã duyệt.'))} disabled={busy === 'approve'} style={gold}>{t('Approve', 'Duyệt')}</button>
          <button onClick={() => act('revert', t('Back to draft.', 'Trở lại nháp.'))} disabled={busy === 'revert'} style={btn}>{t('Revert to draft', 'Trả về nháp')}</button>
        </>}
        {nl.status === 'approved' && <>
          <button onClick={previewPost} style={btn}>{t('Preview email ↗', 'Xem trước ↗')}</button>
          <button onClick={testSend} disabled={busy === 'test'} style={btn}>{t('Send a test', 'Gửi thử')}</button>
          <button onClick={() => setConfirmSend(true)} style={{ ...gold, background: sendEnabled ? '#D4B85A' : 'rgba(212,184,90,0.3)' }}>{t('Send to all members', 'Gửi đến tất cả hội viên')}</button>
          <button onClick={() => act('revert', t('Back to draft.', 'Trở lại nháp.'))} disabled={busy === 'revert'} style={btn}>{t('Revert', 'Trả về')}</button>
        </>}
        {nl.status === 'sent' && <span style={{ fontFamily: MONO, fontSize: 12, color: '#D4B85A' }}>✓ {t('Sent to', 'Đã gửi đến')} {nl.recipient_count} {t('members', 'hội viên')}</span>}
      </div>

      {/* Live-send confirmation */}
      {confirmSend && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setConfirmSend(false)} />
          <div style={{ position: 'relative', width: 'min(460px,94vw)', background: '#0A3526', border: '1px solid rgba(212,184,90,0.3)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', margin: '0 0 8px' }}>{t('Send to all members?', 'Gửi đến tất cả hội viên?')}</h2>
            {!sendEnabled && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 10 }}>{t('The master send switch is OFF — turn it on in Settings first.', 'Công tắc gửi chính đang TẮT — hãy bật trong Cài đặt trước.')}</div>}
            <p style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.6, margin: '0 0 12px' }}>
              {t('This emails', 'Thao tác này gửi email đến')} <strong style={{ color: '#E5D4C2' }}>{recipientCount}</strong> {t('members. This cannot be undone. Type', 'hội viên. Không thể hoàn tác. Nhập')} <strong style={{ color: '#D4B85A' }}>SEND-ALL-{recipientCount}</strong> {t('to confirm.', 'để xác nhận.')}
            </p>
            <input style={{ ...input, marginBottom: 14 }} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={`SEND-ALL-${recipientCount}`} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmSend(false)} style={btn}>{t('Cancel', 'Huỷ')}</button>
              <button onClick={liveSend} disabled={busy === 'send' || confirmText.trim() !== `SEND-ALL-${recipientCount}`} style={{ ...gold, opacity: confirmText.trim() === `SEND-ALL-${recipientCount}` ? 1 : 0.4 }}>{busy === 'send' ? t('Sending…', 'Đang gửi…') : t('Confirm & send', 'Xác nhận & gửi')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
