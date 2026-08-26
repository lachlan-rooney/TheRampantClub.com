'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

// The staff Concierge inbox. Left: every member↔Club thread, awaiting-first, each
// with its RESPONSE AGE (the ops-honesty signal — nothing rots silently). Right:
// the conversation + reply, with the member's dossier a click away. Replies go
// through the shared /api/social/messages route (staff branch); the member only
// ever sees "The Club".

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Row { thread_id: string; member_no: string | null; member_name: string; last_preview: string; last_at: string | null; awaiting: boolean; awaiting_since: string | null }
interface Msg { id: string; sender: string; body: string; created_at: string; from_member: boolean }

function waited(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function ConciergeInbox() {
  const { t } = useLang()
  const [rows, setRows] = useState<Row[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [member, setMember] = useState<{ member_no: string | null; name: string } | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    const r = await fetch('/api/admin/concierge')
    if (r.ok) setRows((await r.json()).threads || [])
  }, [])

  const loadThread = useCallback(async (id: string) => {
    const r = await fetch(`/api/admin/concierge/${id}`)
    if (r.ok) { const j = await r.json(); setMember(j.member); setMessages(j.messages || []) }
  }, [])

  useEffect(() => { loadList(); const t = setInterval(loadList, 30000); return () => clearInterval(t) }, [loadList])
  useEffect(() => { if (sel) loadThread(sel) }, [sel, loadThread])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length])

  const reply = useCallback(async () => {
    const text = draft.trim()
    if (!text || !sel || sending) return
    setSending(true); setErr('')
    try {
      const res = await fetch('/api/social/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: sel, body: text }),
      })
      if (res.ok) { setDraft(''); await loadThread(sel); await loadList() }
      else setErr((await res.json().catch(() => ({})))?.error || 'Could not send.')
    } finally { setSending(false) }
  }, [draft, sel, sending, loadThread, loadList])

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply() } }
  const awaitingCount = rows.filter(r => r.awaiting).length

  return (
    <div>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('The Concierge', 'Quản Gia')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 24, letterSpacing: '0.04em' }}>
        {awaitingCount > 0 ? `${awaitingCount} ${t('awaiting a reply', 'đang chờ phản hồi')}` : t('All caught up', 'Đã xử lý hết')} · {t('members only ever see “The Club”', 'hội viên chỉ thấy “The Club”')}
      </p>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* List */}
        <div style={listWrap}>
          {rows.length === 0 ? (
            <div style={{ ...muted, padding: 24 }}>{t('No conversations yet.', 'Chưa có cuộc trò chuyện nào.')}</div>
          ) : rows.map(r => (
            <button key={r.thread_id} onClick={() => setSel(r.thread_id)} style={{ ...rowBtn, ...(sel === r.thread_id ? rowActive : null) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{r.member_name}</span>
                {r.awaiting && <span style={ageBadge}>{waited(r.awaiting_since)} {t('waiting', 'đang chờ')}</span>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', margin: '2px 0 5px' }}>
                {r.member_no ? `#${r.member_no.replace(/^TRC-M/i, '')}` : '—'}
              </div>
              <div style={preview}>{r.last_preview || '—'}</div>
            </button>
          ))}
        </div>

        {/* Conversation */}
        <div style={convWrap}>
          {!sel ? (
            <div style={{ ...muted, padding: 40, textAlign: 'center' }}>{t('Select a conversation.', 'Chọn một cuộc trò chuyện.')}</div>
          ) : (
            <>
              <div style={convHeader}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>{member?.name || t('Member', 'Hội viên')}</span>
                {member?.member_no && (
                  <Link href={`/admin/mis/${member.member_no}`} style={dossierLink}>{t('Open dossier →', 'Mở hồ sơ →')}</Link>
                )}
              </div>
              <div ref={scrollRef} style={convScroll}>
                {messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.from_member ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
                    <div style={m.from_member ? bubbleMember : bubbleClub}>
                      <div style={{ ...senderLabel, color: m.from_member ? '#B2AA98' : '#D4B85A' }}>{m.from_member ? (member?.name || t('Member', 'Hội viên')) : 'The Club'}</div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                      <div style={stamp}>{time(m.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={composer}>
                {err && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 6 }}>{err}</div>}
                <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 4000))} onKeyDown={onKey} rows={2} placeholder={t('Reply as The Club…', 'Trả lời với tư cách The Club…')} style={textarea} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={reply} disabled={sending || !draft.trim()} style={{ ...sendBtn, opacity: sending || !draft.trim() ? 0.4 : 1 }}>{sending ? t('Sending…', 'Đang gửi…') : t('Send as The Club', 'Gửi với tư cách The Club')}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const listWrap: React.CSSProperties = { width: 320, flexShrink: 0, border: '1px solid rgba(229,212,194,0.10)', borderRadius: 12, overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }
const rowBtn: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(229,212,194,0.06)', padding: '12px 14px', cursor: 'pointer' }
const rowActive: React.CSSProperties = { background: 'rgba(212,184,90,0.10)' }
const ageBadge: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#052E20', background: '#C27070', padding: '1px 7px', borderRadius: 8, fontWeight: 700, flexShrink: 0 }
const preview: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const convWrap: React.CSSProperties = { flex: 1, minWidth: 0, border: '1px solid rgba(229,212,194,0.10)', borderRadius: 12, display: 'flex', flexDirection: 'column', minHeight: '70vh', maxHeight: '70vh' }
const convHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(229,212,194,0.08)' }
const dossierLink: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#D4B85A', textDecoration: 'none', letterSpacing: '0.04em' }
const convScroll: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '18px 16px' }
const composer: React.CSSProperties = { borderTop: '1px solid rgba(229,212,194,0.08)', padding: '12px 14px' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.55, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const sendBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const bubbleMember: React.CSSProperties = { maxWidth: '78%', background: 'rgba(229,212,194,0.07)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: '4px 12px 12px 12px', padding: '9px 12px', fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.5 }
const bubbleClub: React.CSSProperties = { maxWidth: '78%', background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.26)', borderRadius: '12px 4px 12px 12px', padding: '9px 12px', fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.5 }
const senderLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }
const stamp: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#B2AA98', opacity: 0.5, marginTop: 5 }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
