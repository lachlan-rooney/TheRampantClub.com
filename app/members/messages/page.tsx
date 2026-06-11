'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'

// Member↔member direct messages — only ever opened by an accepted introduction.
// Reuses the concierge thread feel. A member can block the other party (the thread
// severs for both, proven). The standing promise, stated: staff never read these.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface ThreadRow { thread_id: string; other_name: string; last_preview: string; last_at: string | null; unread: number }
interface Msg { id: string; sender: string; body: string; created_at: string; mine: boolean }
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function Messages() {
  const search = useSearchParams()
  const [threads, setThreads] = useState<ThreadRow[]>([])
  const [blocked, setBlocked] = useState<{ id: string; name: string }[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [other, setOther] = useState<{ id: string | null; name: string }>({ id: null, name: '' })
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    const r = await fetch('/api/social/dm')
    if (r.ok) { const j = await r.json(); setThreads(j.threads || []); setBlocked(j.blocked || []) }
    setLoaded(true)
  }, [])
  const loadThread = useCallback(async (id: string) => {
    const r = await fetch(`/api/social/dm/${id}`)
    if (r.ok) { const j = await r.json(); setOther({ id: j.other_id, name: j.other_name }); setMessages(j.messages || []) }
    else { setSel(null); loadList() }   // severed/gone
  }, [loadList])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { const t = search.get('t'); if (t) setSel(t) }, [search])
  useEffect(() => { if (sel) loadThread(sel) }, [sel, loadThread])
  useEffect(() => {
    if (!sel) return
    const t = setInterval(() => loadThread(sel), 30000)
    return () => clearInterval(t)
  }, [sel, loadThread])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || !sel || sending) return
    setSending(true); setErr('')
    try {
      const r = await fetch('/api/social/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_id: sel, body: text }) })
      if (r.ok) { setDraft(''); await loadThread(sel); await loadList() }
      else setErr((await r.json().catch(() => ({})))?.error || 'Could not send.')
    } finally { setSending(false) }
  }, [draft, sel, sending, loadThread, loadList])

  const block = useCallback(async () => {
    if (!other.id || !window.confirm('Block this member? Your shared conversation closes for both of you.')) return
    await fetch('/api/social/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: other.id, block: true }) })
    setSel(null); setMessages([]); await loadList()
  }, [other, loadList])

  const unblock = useCallback(async (id: string) => {
    await fetch('/api/social/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: id, block: false }) })
    await loadList()
  }, [loadList])

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <MemberPage title="Messages" subtitle="TIN NHẮN" description="Private conversations, opened by an introduction. Staff see that introductions happen — they never read your messages.">
      {!sel ? (
        <>
          {!loaded ? (
            <p style={muted}>Gathering your conversations…</p>
          ) : threads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={muted}>No conversations yet. They begin with an <Link href="/members/members" style={link}>introduction</Link>.</p>
            </div>
          ) : threads.map(t => (
            <button key={t.thread_id} onClick={() => setSel(t.thread_id)} style={listRow}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>{t.other_name}</span>
                {t.unread > 0 && <span style={unreadDot}>{t.unread}</span>}
              </div>
              <div style={preview}>{t.last_preview || '—'}</div>
            </button>
          ))}

          {blocked.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={sectionLabel}>Blocked</div>
              {blocked.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(229,212,194,0.06)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98' }}>{b.name}</span>
                  <button onClick={() => unblock(b.id)} style={unblockBtn}>Unblock</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={threadHeader}>
            <button onClick={() => setSel(null)} style={backBtn}>← All messages</button>
            <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>{other.name}</span>
            <button onClick={block} style={blockBtn}>Block</button>
          </div>
          <div style={panel}>
            <div ref={scrollRef} style={scroll}>
              {messages.length === 0 ? (
                <div style={{ ...muted, textAlign: 'center', padding: '24px 0' }}>The introduction’s made — say hello.</div>
              ) : messages.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <div style={m.mine ? bubbleMine : bubbleOther}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                    <div style={{ ...stamp, textAlign: m.mine ? 'right' : 'left' }}>{timeOf(m.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={composer}>
              {err && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 6 }}>{err}</div>}
              <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 4000))} onKeyDown={onKey} rows={2} placeholder={`Message ${other.name}…`} style={textarea} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={send} disabled={sending || !draft.trim()} style={{ ...sendBtn, opacity: sending || !draft.trim() ? 0.4 : 1 }}>{sending ? 'Sending…' : 'Send'}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </MemberPage>
  )
}

export default function MessagesPage() {
  return <Suspense fallback={null}><Messages /></Suspense>
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.75, lineHeight: 1.7 }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
const listRow: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', marginBottom: 8 }
const unreadDot: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#052E20', background: '#D4B85A', borderRadius: 8, padding: '1px 7px', fontWeight: 700 }
const preview: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: 0.8, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7E7864', marginBottom: 8 }
const unblockBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '4px 12px', fontFamily: MONO, fontSize: 10, color: '#B2AA98', cursor: 'pointer' }
const threadHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }
const backBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const blockBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(194,112,112,0.3)', borderRadius: 8, padding: '5px 12px', fontFamily: MONO, fontSize: 10, color: '#C27070', cursor: 'pointer' }
const panel: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.2)', borderRadius: 14, background: 'rgba(229,212,194,0.03)', overflow: 'hidden' }
const scroll: React.CSSProperties = { maxHeight: '52vh', minHeight: 200, overflowY: 'auto', padding: '18px 16px' }
const composer: React.CSSProperties = { borderTop: '1px solid rgba(212,184,90,0.16)', padding: '12px 14px', background: 'rgba(5,46,32,0.4)' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.55, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const sendBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 20px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const bubbleOther: React.CSSProperties = { maxWidth: '80%', background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.28)', borderRadius: '4px 12px 12px 12px', padding: '9px 12px', fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.5 }
const bubbleMine: React.CSSProperties = { maxWidth: '80%', background: 'rgba(229,212,194,0.08)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: '12px 4px 12px 12px', padding: '9px 12px', fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.5 }
const stamp: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#B2AA98', opacity: 0.5, marginTop: 5 }
