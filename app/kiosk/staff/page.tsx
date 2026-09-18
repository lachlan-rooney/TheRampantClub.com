'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/lang'

// The gated kiosk shell (device session already verified by middleware). Layer 2:
// the staff picker (attribution). Tap your name → PIN → you're the acting staff.
// Auto-logout on inactivity drops back to the picker so a tablet left on the bar
// never sits on member data. Phase 1 ships the secure shell; the Ritual floor
// surfaces (Overture brief, Accord capture) land in Phase 2.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const IDLE_MS = 180_000   // 3 min idle → back to the picker

interface Staff { id: string; display_name: string; role_title?: string | null }

export default function KioskStaff() {
  const { t } = useLang()
  const [me, setMe] = useState<Staff | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [roster, setRoster] = useState<Staff[]>([])
  const [picking, setPicking] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
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
      <div style={{ width: 'min(760px, 100%)', margin: '0 auto' }}>
        <div style={kicker}>The Rampant Club · Floor</div>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 28, color: '#E5D4C2', margin: '12px 0 26px' }}>
          {t('Good evening', 'Chào buổi tối')}, {me.display_name}.
        </div>

        <div style={procHead}>{t('Taking a food order', 'Quy trình nhận đơn món ăn')}</div>
        <ol style={steps}>
          {[
            [t('Take the order from the guest — work from the choices they confirmed on the tablet, not from memory.',
               'Nhận yêu cầu từ khách — theo đúng các món khách đã xác nhận trên máy tính bảng, không dựa vào trí nhớ.')],
            [t('Order from the restaurant on Zalo, or call them.',
               'Đặt món với nhà hàng qua Zalo, hoặc gọi điện.')],
            [t('Collect it — or ask Miss Lan to go for it.',
               'Đi lấy món — hoặc nhờ chị Lan đi lấy giúp.')],
            [t('Pay with the Silver credit card (Rượu Ngon). Get the red invoice using our company details.',
               'Thanh toán bằng thẻ tín dụng Silver (Rượu Ngon). Lấy hoá đơn đỏ theo thông tin công ty.')],
            [t('Plate it up nicely in the kitchen.',
               'Bày biện món ăn đẹp mắt tại bếp.')],
            [t('Present it to the member.',
               'Phục vụ khách.')],
            [t('Miss Châu invoices them next week. Nothing is paid at the table.',
               'Chị Châu sẽ xuất hoá đơn vào tuần sau. Khách không thanh toán tại bàn.')],
          ].map(([line], i) => (
            <li key={i} style={step}>
              <span style={stepNo}>{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>

        <div style={noteBox}>
          <div style={noteLine}>
            <b style={noteB}>{t('Do not add anything to the price.', 'Không cộng thêm gì vào giá.')}</b>{' '}
            {t('The club’s 20% is already built into what the tablet shows.',
               'Giá hiển thị trên máy tính bảng đã bao gồm 20% của câu lạc bộ.')}
          </div>
          <div style={noteLine}>
            <b style={noteB}>{t('The 100,000₫ plating fee is per head, and only if they bring their own food.',
                                 'Phí bày biện 100.000₫/người, chỉ áp dụng khi khách mang đồ ăn riêng.')}</b>{' '}
            {t('A member who orders through us does not pay it.',
               'Khách đặt món qua câu lạc bộ thì không phải trả phí này.')}
          </div>
          <div style={{ ...noteLine, opacity: .6 }}>
            {t('This process is being refined next week.', 'Quy trình sẽ được hoàn thiện vào tuần sau.')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
          <button onClick={logout} style={switchBtn}>{t('I’m done · switch user', 'Xong · đổi người')}</button>
          {/* The hand-back. Exiting staff mode returns the tablet to the BOARD,
              which is where a member picks it up. */}
          <button onClick={async () => { await fetch('/api/kiosk/staff/logout', { method: 'POST' }); window.location.href = '/kiosk/board' }} style={boardBtn}>
            {t('Hand over · back to the board', 'Bàn giao · về màn hình chính')}
          </button>
        </div>
        <div style={shellNote}>{t('Staff only. Do not leave this screen open on the floor.',
                                   'Chỉ dành cho nhân viên. Không để màn hình này mở trên sàn.')}</div>
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
