'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import MemberModal from '@/components/MemberModal'
import { paletteSignature } from '@/lib/whisky/palate-signature'
import { useLang } from '@/lib/lang'

// The opt-in directory — discreet, whisky-framed. Only members who hold the
// 'discoverable' consent appear (the function gates it; an opted-out member is
// simply not returned). Each shows name + a palate signature ONLY — no contact,
// no visits, no member number. From here a member requests an introduction; the
// club hosts the rest.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Entry { member_id: string; display_name: string; vector: Record<string, number> }

export default function Directory() {
  const { t } = useLang()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [discoverable, setDiscoverable] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [target, setTarget] = useState<Entry | null>(null)
  const [context, setContext] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')

  const supabase = createBrowserSupabaseClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUid(user?.id ?? null)
    const { data } = await supabase.rpc('member_directory')
    setEntries((data as Entry[]) || [])
    const { data: c } = await supabase.from('member_consents').select('enabled').eq('feature', 'discoverable').maybeSingle()
    setDiscoverable(!!c?.enabled)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const toggleDiscoverable = async () => {
    if (!uid) return
    const next = !discoverable
    setDiscoverable(next)
    await supabase.from('member_consents').upsert({ member: uid, feature: 'discoverable', enabled: next }, { onConflict: 'member,feature' })
    load()
  }

  const request = useCallback(async () => {
    if (!target || sending) return
    setSending(true); setErr('')
    try {
      const r = await fetch('/api/social/introductions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: target.member_id, context: context.trim() || undefined }),
      })
      if (r.ok) { setSentTo(s => new Set(s).add(target.member_id)); setTarget(null); setContext('') }
      else setErr((await r.json().catch(() => ({})))?.error || t('Could not send.', 'Chưa gửi được.'))
    } finally { setSending(false) }
  }, [target, context, sending, t])

  return (
    <MemberPage title="The Members" subtitle="NHỮNG THÀNH VIÊN" description={t('Fellow members who’ve chosen to be found. A name and a palate — the club makes the introduction.', 'Những hội viên đã chọn để được tìm thấy. Một cái tên và một khẩu vị — câu lạc bộ sẽ đứng ra giới thiệu.')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Being found is a choice, stated on one line: the words, and the switch. */}
      <div className="md-opt">
        <div>
          <div className="md-opt-t">{t('Appear in the directory', 'Hiển thị trong danh bạ')}</div>
          <div className="md-opt-s">{t('Others see your name + palate only. Off by default.', 'Người khác chỉ thấy tên và khẩu vị của bạn. Mặc định tắt.')}</div>
        </div>
        <button onClick={toggleDiscoverable} className={`md-switch ${discoverable ? 'is-on' : ''}`}
                aria-pressed={discoverable} aria-label={t('Appear in the directory', 'Hiển thị trong danh bạ')}>
          <span className="md-knob" />
        </button>
      </div>

      {/* THE REGISTER — a name set large, the palate beneath it in mono, the
          introduction at the end of the line. Nothing else is ever shown. */}
      {loading ? (
        <p className="md-quiet">{t('Looking who’s about…', 'Đang xem ai có mặt…')}</p>
      ) : entries.length === 0 ? (
        <p className="md-quiet">{t('No one’s listed in the directory yet.', 'Chưa có ai trong danh bạ.')} {discoverable ? t('You’re listed — others will appear as they opt in.', 'Bạn đã có tên — những hội viên khác sẽ xuất hiện khi họ tham gia.') : t('Flip the switch above to be found.', 'Bật công tắc phía trên để được tìm thấy.')}</p>
      ) : (
        <div className="md-register">
          {entries.map(e => {
            const requested = sentTo.has(e.member_id)
            return (
              <div key={e.member_id} className="md-row">
                <div className="md-name">{e.display_name}</div>
                <div className="md-sig">{paletteSignature(e.vector)}</div>
                <button onClick={() => { setTarget(e); setContext(''); setErr('') }} disabled={requested} className="pk-cta md-cta md-ask">
                  {requested ? t('Requested', 'Đã gửi') : <>{t('Introduce me', 'Giới thiệu tôi')} <span className="pk-go">→</span></>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <MemberModal open={!!target} onClose={() => setTarget(null)} title={t('Request an introduction', 'Đề nghị được giới thiệu')} subtitle={target ? `${t('TO', 'GỬI')} ${target.display_name.toUpperCase()}` : ''}>
        {err && <div className="md-err">{err}</div>}
        <p className="md-note">
          {t('A line on why, if you like — the club passes it along. They’ll see it; you’ll simply see “pending”.', 'Đôi dòng lý do, nếu bạn muốn — câu lạc bộ sẽ chuyển lời. Họ sẽ đọc được; còn bạn sẽ chỉ thấy “đang chờ”.')}
        </p>
        <textarea value={context} onChange={e => setContext(e.target.value.slice(0, 280))} rows={3} placeholder={t('We both seem to love the sherried Speysiders…', 'Có vẻ chúng ta đều mê những chai Speyside ủ thùng sherry…')} className="md-field" />
        <div className="md-count">{context.length}/280</div>
        <div className="md-actions">
          <button onClick={() => setTarget(null)} className="md-cancel">{t('Cancel', 'Huỷ')}</button>
          <button onClick={request} disabled={sending} className="pk-cta md-cta">
            {sending ? t('Sending…', 'Đang gửi…') : <>{t('Request introduction', 'Gửi đề nghị')} <span className="pk-go">→</span></>}
          </button>
        </div>
      </MemberModal>
    </MemberPage>
  )
}

const SERIF = "'Rampant Sans', serif"
const LINE = 'rgba(229,212,194,.18)'

// The modal is portalled to <body>, outside the page, so nothing here leans on
// an ancestor for its colour — every rule names its own.
const CSS = `
  .md-opt { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: center;
            max-width: 720px; padding: 22px 0; border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE}; }
  .md-opt-t { font-family: ${SERIF}; font-size: clamp(22px, 2.4vw, 28px); line-height: 1.1; color: #E5D4C2; }
  .md-opt-s { font-family: ${MONO}; font-size: 13px; line-height: 1.8; color: #E5D4C2; opacity: .78; margin-top: 6px; }

  .md-switch { position: relative; width: 56px; height: 30px; flex: 0 0 auto; padding: 0; cursor: pointer;
               background: transparent; border: 1px solid rgba(229,212,194,.55); border-radius: 15px;
               transition: border-color .3s ease, background .3s ease; }
  .md-switch.is-on { border-color: #D4B85A; background: rgba(212,184,90,.16); }
  .md-knob { position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: #E5D4C2;
             transition: transform .4s cubic-bezier(.16,.84,.44,1), background .3s ease; }
  .md-switch.is-on .md-knob { transform: translateX(26px); background: #D4B85A; }

  .md-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; max-width: 600px; margin: 64px 0 0; }

  .md-register { margin-top: 72px; }
  .md-row { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) auto; gap: 36px; align-items: baseline;
            padding: 28px 0 26px; border-top: 1px solid ${LINE}; }
  .md-row:last-child { border-bottom: 1px solid ${LINE}; }
  .md-name { font-family: ${SERIF}; font-size: clamp(32px, 4.2vw, 56px); line-height: .96; color: #E5D4C2; overflow-wrap: anywhere; }
  .md-sig { font-family: ${MONO}; font-size: 13.5px; line-height: 1.8; color: #D4B85A; }

  .pk-cta.md-cta { margin-top: 0; color: #D4B85A; white-space: nowrap; }
  .pk-cta.md-cta:disabled { opacity: .45; cursor: not-allowed; }
  .pk-cta.md-cta:disabled .pk-go { transform: none; }
  .pk-cta.md-ask:disabled { color: #E5D4C2; opacity: .6; border-bottom-color: transparent; cursor: default; }

  .md-err { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; color: #E89B9B; margin-bottom: 10px; }
  .md-note { font-family: ${MONO}; font-size: 13px; line-height: 1.85; color: #E5D4C2; opacity: .82; margin: 0 0 8px; }
  .md-field { display: block; width: 100%; box-sizing: border-box; resize: vertical; background: transparent; color: #E5D4C2;
              border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0;
              font-family: ${MONO}; font-size: 14px; line-height: 1.75; outline: none; transition: border-color .25s ease; }
  .md-field::placeholder { color: rgba(229,212,194,.5); }
  .md-field:focus { border-bottom-color: #D4B85A; }
  /* beats the portal's keyboard ring (layout: [class*=member] textarea:focus-visible) — the gold underline is the focus mark */
  .md-field.md-field:focus-visible { outline: none; border-radius: 0; }
  .md-count { font-family: ${MONO}; font-size: 11px; color: #E5D4C2; opacity: .6; text-align: right; margin-top: 6px; }
  .md-actions { display: flex; justify-content: flex-end; align-items: baseline; gap: 28px; margin-top: 22px; flex-wrap: wrap; }
  .md-cancel { background: none; border: none; padding: 0 0 6px; cursor: pointer; color: #E5D4C2; opacity: .72;
               font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; transition: opacity .2s ease; }
  .md-cancel:hover { opacity: 1; }

  @media (max-width: 760px) {
    .md-opt { gap: 18px; }
    .md-register { margin-top: 48px; }
    .md-row { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 24px 0 22px; }
    .pk-cta.md-ask { justify-self: start; margin-top: 12px; }
    .md-field { font-size: 16px; }
  }
  @media (prefers-reduced-motion: reduce) { .md-switch, .md-knob { transition: none; } }
`
