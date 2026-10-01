'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// WHO THIS IS — on the floor, in the hand, mid-service.
//
// The club holds 159 recorded preferences and the people serving could not see
// one of them: the dossier lives behind /admin and floor staff have PINs, not
// logins. So a server asked a member what they liked on every visit while the
// club already knew. This is the answer to that.
//
// ── IT OPENS ON NOTHING ───────────────────────────────────────────────────
// No list of members, no recent arrivals, no "who's in" shortcut. You type a
// name you are already standing in front of. A tablet in a public room that
// shows the membership the moment it is unlocked is a different object from one
// that answers a question, and the second is the one worth having.
//
// ── IT SHOWS WHAT HELPS YOU SERVE ─────────────────────────────────────────
// Preferences, locker, last visit, card balance. Not birthday, email or phone:
// none of them helps anybody pour a drink, and this screen stands where members
// can see it. The route refuses to send them at all, so it is not a matter of
// what this component chooses to draw.
//
// ── AND IT CLOSES ITSELF ──────────────────────────────────────────────────
// Clearing on hide matters more here than anywhere else on the staff screen: a
// member's dossier must not still be sitting there when the tablet is picked up
// again. The screen's own three-minute idle logout is the backstop; this is the
// moment-to-moment one.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GOLD = '#D4B85A'

type Hit = { member_no: string; full_name: string; nickname: string | null; tier: string | null; status: string | null }
type Dossier = {
  member: { member_no: string; name: string; nickname: string | null; tier: string | null; status: string | null; member_since: string | null }
  locker: { no: string; label: string | null } | null
  last_visit: { date: string; space: string | null } | null
  card_credit_vnd: number | null
  preference_count: number
  preferences: Record<string, { name: string; detail: string | null; sub: string | null }[]>
}

const vnd = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' ₫'

