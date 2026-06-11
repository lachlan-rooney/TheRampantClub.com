'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'

// The member's one persistent thread with The Club — the Guardian Angel, digitised.
// Member-side only ever shows "The Club"; a staff member's individual identity is
// never exposed here. All writes go through the S1.0 routes; this is a thin client.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Msg { id: string; sender: string; body: string; created_at: string }

function dayLabel(iso: string): string {
  const d = new Date(iso), today = new Date()
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  if (same(d, today)) return 'Today'
  if (same(d, yest)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function Concierge() {
  const search = useSearchParams()
  const [meId, setMeId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prefillDone = useRef(false)

  // Deep-link prefill from the Anticipation / Return cards — composed, NOT sent.
  useEffect(() => {
    if (prefillDone.current) return
    const p = search.get('prefill')
    if (p) { setDraft(p); prefillDone.current = true }
  }, [search])

  useEffect(() => {
    createBrowserSupabaseClient().auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null))
  }, [])

  const markRead = useCallback(async (tid: string) => {
    try { await fetch(`/api/social/threads/${tid}/read`, { method: 'POST' }) } catch { /* best-effort */ }
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/social/concierge')
      if (!r.ok) { setLoaded(true); return }
      const { thread, messages } = await r.json()
      setThreadId(thread?.id ?? null)
      setMessages(messages || [])
      if (thread?.id && (messages || []).length) markRead(thread.id)
    } finally { setLoaded(true) }
  }, [markRead])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [load])

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, loaded])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true); setError('')
    try {
      let tid = threadId
      if (!tid) {
        const cr = await fetch('/api/social/concierge', { method: 'POST' })
        if (cr.ok) { tid = (await cr.json()).thread_id; setThreadId(tid) }
      }
      if (!tid) { setError('Could not open the thread.'); return }
      const res = await fetch('/api/social/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: tid, body: text }),
      })
      if (res.ok) { setDraft(''); await load() }
      else { setError((await res.json().catch(() => ({})))?.error || 'Could not send.') }
    } finally { setSending(false) }
  }, [draft, sending, threadId, load])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // group consecutive messages under a day separator
  let lastDay = ''

  return (
    <MemberPage
      title="The Concierge"
      subtitle="A LINE TO THE CLUB"
      description="Anything at all — a request before you arrive, a bottle you're after, a word about the evening. The Club is listening."
    >
      <div style={panel}>
        <div ref={scrollRef} style={scroll}>
          {!loaded ? (
            <div style={muted}>Opening the thread…</div>
          ) : messages.length === 0 ? (
            <div style={emptyWrap}>
              <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginBottom: 8 }}>The Club is listening.</div>
              <div style={muted}>Start a note below — we read every one.</div>
            </div>
          ) : messages.map(m => {
            const mine = m.sender === meId
            const d = dayLabel(m.created_at)
            const sep = d !== lastDay; lastDay = d
            return (
              <div key={m.id}>
                {sep && <div style={daySep}>{d}</div>}
                <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <div style={mine ? bubbleMine : bubbleClub}>
                    {!mine && <div style={clubLabel}>The Club</div>}
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                    <div style={{ ...stamp, textAlign: mine ? 'right' : 'left' }}>{timeOf(m.created_at)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={composer}>
          {error && <div style={errStyle}>{error}</div>}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, 4000))}
            onKeyDown={onKey}
            placeholder="Write to The Club…"
            rows={2}
            style={textarea}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', opacity: 0.5 }}>
              Enter to send · Shift+Enter for a new line
            </span>
            <button onClick={send} disabled={sending || !draft.trim()} style={{ ...sendBtn, opacity: sending || !draft.trim() ? 0.4 : 1 }}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </MemberPage>
  )
}

export default function ConciergePage() {
  return <Suspense fallback={null}><Concierge /></Suspense>
}

const panel: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.20)', borderRadius: 14, background: 'rgba(229,212,194,0.03)', overflow: 'hidden' }
const scroll: React.CSSProperties = { maxHeight: '52vh', minHeight: 220, overflowY: 'auto', padding: '20px 18px' }
const composer: React.CSSProperties = { borderTop: '1px solid rgba(212,184,90,0.16)', padding: '14px 16px 16px', background: 'rgba(5,46,32,0.4)' }
const textarea: React.CSSProperties = { width: '100%', resize: 'vertical', background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 8, color: '#E5D4C2', fontFamily: MONO, fontSize: 13, lineHeight: 1.55, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const sendBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 20px', fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const bubbleClub: React.CSSProperties = { maxWidth: '80%', background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.28)', borderRadius: '4px 12px 12px 12px', padding: '10px 13px', fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.55 }
const bubbleMine: React.CSSProperties = { maxWidth: '80%', background: 'rgba(229,212,194,0.08)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: '12px 4px 12px 12px', padding: '10px 13px', fontFamily: MONO, fontSize: 13, color: '#E5D4C2', lineHeight: 1.55 }
const clubLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D4B85A', marginBottom: 4 }
const stamp: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#B2AA98', opacity: 0.5, marginTop: 5 }
const daySep: React.CSSProperties = { textAlign: 'center', fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B2AA98', opacity: 0.55, margin: '14px 0 12px' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }
const emptyWrap: React.CSSProperties = { textAlign: 'center', padding: '36px 12px' }
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 8 }
