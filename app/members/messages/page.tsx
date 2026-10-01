'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'

// Member↔member direct messages — only ever opened by an accepted introduction.
// Reuses the concierge thread feel. A member can block the other party (the thread
// severs for both, proven). The standing promise, stated: staff never read these.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface ThreadRow { thread_id: string; other_name: string; last_preview: string; last_at: string | null; unread: number }
interface Msg { id: string; sender: string; body: string; created_at: string; mine: boolean }
const timeOf = (iso: string, lang: Lang = 'en') => new Date(iso).toLocaleTimeString(lang === 'vn' ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })

function Messages() {
  const { t, lang } = useLang()
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
      else setErr((await r.json().catch(() => ({})))?.error || t('Could not send.', 'Chưa gửi được.'))
    } finally { setSending(false) }
  }, [draft, sel, sending, loadThread, loadList, t])

  const block = useCallback(async () => {
    if (!other.id || !window.confirm(t('Block this member? Your shared conversation closes for both of you.', 'Chặn hội viên này? Cuộc trò chuyện chung sẽ đóng lại với cả hai người.'))) return
    await fetch('/api/social/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: other.id, block: true }) })
    setSel(null); setMessages([]); await loadList()
  }, [other, loadList, t])

  const unblock = useCallback(async (id: string) => {
    await fetch('/api/social/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: id, block: false }) })
    await loadList()
  }, [loadList])

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <MemberPage title="Messages" subtitle="TIN NHẮN" description={t('Private conversations, opened by an introduction. Our system flags an introduction; staff see that it happened — they never read your messages. All messages are encrypted.', 'Những cuộc trò chuyện riêng, mở ra từ một lời giới thiệu. Hệ thống ghi nhận lời giới thiệu; nhân viên biết điều đó đã xảy ra — nhưng không bao giờ đọc tin nhắn của bạn. Mọi tin nhắn đều được mã hoá.')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── WHAT "ENCRYPTED" MEANS HERE ──────────────────────────────────
          Owner, 2026-10-01: "make sure the encryption is clear, explaining
          what encryption we use too."
          Named rather than hand-waved: AES-256-GCM is a real, checkable claim
          and "bank-grade" is not. Both sentences here are true as written —
          the cipher is what it says, and staff genuinely cannot open a
          member-to-member thread, because the Concierge code is handed a
          different key and the thread does not come back as text when it asks.

          A third paragraph spelled out that this is encryption AT REST rather
          than end-to-end. The owner had it removed on 2026-10-01. Nothing left
          on this page claims end-to-end, so what remains is accurate; the
          exact boundary now lives in lib/crypto/messages.ts, where whoever
          changes this next will read it. */}
      <details className="ms-crypt">
        <summary>{t('How your messages are kept', 'Tin nhắn của bạn được bảo vệ thế nào')}</summary>
        <div className="ms-crypt-body">
          <p>
            {t('Every message is encrypted with AES-256-GCM before it is written down — the same cipher used to protect traffic on the web. Each one gets its own key material and a seal that would break if a single character were altered.',
               'Mỗi tin nhắn được mã hoá bằng AES-256-GCM trước khi được lưu — cùng loại mã hoá dùng để bảo vệ dữ liệu trên web. Mỗi tin nhắn có khoá riêng và một dấu niêm phong sẽ vỡ nếu chỉ một ký tự bị thay đổi.')}
          </p>
          <p>
            {t('Member-to-member conversations and messages to the Club are locked with two different keys. Our staff are given only the second one, so a conversation between two members does not open for them at all. They can see that an introduction was made; they cannot see what was said.',
               'Cuộc trò chuyện giữa hội viên và tin nhắn gửi tới Câu Lạc Bộ được khoá bằng hai khoá khác nhau. Nhân viên chỉ được cấp khoá thứ hai, nên cuộc trò chuyện giữa hai hội viên hoàn toàn không mở được với họ. Họ biết đã có lời giới thiệu; nhưng không biết nội dung.')}
          </p>
        </div>
      </details>

      {!sel ? (
        <div className="ms-col">
          {!loaded ? (
            <p className="ms-quiet">{t('Gathering your conversations…', 'Đang tải các cuộc trò chuyện…')}</p>
          ) : threads.length === 0 ? (
            <p className="ms-quiet">{t('No conversations yet. They begin with an ', 'Chưa có cuộc trò chuyện nào. Mọi cuộc trò chuyện bắt đầu từ một ')}<Link href="/members/members" className="ms-link">{t('introduction', 'lời giới thiệu')}</Link>.</p>
          ) : (
            <div className="ms-list">
              {threads.map(th => (
                <button key={th.thread_id} onClick={() => setSel(th.thread_id)} className="ms-row pk-hover">
                  <span className="ms-row-main">
                    <span className="ms-row-top">
                      <span className="ms-name">{th.other_name}</span>
                      {th.unread > 0 && <span className="ms-unread">{th.unread}</span>}
                    </span>
                    <span className="ms-preview">{th.last_preview || '—'}</span>
                  </span>
                  <span className="pk-go ms-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}

          {blocked.length > 0 && (
            <div className="ms-blocked">
              <h2 className="ms-h2">{t('Blocked', 'Đã chặn')}</h2>
              {blocked.map(b => (
                <div key={b.id} className="ms-brow">
                  <span className="ms-bname">{b.name}</span>
                  <button onClick={() => unblock(b.id)} className="ms-quietbtn">{t('Unblock', 'Bỏ chặn')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="ms-col">
          <button onClick={() => setSel(null)} className="ms-back">{t('← All messages', '← Tất cả tin nhắn')}</button>
          <div className="ms-head">
            <h2 className="ms-other">{other.name}</h2>
            <button onClick={block} className="ms-quietbtn is-danger">{t('Block', 'Chặn')}</button>
          </div>

          {/* The conversation: no bubbles, just two voices — theirs hung from a
              gold rule on the left, yours from a cream one on the right. */}
          <div ref={scrollRef} className="ms-scroll">
            {messages.length === 0 ? (
              <p className="ms-quiet">{t('The introduction’s made — say hello.', 'Lời giới thiệu đã xong — hãy gửi lời chào.')}</p>
            ) : messages.map(m => (
              <div key={m.id} className={`ms-msg ${m.mine ? 'is-mine' : ''}`}>
                <div className="ms-body">{m.body}</div>
                <div className="ms-stamp">{timeOf(m.created_at, lang)}</div>
              </div>
            ))}
          </div>

          <div className="ms-composer">
            {err && <div className="ms-err">{err}</div>}
            <div className="ms-compose-row">
              <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, 4000))} onKeyDown={onKey} rows={2} placeholder={`${t('Message', 'Nhắn cho')} ${other.name}…`} className="ms-field" />
              <button onClick={send} disabled={sending || !draft.trim()} className="pk-cta ms-send">
                {sending ? t('Sending…', 'Đang gửi…') : <>{t('Send', 'Gửi')} <span className="pk-go">→</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </MemberPage>
  )
}

export default function MessagesPage() {
  return <Suspense fallback={null}><Messages /></Suspense>
}

const SERIF = "'Rampant Sans', serif"
const LINE = 'rgba(229,212,194,.18)'

const CSS = `
/* The encryption note: closed by default — a promise that shouts is a promise
   nobody believes. Open it and it is specific. */
.ms-crypt { margin: 0 0 22px; border-top: 1px solid rgba(229,212,194,.12);
            border-bottom: 1px solid rgba(229,212,194,.12); }
.ms-crypt > summary { list-style: none; cursor: pointer; padding: 13px 2px;
            font-family: 'Google Sans Code', monospace; font-size: 10.5px;
            letter-spacing: .14em; text-transform: uppercase; color: rgba(229,212,194,.6); }
.ms-crypt > summary::-webkit-details-marker { display: none; }
.ms-crypt > summary::after { content: ' +'; color: #D4B85A; }
.ms-crypt[open] > summary::after { content: ' –'; }
.ms-crypt > summary:hover { color: #E5D4C2; }
.ms-crypt-body { padding: 2px 2px 16px; max-width: 62ch; }
.ms-crypt-body p { font-family: 'Google Sans Code', monospace; font-size: 11.5px;
            line-height: 1.95; color: rgba(229,212,194,.72); margin: 0 0 12px; }
.ms-crypt-fine { opacity: .62; }
@media (pointer: coarse) { .ms-crypt > summary { padding: 16px 2px; } }

  .ms-col { max-width: 820px; }
  .ms-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; max-width: 560px; margin: 0; }
  .ms-link { color: #D4B85A; text-decoration: none; border-bottom: 1px solid rgba(212,184,90,.5); padding-bottom: 1px; }
  .ms-link:hover { border-bottom-color: #D4B85A; }
  .ms-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 3vw, 36px); line-height: 1; color: #E5D4C2; margin: 0 0 18px; }

  /* the list of conversations, as a register */
  .ms-list { border-bottom: 1px solid ${LINE}; }
  .ms-row { display: flex; align-items: center; gap: 24px; width: 100%; text-align: left; cursor: pointer;
            background: none; border: none; border-top: 1px solid ${LINE}; border-radius: 0; padding: 24px 0; color: #E5D4C2; }
  .ms-row-main { display: block; flex: 1; min-width: 0; }
  .ms-row-top { display: flex; align-items: baseline; gap: 14px; }
  .ms-name { font-family: ${SERIF}; font-size: clamp(28px, 3.2vw, 40px); line-height: 1; overflow-wrap: anywhere; }
  .ms-unread { flex: 0 0 auto; font-family: ${MONO}; font-size: 11px; font-weight: 600; line-height: 1; color: #052E20;
               background: #D4B85A; border-radius: 10px; padding: 4px 8px; transform: translateY(-4px); }
  .ms-preview { display: block; font-family: ${MONO}; font-size: 13px; line-height: 1.7; opacity: .75; margin-top: 8px;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ms-arrow { font-family: ${MONO}; font-size: 16px; color: #D4B85A; }

  .ms-blocked { margin-top: 64px; }
  .ms-brow { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 0; border-top: 1px solid ${LINE}; }
  .ms-brow:last-child { border-bottom: 1px solid ${LINE}; }
  .ms-bname { font-family: ${MONO}; font-size: 14px; color: #E5D4C2; opacity: .85; }
  .ms-quietbtn { background: none; border: none; padding: 0 0 4px; cursor: pointer; color: #E5D4C2; opacity: .75;
                 font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
                 border-bottom: 1px solid rgba(229,212,194,.35); transition: opacity .2s ease, border-color .2s ease; }
  .ms-quietbtn:hover { opacity: 1; border-bottom-color: currentColor; }
  .ms-quietbtn.is-danger { color: #E89B9B; border-bottom-color: rgba(232,155,155,.4); }

  /* a single conversation */
  .ms-back { background: none; border: none; padding: 0; cursor: pointer; color: #E5D4C2; opacity: .8;
             font-family: ${MONO}; font-size: 12px; letter-spacing: .08em; transition: opacity .2s ease; }
  .ms-back:hover { opacity: 1; }
  .ms-head { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; margin: 22px 0 26px; }
  .ms-other { font-family: ${SERIF}; font-weight: 400; font-size: clamp(38px, 5vw, 64px); line-height: .95; color: #E5D4C2;
              margin: 0; min-width: 0; overflow-wrap: anywhere; }

  .ms-scroll { max-height: 52vh; min-height: 200px; overflow-y: auto; padding: 28px 4px 28px 0;
               border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE};
               scrollbar-width: thin; scrollbar-color: rgba(229,212,194,.25) transparent; }
  .ms-msg { width: fit-content; max-width: 78%; margin: 0 0 22px; padding: 2px 0 2px 18px; border-left: 1px solid rgba(212,184,90,.7); }
  .ms-msg:last-child { margin-bottom: 0; }
  .ms-msg.is-mine { margin-left: auto; padding: 2px 18px 2px 0; border-left: none; border-right: 1px solid rgba(229,212,194,.4); }
  .ms-body { font-family: ${MONO}; font-size: 14px; line-height: 1.85; color: #E5D4C2; white-space: pre-wrap; word-break: break-word; }
  .ms-stamp { font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: #E5D4C2; opacity: .6; margin-top: 6px; }
  .ms-msg.is-mine .ms-stamp { text-align: right; }

  .ms-composer { padding-top: 18px; }
  .ms-err { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #E89B9B; margin-bottom: 8px; }
  .ms-compose-row { display: flex; align-items: flex-end; gap: 28px; }
  .ms-field { flex: 1; min-width: 0; display: block; width: 100%; box-sizing: border-box; resize: vertical; background: transparent; color: #E5D4C2;
              border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0;
              font-family: ${MONO}; font-size: 14px; line-height: 1.7; outline: none; transition: border-color .25s ease; }
  .ms-field::placeholder { color: rgba(229,212,194,.5); }
  .ms-field:focus { border-bottom-color: #D4B85A; }
  /* beats the portal's keyboard ring (layout: [class*=member] textarea:focus-visible) — the gold underline is the focus mark */
  .ms-field.ms-field:focus-visible { outline: none; border-radius: 0; }
  .pk-cta.ms-send { margin: 0 0 12px; color: #D4B85A; white-space: nowrap; }
  .pk-cta.ms-send:disabled { opacity: .4; cursor: not-allowed; }
  .pk-cta.ms-send:disabled .pk-go { transform: none; }

  @media (max-width: 760px) {
    .ms-row { padding: 20px 0; gap: 16px; }
    .ms-msg { max-width: 88%; }
    .ms-compose-row { flex-direction: column; align-items: stretch; gap: 16px; }
    .pk-cta.ms-send { align-self: flex-end; margin-bottom: 0; }
    .ms-field { font-size: 16px; }
  }
`
