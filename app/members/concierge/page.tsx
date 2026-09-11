'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'

// The member's one persistent thread with The Club — the Guardian Angel, digitised.
// Member-side only ever shows "The Club"; a staff member's individual identity is
// never exposed here. All writes go through the S1.0 routes; this is a thin client.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Msg { id: string; sender: string; body: string; created_at: string }

function dayLabel(iso: string, lang: Lang = 'en'): string {
  const d = new Date(iso), today = new Date()
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  if (same(d, today)) return lang === 'vn' ? 'Hôm nay' : 'Today'
  if (same(d, yest)) return lang === 'vn' ? 'Hôm qua' : 'Yesterday'
  return d.toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
const timeOf = (iso: string, lang: Lang = 'en') => new Date(iso).toLocaleTimeString(lang === 'vn' ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })

function Concierge() {
  const { t, lang } = useLang()
  const search = useSearchParams()
  const [meId, setMeId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [gate, setGate] = useState<'staff' | 'unlinked' | null>(null)
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
      if (r.status === 403) { const j = await r.json().catch(() => ({})); setGate(j.reason === 'staff' ? 'staff' : 'unlinked'); return }
      if (!r.ok) { return }
      setGate(null)
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
        else {
          const j = await cr.json().catch(() => ({}))
          if (cr.status === 403) { setGate(j.reason === 'staff' ? 'staff' : 'unlinked'); return }
          setError(j.error || t('Could not open the thread.', 'Chưa mở được cuộc trò chuyện.')); return
        }
      }
      if (!tid) { setError(t('Could not open the thread.', 'Chưa mở được cuộc trò chuyện.')); return }
      const res = await fetch('/api/social/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: tid, body: text }),
      })
      if (res.ok) { setDraft(''); await load() }
      else { setError((await res.json().catch(() => ({})))?.error || t('Could not send.', 'Chưa gửi được.')) }
    } finally { setSending(false) }
  }, [draft, sending, threadId, load, t])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // group consecutive messages under a day separator
  let lastDay = ''

  return (
    <MemberPage
      title={t('The Concierge', surfaceName('/members/concierge', 'vn'))}
      subtitle={t('A LINE TO THE CLUB', 'ĐƯỜNG DÂY RIÊNG VỚI CÂU LẠC BỘ')}
      description={t("Anything at all — a request before you arrive, a bottle you're after, a word about the evening. The Club is listening.", 'Bất cứ điều gì — một yêu cầu trước khi bạn đến, một chai bạn đang tìm, đôi lời về buổi tối. Câu lạc bộ luôn lắng nghe.')}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {gate ? (
        <div className="cg-col cg-gate">
          {gate === 'staff' ? (
            <>
              <h2 className="cg-h2">{t('This is the members’ line to the Club.', 'Đây là đường dây riêng của hội viên với Câu lạc bộ.')}</h2>
              <p className="cg-quiet">{t('You’re signed in as staff — members’ messages reach you in the inbox.', 'Bạn đang đăng nhập với tư cách nhân viên — tin nhắn của hội viên sẽ đến hộp thư của bạn.')}</p>
              <Link href="/admin/concierge" className="pk-cta cg-cta">
                {t('Open the Concierge inbox →', 'Mở hộp thư Quản Gia →').replace(/\s*→$/, '')} <span className="pk-go">→</span>
              </Link>
            </>
          ) : (
            <>
              <h2 className="cg-h2">{t('Not yet available on this account.', 'Tài khoản này chưa thể sử dụng.')}</h2>
              <p className="cg-quiet">{t('Your login isn’t linked to a membership yet. A word with the Club will set it right.', 'Tài khoản đăng nhập của bạn chưa được liên kết với tư cách thành viên. Chỉ cần báo với Câu lạc bộ, chúng tôi sẽ sắp xếp ngay.')}</p>
            </>
          )}
        </div>
      ) : (
      <div className="cg-col">
        {/* The thread: the Club's voice hung from a gold rule, yours from a
            cream one at the right; the days marked in the margin of the line. */}
        <div ref={scrollRef} className="cg-scroll">
          {!loaded ? (
            <p className="cg-quiet">{t('Opening the thread…', 'Đang mở cuộc trò chuyện…')}</p>
          ) : messages.length === 0 ? (
            <div className="cg-empty">
              <h2 className="cg-h2">{t('The Club is listening.', 'Câu lạc bộ luôn lắng nghe.')}</h2>
              <p className="cg-quiet">{t('Start a note below — we read every one.', 'Hãy viết đôi dòng bên dưới — chúng tôi đọc từng tin nhắn.')}</p>
            </div>
          ) : messages.map(m => {
            const mine = m.sender === meId
            const d = dayLabel(m.created_at, lang)
            const sep = d !== lastDay; lastDay = d
            return (
              <div key={m.id}>
                {sep && <div className="cg-day"><span>{d}</span></div>}
                <div className={`cg-msg ${mine ? 'is-mine' : ''}`}>
                  {!mine && <div className="cg-club">The Club</div>}
                  <div className="cg-body">{m.body}</div>
                  <div className="cg-stamp">{timeOf(m.created_at, lang)}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="cg-composer">
          {error && <div className="cg-err">{error}</div>}
          <div className="cg-compose-row">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value.slice(0, 4000))}
              onKeyDown={onKey}
              placeholder={t('Write to The Club…', 'Viết cho Câu lạc bộ…')}
              rows={2}
              className="cg-field"
            />
            <button onClick={send} disabled={sending || !draft.trim()} className="pk-cta cg-send">
              {sending ? t('Sending…', 'Đang gửi…') : <>{t('Send', 'Gửi')} <span className="pk-go">→</span></>}
            </button>
          </div>
          <div className="cg-hint">
            {t('Enter to send · Shift+Enter for a new line', 'Enter để gửi · Shift+Enter để xuống dòng')}
          </div>
        </div>
      </div>
      )}
    </MemberPage>
  )
}

export default function ConciergePage() {
  return <Suspense fallback={null}><Concierge /></Suspense>
}

const SERIF = "'Rampant Sans', serif"
const LINE = 'rgba(229,212,194,.18)'

const CSS = `
  .cg-col { max-width: 820px; }
  .cg-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 3.6vw, 46px); line-height: 1; color: #E5D4C2; margin: 0 0 16px; }
  .cg-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; max-width: 560px; margin: 0; }
  .cg-gate { padding-top: 8px; }
  .pk-cta.cg-cta { color: #D4B85A; }

  .cg-scroll { max-height: 52vh; min-height: 220px; overflow-y: auto; padding: 28px 4px 28px 0;
               border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE};
               scrollbar-width: thin; scrollbar-color: rgba(229,212,194,.25) transparent; }
  .cg-empty { padding: 18px 0 8px; }

  .cg-day { display: flex; align-items: center; gap: 16px; margin: 6px 0 22px;
            font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #E5D4C2; }
  .cg-day span { opacity: .7; white-space: nowrap; }
  .cg-day::after { content: ''; flex: 1; height: 1px; background: ${LINE}; }

  .cg-msg { width: fit-content; max-width: 78%; margin: 0 0 22px; padding: 2px 0 2px 18px; border-left: 1px solid rgba(212,184,90,.7); }
  .cg-msg.is-mine { margin-left: auto; padding: 2px 18px 2px 0; border-left: none; border-right: 1px solid rgba(229,212,194,.4); }
  .cg-club { font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #D4B85A; margin-bottom: 6px; }
  .cg-body { font-family: ${MONO}; font-size: 14px; line-height: 1.85; color: #E5D4C2; white-space: pre-wrap; word-break: break-word; }
  .cg-stamp { font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: #E5D4C2; opacity: .6; margin-top: 6px; }
  .cg-msg.is-mine .cg-stamp { text-align: right; }

  .cg-composer { padding-top: 18px; }
  .cg-err { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #E89B9B; margin-bottom: 8px; }
  .cg-compose-row { display: flex; align-items: flex-end; gap: 28px; }
  .cg-field { flex: 1; min-width: 0; display: block; width: 100%; box-sizing: border-box; resize: vertical; background: transparent; color: #E5D4C2;
              border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0;
              font-family: ${MONO}; font-size: 14px; line-height: 1.7; outline: none; transition: border-color .25s ease; }
  .cg-field::placeholder { color: rgba(229,212,194,.5); }
  .cg-field:focus { border-bottom-color: #D4B85A; }
  /* beats the portal's keyboard ring (layout: [class*=member] textarea:focus-visible) — the gold underline is the focus mark */
  .cg-field.cg-field:focus-visible { outline: none; border-radius: 0; }
  .pk-cta.cg-send { margin: 0 0 12px; color: #D4B85A; white-space: nowrap; }
  .pk-cta.cg-send:disabled { opacity: .4; cursor: not-allowed; }
  .pk-cta.cg-send:disabled .pk-go { transform: none; }
  .cg-hint { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .02em; line-height: 1.7; color: #E5D4C2; opacity: .6; margin-top: 12px; }

  @media (max-width: 760px) {
    .cg-msg { max-width: 88%; }
    .cg-compose-row { flex-direction: column; align-items: stretch; gap: 16px; }
    .pk-cta.cg-send { align-self: flex-end; margin-bottom: 0; }
    .cg-field { font-size: 16px; }
  }
`
