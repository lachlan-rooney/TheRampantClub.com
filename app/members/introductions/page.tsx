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
      {loading ? (
        <p style={muted}>{t('Reading the room…', 'Đang xem qua…')}</p>
      ) : (
        <>
          <div style={sectionLabel}>{t('Awaiting your word', 'Chờ bạn hồi đáp')}</div>
          {incoming.length === 0 ? (
            <p style={{ ...muted, marginBottom: 28 }}>{t('No introductions awaiting you just now.', 'Hiện chưa có lời giới thiệu nào chờ bạn.')}</p>
          ) : incoming.map(i => (
            <div key={i.id} style={card}>
              {i.via === 'palate_match' ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, fontWeight: 600, color: '#D4B85A' }}>{i.match_pct}%</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98' }}>{t('palate match', 'hợp khẩu vị')}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: '#E5D4C2', lineHeight: 1.6, marginTop: 6 }}>
                    {lang === 'vn'
                      ? <>Một hội viên có khẩu vị giống bạn {i.match_pct}% muốn được làm quen — hai bạn cùng thích {i.shared_note}. Chấp nhận để biết đó là ai.</>
                      : <>A member whose palate is {i.match_pct}% yours would like to meet — you share {i.shared_note}. Accept to see who.</>}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i.context ? 8 : 10 }}>
                    <div style={sigil}>{(i.from_name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>{i.from_name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: '#D4B85A', opacity: 0.85, marginTop: 2 }}>{i.from_sig}</div>
                    </div>
                  </div>
                  {i.context && <div style={contextLine}>“{i.context}”</div>}
                </>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => act(i.id, 'accept')} disabled={busy === i.id} style={acceptBtn}>{t('Accept · open a thread', 'Chấp nhận · mở trò chuyện')}</button>
                <button onClick={() => act(i.id, 'decline')} disabled={busy === i.id} style={declineBtn}>{t('Not now', 'Để sau')}</button>
              </div>
            </div>
          ))}

          <div style={{ ...sectionLabel, marginTop: 32 }}>{t('Your requests', 'Yêu cầu của bạn')}</div>
          {sent.length === 0 ? (
            <p style={muted}>{t('You haven’t requested any introductions yet — find someone in ', 'Bạn chưa đề nghị lời giới thiệu nào — hãy tìm một người trong ')}<Link href="/members/members" style={link}>{t('the directory', 'danh bạ')}</Link>.</p>
          ) : sent.map(s => (
            <div key={s.id} style={{ ...card, opacity: 0.92 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>
                  {s.to_name || (s.via === 'palate_match' ? t('A palate match', 'Một người hợp khẩu vị') : t('A member', 'Một hội viên'))}
                </span>
                {s.status === 'accepted'
                  ? <Link href="/members/messages" style={connectedPill}>{t('Connected — open messages →', 'Đã kết nối — mở tin nhắn →')}</Link>
                  : <span style={pendingPill}>{t('Pending', 'Đang chờ')}</span>}
              </div>
              {s.context && <div style={{ ...contextLine, marginTop: 6 }}>“{s.context}”</div>}
            </div>
          ))}
        </>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.75, lineHeight: 1.7 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#D4B85A', opacity: 0.8, marginBottom: 12 }
const card: React.CSSProperties = { border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: '14px 16px', marginBottom: 12 }
const sigil: React.CSSProperties = { width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(212,184,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#D4B85A', background: 'rgba(212,184,90,0.08)' }
const contextLine: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#B2AA98', fontStyle: 'italic', lineHeight: 1.6 }
const acceptBtn: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }
const declineBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 8, padding: '8px 16px', fontFamily: MONO, fontSize: 11, color: '#B2AA98', cursor: 'pointer' }
const pendingPill: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 10, padding: '3px 10px', letterSpacing: '0.04em' }
const connectedPill: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#7AB07A', textDecoration: 'none', border: '1px solid rgba(122,176,122,0.4)', borderRadius: 10, padding: '3px 10px', letterSpacing: '0.04em' }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
