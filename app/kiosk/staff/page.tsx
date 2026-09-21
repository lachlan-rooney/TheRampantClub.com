'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'
import ArrivalsRow from '@/components/admin/ArrivalsRow'

// The gated kiosk shell (device session already verified by middleware). Layer 2:
// the staff picker (attribution). Tap your name → PIN → you're the acting staff.
// Auto-logout on inactivity drops back to the picker so a tablet left on the bar
// never sits on member data. Phase 1 ships the secure shell; the Ritual floor
// surfaces (Overture brief, Accord capture) land in Phase 2.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const IDLE_MS = 180_000   // 3 min idle → back to the picker

interface Staff { id: string; display_name: string; role_title?: string | null }
interface OnShift { name: string; shift: string; start: string | null; end: string | null; isMe: boolean }
interface Bi { en: string; vn: string }
interface Floor {
  date: string
  onShift: OnShift[]
  process: {
    steps: Bi[]
    notes: { lead_en: string; lead_vn: string; en: string; vn: string }[]
    footnote: Bi
  }
}

export default function KioskStaff() {
  const { t } = useLang()
  const [me, setMe] = useState<Staff | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [roster, setRoster] = useState<Staff[]>([])
  const [picking, setPicking] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [floor, setFloor] = useState<Floor | null>(null)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadMe = useCallback(async () => {
    const r = await fetch('/api/kiosk/staff/me')
    if (r.ok) { const j = await r.json(); setMe(j.staff || null); if (!j.staff) loadRoster() }
    setLoaded(true)
  }, [])
  const loadRoster = async () => { const r = await fetch('/api/kiosk/staff/roster'); if (r.ok) setRoster((await r.json()).staff || []) }

  const logout = useCallback(async () => {
    await fetch('/api/kiosk/staff/logout', { method: 'POST' })
    setMe(null); setPicking(null); setPin(''); loadRoster()
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  // The rota and the process come from the server, and only once somebody has
  // signed in — the two sensitive lines are not in this page's bundle.
  useEffect(() => {
    if (!me) { setFloor(null); return }
    fetch('/api/kiosk/staff/floor', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j) setFloor(j) })
      .catch(() => {})
  }, [me])

  // Inactivity auto-logout (only while acting).
  useEffect(() => {
    if (!me) return
    const reset = () => { if (idle.current) clearTimeout(idle.current); idle.current = setTimeout(logout, IDLE_MS) }
    reset()
    const evs = ['pointerdown', 'keydown', 'touchstart']
    evs.forEach(e => window.addEventListener(e, reset))
    return () => { if (idle.current) clearTimeout(idle.current); evs.forEach(e => window.removeEventListener(e, reset)) }
  }, [me, logout])

  const submitPin = async () => {
    if (!picking || pin.length < 4) return
    const r = await fetch('/api/kiosk/staff/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: picking.id, pin }) })
    if (r.ok) { const j = await r.json(); setMe({ id: picking.id, display_name: j.name }); setPicking(null); setPin('') }
    else { setErr((await r.json().catch(() => ({})))?.error || 'Wrong PIN.'); setPin('') }
  }

  if (!loaded) return <Center><div style={muted}>…</div></Center>

  // ── Acting: the floor screen ───────────────────────────────────────────
  // This was an empty "Phase 1 secure shell". It now carries the food-order
  // process, which is the first thing a staff member actually needs from it.
  //
  // ⚠ IT IS HERE AND NOWHERE ELSE, DELIBERATELY. Two lines of it are not for
  //   members: the club's 20% margin, and which card pays for the food. This
  //   screen is behind a staff PIN and drops back to the picker after three
  //   minutes untouched, which is the only reason those lines are on a tablet
  //   that stands in a public room at all. Nothing here may be moved to the
  //   board, the menu or the members' portal.
  //
  // Bilingual, because the process names Miss Lan and the kitchen team — the
  // people who most need to read it are not the people most likely to read
  // English.
  if (me) return (
    <Scroll>
      <div style={{ width: 'min(860px, 100%)', margin: '0 auto' }}>
        <div style={kicker}>The Rampant Club · Floor</div>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 28, color: '#E5D4C2', margin: '12px 0 6px' }}>
          {t('Good evening', 'Chào buổi tối')}, {me.display_name}.
        </div>

        {/* WHO ELSE IS ON. Staff names only — no member data — so this is the
            cheapest thing on the screen to justify. */}
        {floor && floor.onShift.length > 0 && (
          <div style={onShiftRow}>
            {floor.onShift.map((o, i) => (
              <span key={i} style={{ ...onShiftPill, ...(o.isMe ? onShiftMe : null) }}>
                {o.name}
                <span style={onShiftWhen}>{o.start ? o.start.slice(0, 5) : o.shift}</span>
              </span>
            ))}
          </div>
        )}

        {/* ARRIVALS. The reason this screen is worth opening: until now a staff
            member on the floor could not mark anybody in without finding a
            laptop. Same component as the door tablet, pointed at the room
            tablet's own route. */}
        <div style={procHead}>{t('Who is in', 'Khách trong câu lạc bộ')}</div>
        <div style={{ marginTop: 14 }}>
          <ArrivalsRow endpoint="/api/kiosk/staff/arrivals" />
        </div>

        {/* The way into the stocktake. It lives here rather than in the bottom
            bar because it is a job somebody is sent to do, not a place they
            wander to — and the count needs the PIN it already asked for. */}
        <div style={{ ...procHead, marginTop: 34 }}>{t('Stocktake', 'Kiểm kê')}</div>
        <button onClick={() => { window.location.href = '/kiosk/stocktake' }} style={stockBtn}>
          {t('Count the back bar', 'Kiểm kê quầy bar')}
          <span style={stockBtnSub}>{t('search a bottle, tap its level, finish', 'tìm chai, chọn mức, kết thúc')}</span>
        </button>

        <div style={{ ...procHead, marginTop: 38 }}>{t('Taking a food order', 'Quy trình nhận đơn món ăn')}</div>
        {!floor && <div style={{ ...muted, margin: '16px 0' }}>…</div>}
        {floor && (
          <>
            <ol style={steps}>
              {floor.process.steps.map((st, i) => (
                <li key={i} style={step}>
                  <span style={stepNo}>{i + 1}</span>
                  <span>{t(st.en, st.vn)}</span>
                </li>
              ))}
            </ol>

            <div style={noteBox}>
              {floor.process.notes.map((n, i) => (
                <div key={i} style={noteLine}>
                  <b style={noteB}>{t(n.lead_en, n.lead_vn)}</b>{' '}{t(n.en, n.vn)}
                </div>
              ))}
              <div style={{ ...noteLine, opacity: .6, marginBottom: 0 }}>
                {t(floor.process.footnote.en, floor.process.footnote.vn)}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
          <button onClick={logout} style={switchBtn}>{t('I\u2019m done \u00b7 switch user', 'Xong \u00b7 \u0111\u1ed5i ng\u01b0\u1eddi')}</button>
          {/* The hand-back. Exiting staff mode returns the tablet to the BOARD,
              which is where a member picks it up. */}
          <button onClick={async () => { await fetch('/api/kiosk/staff/logout', { method: 'POST' }); window.location.href = '/kiosk/board' }} style={boardBtn}>
            {t('Hand over \u00b7 back to the board', 'B\u00e0n giao \u00b7 v\u1ec1 m\u00e0n h\u00ecnh ch\u00ednh')}
          </button>
        </div>
        <div style={shellNote}>{t('Staff only. Do not leave this screen open on the floor.',
                                   'Ch\u1ec9 d\u00e0nh cho nh\u00e2n vi\u00ean. Kh\u00f4ng \u0111\u1ec3 m\u00e0n h\u00ecnh n\u00e0y m\u1edf tr\u00ean s\u00e0n.')}</div>
      </div>
    </Scroll>
  )

  // ── PIN pad ──
  if (picking) return (
    <Center>
      <div style={{ textAlign: 'center', width: 'min(360px, 92vw)' }}>
        <button onClick={() => { setPicking(null); setPin(''); setErr('') }} style={backBtn}>← Not you?</button>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, color: '#E5D4C2', margin: '8px 0 4px' }}>{picking.display_name}</div>
        <div style={muted}>Enter your PIN</div>
        <div style={pinDots}>{[0, 1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(4, pin.length)).map(i => <span key={i} style={{ ...pinDot, background: i < pin.length ? '#D4B85A' : 'transparent' }} />)}</div>
        {err && <div style={errStyle}>{err}</div>}
        <div style={pad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => { setErr(''); setPin(p => (p + d).slice(0, 8)) }} style={key}>{d}</button>)}
          <button onClick={() => setPin(p => p.slice(0, -1))} style={key}>←</button>
          <button onClick={() => { setErr(''); setPin(p => (p + '0').slice(0, 8)) }} style={key}>0</button>
          <button onClick={submitPin} disabled={pin.length < 4} style={{ ...key, ...keyGo, opacity: pin.length < 4 ? 0.4 : 1 }}>→</button>
        </div>
      </div>
    </Center>
  )

  // ── Staff picker ──
  return (
    <Center>
      <div style={{ textAlign: 'center', width: 'min(640px, 94vw)' }}>
        <div style={kicker}>The Rampant Club · Floor</div>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', margin: '10px 0 22px' }}>Who’s on the floor?</div>
        {/* The way back is the bottom bar's Home (components/kiosk/KioskBar), on
            every screen a room tablet can reach. This picker had NO exit before it. */}
        {roster.length === 0 ? (
          <div style={muted}>No staff PINs set yet. An admin sets them in the portal.</div>
        ) : (
          <div style={grid}>
            {roster.map(s => (
              <button key={s.id} onClick={() => { setPicking(s); setErr('') }} style={nameBtn}>
                <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2' }}>{s.display_name}</div>
                {s.role_title && <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginTop: 3 }}>{s.role_title}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Center>
  )
}

/** The process is longer than a screen on a tablet, so this one scrolls rather
 *  than centring and clipping. */
function Scroll({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: 'calc(100dvh - var(--kiosk-bar, 0px))', padding: '36px 24px 40px', overflowY: 'auto' }}>{children}</div>
}

function Center({ children }: { children: React.ReactNode }) {
  // Less the bottom bar (--kiosk-bar, KioskBar), so the keypad is never under it.
  return <div style={{ minHeight: 'calc(100dvh - var(--kiosk-bar, 0px))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</div>
}

const kicker: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.8, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }
const shellNote: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#7E7864', letterSpacing: '0.06em', marginTop: 24 }
const switchBtn: React.CSSProperties = { marginTop: 28, background: 'transparent', border: '1px solid rgba(178,170,152,0.3)', borderRadius: 24, padding: '12px 28px', fontFamily: MONO, fontSize: 13, color: '#B2AA98', cursor: 'pointer' }
const boardBtn: React.CSSProperties = { display: 'block', margin: '14px auto 0', background: 'transparent', border: '1px solid rgba(229,212,194,0.28)', borderRadius: 8, padding: '10px 20px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E5D4C2', cursor: 'pointer' }
const procHead: React.CSSProperties = { fontFamily: MONO, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#D4B85A', paddingBottom: 12, borderBottom: '1px solid rgba(229,212,194,0.16)' }
const steps: React.CSSProperties = { listStyle: 'none', margin: '18px 0 0', padding: 0 }
const step: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'flex-start', padding: '11px 0', fontFamily: MONO, fontSize: 15, lineHeight: 1.65, color: '#E5D4C2' }
const stepNo: React.CSSProperties = { flex: '0 0 auto', width: 26, color: '#D4B85A', fontSize: 15 }
const noteBox: React.CSSProperties = { marginTop: 26, padding: '16px 18px', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 3 }
const noteLine: React.CSSProperties = { fontFamily: MONO, fontSize: 13, lineHeight: 1.8, color: '#E5D4C2', marginBottom: 8 }
const stockBtn: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', marginTop: 16, padding: '20px 22px', background: 'rgba(212,184,90,0.1)', border: '1px solid rgba(212,184,90,0.45)', borderRadius: 4, color: '#D4B85A', fontFamily: MONO, fontSize: 17, letterSpacing: '0.06em', cursor: 'pointer' }
const stockBtnSub: React.CSSProperties = { display: 'block', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B2AA98', marginTop: 6 }
const onShiftRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 30px' }
const onShiftPill: React.CSSProperties = { display: 'inline-flex', alignItems: 'baseline', gap: 8, padding: '6px 12px', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 20, fontFamily: MONO, fontSize: 12, color: '#B2AA98' }
const onShiftMe: React.CSSProperties = { borderColor: 'rgba(212,184,90,0.5)', color: '#D4B85A' }
const onShiftWhen: React.CSSProperties = { fontSize: 10, opacity: 0.6 }
const noteB: React.CSSProperties = { color: '#D4B85A', fontWeight: 400 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }
const nameBtn: React.CSSProperties = { padding: '24px 16px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(212,184,90,0.25)', borderRadius: 14, cursor: 'pointer' }
const backBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#B2AA98', fontFamily: MONO, fontSize: 12, cursor: 'pointer', marginBottom: 8 }
const pinDots: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 12, margin: '18px 0' }
const pinDot: React.CSSProperties = { width: 14, height: 14, borderRadius: '50%', border: '1px solid #D4B85A' }
const pad: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }
const key: React.CSSProperties = { padding: '20px 0', background: 'rgba(229,212,194,0.05)', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 12, fontFamily: MONO, fontSize: 24, color: '#E5D4C2', cursor: 'pointer' }
const keyGo: React.CSSProperties = { background: 'rgba(212,184,90,0.18)', border: '1px solid #D4B85A', color: '#D4B85A' }
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 4 }