export default function StaffMemberLookup() {
  const { t } = useLang()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [who, setWho] = useState<Dossier | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleared when this unmounts — the dossier does not outlive the look at it.
  useEffect(() => () => { setWho(null); setHits(null); setQ('') }, [])

  const search = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2) { setHits(null); return }
    // Typed on a tablet by somebody standing up: wait for the hand to stop
    // rather than firing a request per character.
    timer.current = setTimeout(async () => {
      setBusy(true); setErr('')
      try {
        const r = await fetch(`/api/kiosk/staff/member?q=${encodeURIComponent(text.trim())}`, { cache: 'no-store' })
        if (!r.ok) { setErr(t('Sign in with your PIN first.', 'Hãy đăng nhập bằng mã PIN trước.')); return }
        setHits((await r.json()).members || [])
      } catch { setErr(t('Could not reach the club just now.', 'Không kết nối được lúc này.')) }
      finally { setBusy(false) }
    }, 260)
  }, [t])

  const open = async (member_no: string) => {
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/kiosk/staff/member?member_no=${encodeURIComponent(member_no)}`, { cache: 'no-store' })
      if (!r.ok) { setErr(t('Could not open that.', 'Không mở được.')); return }
      setWho(await r.json()); setHits(null)
    } finally { setBusy(false) }
  }

  const back = () => { setWho(null); setQ(''); setHits(null) }

  if (who) {
    const m = who.member
    const cats = Object.entries(who.preferences)
    return (
      <div style={wrap}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <button onClick={back} style={ghost}>← {t('Another member', 'Hội viên khác')}</button>

        <div className="sm-name">{m.nickname || m.name}</div>
        {m.nickname && <div className="sm-full">{m.name}</div>}
        <div className="sm-meta">
          {[m.member_no, m.tier, m.status].filter(Boolean).join(' · ')}
        </div>

        <div className="sm-facts">
          {who.locker && <Fact label={t('Locker', 'Tủ khóa')} value={`${who.locker.no}${who.locker.label ? ` · ${who.locker.label}` : ''}`} />}
          {who.card_credit_vnd != null && <Fact label={t('On the card', 'Số dư thẻ')} value={vnd(who.card_credit_vnd)} gold />}
          {who.last_visit && <Fact label={t('Last in', 'Lần cuối')} value={`${who.last_visit.date}${who.last_visit.space ? ` · ${who.last_visit.space}` : ''}`} />}
        </div>

        {cats.length === 0 ? (
          <p className="sm-quiet">
            {t('Nothing recorded about what they like yet. Ask, and tell the desk — it is how this fills.',
               'Chưa ghi nhận sở thích nào. Hãy hỏi khách và báo lại quầy — đó là cách mục này đầy lên.')}
          </p>
        ) : (
          <>
            <div className="sm-head">{t('What they like', 'Sở thích')} · {who.preference_count}</div>
            {cats.map(([cat, rows]) => (
              <div key={cat} className="sm-cat">
                <div className="sm-cat-name">{cat}</div>
                <ul className="sm-list">
                  {rows.map((r, i) => (
                    <li key={i}>
                      <span className="sm-pref">{r.name}</span>
                      {r.sub && <span className="sm-sub">{r.sub}</span>}
                      {r.detail && <span className="sm-detail">{r.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={wrap}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <input
        value={q} autoFocus
        onChange={e => { setQ(e.target.value); search(e.target.value) }}
        placeholder={t('A name, or a member number', 'Tên, hoặc số hội viên')}
        style={input} inputMode="search"
      />
      {err && <div className="sm-err">{err}</div>}
      {busy && !hits && <p className="sm-quiet">{t('Looking…', 'Đang tìm…')}</p>}
      {hits && hits.length === 0 && q.trim().length >= 2 && (
        <p className="sm-quiet">{t('Nobody by that name.', 'Không tìm thấy ai.')}</p>
      )}
      {hits && hits.length > 0 && (
        <ul className="sm-hits">
          {hits.map(h => (
            <li key={h.member_no}>
              <button onClick={() => open(h.member_no)} className="sm-hit">
                <span className="sm-hit-name">{h.nickname || h.full_name}</span>
                <span className="sm-hit-meta">{[h.member_no, h.tier].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!q && (
        <p className="sm-quiet">
          {t('Type a name to see what the club knows — what they drink, their locker, when they were last in.',
             'Nhập tên để xem câu lạc bộ biết gì — khách uống gì, tủ khóa, lần ghé gần nhất.')}
        </p>
      )}
    </div>
  )
}

function Fact({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="sm-fact">
      <div className="sm-fact-label">{label}</div>
      <div className="sm-fact-value" style={gold ? { color: GOLD } : undefined}>{value}</div>
    </div>
  )
}

const wrap: React.CSSProperties = { marginTop: 10 }
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(229,212,194,0.06)',
  border: '1px solid rgba(229,212,194,0.2)', borderRadius: 10, color: INK,
  fontFamily: SERIF, fontSize: 20, padding: '14px 16px', outline: 'none',
}
const ghost: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(178,170,152,0.35)', borderRadius: 22,
  padding: '10px 18px', fontFamily: MONO, fontSize: 12, color: '#B2AA98', cursor: 'pointer',
  marginBottom: 18,
}

const CSS = `
.sm-err { font-family: ${MONO}; font-size: 12px; color: #C27070; margin-top: 12px; }
.sm-quiet { font-family: ${MONO}; font-size: 12px; line-height: 1.85; color: #B2AA98; opacity: .72; margin: 16px 0 0; max-width: 56ch; }

.sm-hits { list-style: none; margin: 16px 0 0; padding: 0; }
.sm-hits li { border-top: 1px solid rgba(229,212,194,.12); }
.sm-hits li:last-child { border-bottom: 1px solid rgba(229,212,194,.12); }
.sm-hit { display: block; width: 100%; text-align: left; background: none; border: none;
          cursor: pointer; padding: 15px 2px; color: inherit; -webkit-tap-highlight-color: transparent; }
.sm-hit-name { display: block; font-family: ${SERIF}; font-size: 19px; color: ${INK}; }
.sm-hit-meta { display: block; font-family: ${MONO}; font-size: 10.5px; letter-spacing: .1em;
               text-transform: uppercase; color: rgba(229,212,194,.5); margin-top: 5px; }

.sm-name { font-family: ${SERIF}; font-size: 30px; color: ${INK}; line-height: 1.15; }
.sm-full { font-family: ${MONO}; font-size: 12px; color: rgba(229,212,194,.55); margin-top: 5px; }
.sm-meta { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase;
           color: rgba(229,212,194,.5); margin-top: 9px; }

.sm-facts { display: flex; flex-wrap: wrap; gap: 26px; margin: 22px 0 6px;
            border-top: 1px solid rgba(229,212,194,.12); border-bottom: 1px solid rgba(229,212,194,.12);
            padding: 16px 0; }
.sm-fact-label { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
                 color: rgba(229,212,194,.45); }
.sm-fact-value { font-family: ${SERIF}; font-size: 18px; color: ${INK}; margin-top: 6px; }

.sm-head { font-family: ${MONO}; font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
           color: ${GOLD}; opacity: .8; margin: 26px 0 4px; }
.sm-cat { margin-top: 18px; }
.sm-cat-name { font-family: ${MONO}; font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
               color: rgba(229,212,194,.45); }
.sm-list { list-style: none; margin: 8px 0 0; padding: 0; }
.sm-list li { padding: 9px 0; border-top: 1px solid rgba(229,212,194,.08); }
.sm-pref { font-family: ${SERIF}; font-size: 16px; color: ${INK}; }
.sm-sub { font-family: ${MONO}; font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
          color: rgba(229,212,194,.4); margin-left: 9px; }
.sm-detail { display: block; font-family: ${MONO}; font-size: 11.5px; line-height: 1.75;
             color: rgba(229,212,194,.62); margin-top: 5px; max-width: 62ch; }

@media (pointer: coarse) { .sm-hit { padding: 17px 2px; } }
`
