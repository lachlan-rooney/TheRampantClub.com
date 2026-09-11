'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import { useLang } from '@/lib/lang'

// Introductions. Incoming: requests addressed to me (name + palate + context) with
// a gracious accept / a quiet decline (one tap, no drama). Sent: my own requests —
// always shown as 'pending' until accepted (a decline is masked, by design; the
// requester is never told no).

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Incoming { id: string; via: string; from_name?: string; from_sig?: string; context?: string | null; match_pct?: number; shared_note?: string; created_at: string }
interface Sent { id: string; via: string; to_name: string | null; status: string; context?: string | null; created_at: string }

export default function Introductions() {
  const { t, lang } = useLang()
  const [incoming, setIncoming] = useState<Incoming[]>([])
  const [sent, setSent] = useState<Sent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/social/introductions')
    if (r.ok) { const j = await r.json(); setIncoming(j.incoming || []); setSent(j.sent || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const act = useCallback(async (id: string, action: 'accept' | 'decline') => {
    setBusy(id)
    try {
      await fetch(`/api/social/introductions/${id}/${action}`, { method: 'POST' })
      await load()
    } finally { setBusy(null) }
  }, [load])

  return (
    <MemberPage title="Introductions" subtitle="LỜI GIỚI THIỆU" description={t('The club makes the introduction — you decide. A decline is quiet; no one is ever told no.', 'Câu lạc bộ đứng ra giới thiệu — quyết định là ở bạn. Lời từ chối luôn kín đáo; không ai phải nghe một lời “không”.')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {loading ? (
        <p className="in-quiet">{t('Reading the room…', 'Đang xem qua…')}</p>
      ) : (
        <div className="in-grid">
          {/* ── Addressed to you: the decision is yours ─────────────────── */}
          <section>
            <h2 className="in-h2">{t('Awaiting your word', 'Chờ bạn hồi đáp')}</h2>
            {incoming.length === 0 ? (
              <p className="in-quiet">{t('No introductions awaiting you just now.', 'Hiện chưa có lời giới thiệu nào chờ bạn.')}</p>
            ) : (
              <div className="in-list">
                {incoming.map(i => (
                  <div key={i.id} className="in-row">
                    {i.via === 'palate_match' ? (
                      <>
                        <div className="in-match">
                          <span className="in-pct">{i.match_pct}%</span>
                          <span className="in-pct-l">{t('palate match', 'hợp khẩu vị')}</span>
                        </div>
                        <p className="in-text">
                          {lang === 'vn'
                            ? <>Một hội viên có khẩu vị giống bạn {i.match_pct}% muốn được làm quen — hai bạn cùng thích {i.shared_note}. Chấp nhận để biết đó là ai.</>
                            : <>A member whose palate is {i.match_pct}% yours would like to meet — you share {i.shared_note}. Accept to see who.</>}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="in-name">{i.from_name}</div>
                        <div className="in-sig">{i.from_sig}</div>
                        {i.context && <p className="in-context">“{i.context}”</p>}
                      </>
                    )}
                    <div className="in-actions">
                      <button onClick={() => act(i.id, 'accept')} disabled={busy === i.id} className="pk-cta in-cta">
                        {t('Accept · open a thread', 'Chấp nhận · mở trò chuyện')} <span className="pk-go">→</span>
                      </button>
                      <button onClick={() => act(i.id, 'decline')} disabled={busy === i.id} className="in-quietbtn">{t('Not now', 'Để sau')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── What you asked for: always "pending" until it isn't ─────── */}
          <section>
            <h2 className="in-h2">{t('Your requests', 'Yêu cầu của bạn')}</h2>
            {sent.length === 0 ? (
              <p className="in-quiet">{t('You haven’t requested any introductions yet — find someone in ', 'Bạn chưa đề nghị lời giới thiệu nào — hãy tìm một người trong ')}<Link href="/members/members" className="in-link">{t('the directory', 'danh bạ')}</Link>.</p>
            ) : (
              <div className="in-list">
                {sent.map(s => (
                  <div key={s.id} className="in-row is-sent">
                    <div className="in-sent-top">
                      <span className="in-sent-name">
                        {s.to_name || (s.via === 'palate_match' ? t('A palate match', 'Một người hợp khẩu vị') : t('A member', 'Một hội viên'))}
                      </span>
                      {s.status === 'accepted'
                        ? <Link href="/members/messages" className="in-connected">{t('Connected — open messages →', 'Đã kết nối — mở tin nhắn →')}</Link>
                        : <span className="in-pending">{t('Pending', 'Đang chờ')}</span>}
                    </div>
                    {s.context && <p className="in-context">“{s.context}”</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </MemberPage>
  )
}

const SERIF = "'Rampant Sans', serif"
const LINE = 'rgba(229,212,194,.18)'

const CSS = `
  .in-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 88px; align-items: start; }
  .in-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 3.4vw, 44px); line-height: 1; color: #E5D4C2; margin: 0 0 26px; }
  .in-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; max-width: 560px; margin: 0; }
  .in-link { color: #D4B85A; text-decoration: none; border-bottom: 1px solid rgba(212,184,90,.5); padding-bottom: 1px; }
  .in-link:hover { border-bottom-color: #D4B85A; }

  .in-list { border-bottom: 1px solid ${LINE}; }
  .in-row { padding: 26px 0 28px; border-top: 1px solid ${LINE}; }
  .in-match { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .in-pct { font-family: ${SERIF}; font-size: clamp(56px, 6.4vw, 88px); line-height: .9; color: #D4B85A; }
  .in-pct-l { font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #E5D4C2; opacity: .8; }
  .in-text { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .9; margin: 16px 0 0; max-width: 560px; }
  .in-name { font-family: ${SERIF}; font-size: clamp(32px, 3.8vw, 52px); line-height: .96; color: #E5D4C2; overflow-wrap: anywhere; }
  .in-sig { font-family: ${MONO}; font-size: 13.5px; line-height: 1.8; color: #D4B85A; margin-top: 10px; }
  .in-context { font-family: ${MONO}; font-size: 13.5px; line-height: 1.9; color: #E5D4C2; opacity: .85; margin: 14px 0 0; max-width: 560px; }

  .in-actions { display: flex; align-items: baseline; gap: 30px; flex-wrap: wrap; margin-top: 24px; }
  .pk-cta.in-cta { margin-top: 0; color: #D4B85A; }
  .pk-cta.in-cta:disabled, .in-quietbtn:disabled { opacity: .4; cursor: not-allowed; }
  .in-quietbtn { background: none; border: none; padding: 0 0 6px; cursor: pointer; color: #E5D4C2; opacity: .72;
                 font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; transition: opacity .2s ease; }
  .in-quietbtn:hover:not(:disabled) { opacity: 1; }

  .in-row.is-sent { padding: 22px 0 22px; }
  .in-sent-top { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; }
  .in-sent-name { font-family: ${SERIF}; font-size: clamp(24px, 2.6vw, 32px); line-height: 1.05; color: #E5D4C2; }
  .in-pending { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: #E5D4C2; opacity: .7; }
  .in-connected { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; color: #D4B85A; text-decoration: none;
                  border-bottom: 1px solid rgba(212,184,90,.5); padding-bottom: 3px; }
  .in-connected:hover { border-bottom-color: #D4B85A; }

  @media (max-width: 960px) {
    .in-grid { grid-template-columns: minmax(0, 1fr); gap: 72px; }
  }
`
