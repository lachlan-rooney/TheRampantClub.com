'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// THE EVENT BOARD — the idle state, and the only way into either other mode.
// No identity, no PII. Everything shown comes from kiosk_board(), which returns a
// fixed set of non-PII columns; this page cannot render a member name because it
// is never sent one.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GROUND = '#052E20'

interface Board {
  room: string; state: 'no_event' | 'arrival' | 'live' | 'wind_down'
  title: string | null; title_vn: string | null
  note: string | null; note_vn: string | null
  starts_at: string | null; ends_at: string | null
  next_transition_at: string | null; now_at: string
}
type Nfc = 'idle' | 'scanning' | 'gesture' | 'unsupported' | 'denied'

const hhmm = (iso: string | null) => iso
  ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
  : ''

export default function KioskBoard() {
  const router = useRouter()
  const [b, setB] = useState<Board | null>(null)
  const [clock, setClock] = useState('')
  const [nfc, setNfc] = useState<Nfc>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanning = useRef(false)

  // ── the board itself ────────────────────────────────────────────────────
  // Re-fetch at next_transition_at, so a tablet left on for days advances with no
  // reload and no client-side state to go stale. Capped at 5 min so a long quiet
  // stretch still refreshes, floored at 5s so a just-passed transition can't spin.
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/kiosk/board', { cache: 'no-store' })
      const j = await r.json()
      setB(j.board || null)
      const next = j.board?.next_transition_at ? +new Date(j.board.next_transition_at) - Date.now() : 60_000
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(load, Math.min(Math.max(next + 1000, 5_000), 300_000))
    } catch {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(load, 30_000)
    }
  }, [])
  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current) } }, [load])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', hour12: false }))
    tick(); const i = setInterval(tick, 20_000); return () => clearInterval(i)
  }, [])

  // ── the card tap ────────────────────────────────────────────────────────
  const onTap = useCallback(async (uid: string) => {
    try {
      const r = await fetch('/api/kiosk/member/identify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }),
      })
      const j = await r.json()
      if (!j.found) return
      // The first name goes through sessionStorage, not the URL — a name in the
      // address bar would sit in history long after the member has walked away.
      sessionStorage.setItem('trc_kiosk_tap', JSON.stringify({ member_no: j.member_no, first_name: j.first_name, has_pin: j.has_pin }))
      router.push('/kiosk/member')
    } catch { /* silent — the board is not a place for error text */ }
  }, [router])

  const startNfc = useCallback(async () => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) { setNfc('unsupported'); return false }
    try {
      // @ts-expect-error — Web NFC types vary by TS lib version
      const reader = new window.NDEFReader()
      await reader.scan()
      scanning.current = true
      setNfc('scanning')
      reader.addEventListener('reading', (e: { serialNumber?: string }) => {
        const uid = e.serialNumber?.toUpperCase().replace(/:/g, '') || ''
        if (uid) onTap(uid)
      })
      return true
    } catch (e) {
      scanning.current = false
      const msg = (e as Error)?.message || ''
      setNfc(/denied|not allowed/i.test(msg) ? 'denied' : 'gesture')
      return false
    }
  }, [onTap])

  // scan() needs a user gesture — and an idle board can sit untouched for DAYS, so
  // the first card of the evening may arrive with no prior touch. Three mitigations:
  //   1. if the NFC permission is already granted, scan immediately, no gesture
  //   2. otherwise arm a gesture listener that RE-ARMS if scan() throws (the Phase 1
  //      listener was {once:true} and removed itself before scan() was known to work)
  //   3. retry on every board poll while not scanning
  // Until it is really scanning the copy says so; the board never claims to be
  // listening when it is not.
  const arm = useCallback(() => {
    const go = async () => {
      const ok = await startNfc()
      if (!ok) { document.addEventListener('pointerdown', go, { once: true }) }  // re-arm
    }
    document.addEventListener('pointerdown', go, { once: true })
  }, [startNfc])

  useEffect(() => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) { setNfc('unsupported'); return }
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions
    perms?.query({ name: 'nfc' as PermissionName })
      .then(p => { if (p.state === 'granted') startNfc(); else arm() })
      .catch(() => arm())
  }, [startNfc, arm])

  useEffect(() => {
    if (!b) return
    if (!scanning.current && nfc !== 'unsupported' && nfc !== 'denied') { startNfc() }
  }, [b, nfc, startNfc])

  const s = b?.state ?? 'no_event'
  const eyebrow = s === 'arrival' ? ['Doors are open', 'Cửa đã mở']
    : s === 'live' ? ['This evening', 'Tối nay']
    : s === 'wind_down' ? ['Drawing to a close', 'Sắp kết thúc'] : null

  return (
    <div style={{ minHeight: '100vh', background: GROUND, color: INK, display: 'flex', flexDirection: 'column', padding: '5vh 6vw', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: MONO, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(229,212,194,.55)' }}>
        <span>{b?.room ?? ''}</span><span>{clock}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {s === 'no_event' ? (
          <>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(30px,5vw,58px)', lineHeight: 1.15 }}>The room is yours</div>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2.6vw,30px)', color: 'rgba(229,212,194,.5)', marginTop: 6 }}>Căn phòng là của bạn</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: 'rgba(229,212,194,.45)', marginTop: 22, maxWidth: 620, lineHeight: 1.7 }}>
              Nothing scheduled here tonight. Speak to the team for anything at all.
            </div>
          </>
        ) : (
          <>
            {eyebrow && (
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', color: '#D4B85A', marginBottom: 14 }}>
                {eyebrow[0]} <span style={{ color: 'rgba(229,212,194,.4)' }}>· {eyebrow[1]}</span>
              </div>
            )}
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(32px,5.4vw,64px)', lineHeight: 1.12 }}>{b?.title}</div>
            {b?.title_vn && <div style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2.6vw,30px)', color: 'rgba(229,212,194,.5)', marginTop: 6 }}>{b.title_vn}</div>}
            <div style={{ fontFamily: MONO, fontSize: 15, color: 'rgba(229,212,194,.7)', marginTop: 20 }}>
              {hhmm(b?.starts_at ?? null)}{b?.ends_at ? ` — ${hhmm(b.ends_at)}` : ''}
            </div>
            {b?.note && <div style={{ fontFamily: SERIF, fontSize: 'clamp(16px,1.9vw,22px)', color: 'rgba(229,212,194,.85)', marginTop: 26, maxWidth: 780, lineHeight: 1.5 }}>{b.note}</div>}
            {b?.note_vn && <div style={{ fontFamily: SERIF, fontSize: 'clamp(14px,1.6vw,18px)', color: 'rgba(229,212,194,.45)', marginTop: 8, maxWidth: 780, lineHeight: 1.6 }}>{b.note_vn}</div>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(229,212,194,.6)', lineHeight: 1.7 }}>
          {nfc === 'scanning' ? (
            <>Hold your member card to the tablet<br /><span style={{ color: 'rgba(229,212,194,.35)' }}>Chạm thẻ hội viên vào máy</span></>
          ) : nfc === 'unsupported' ? (
            <button onClick={() => router.push('/kiosk/member')} style={linkBtn}>Enter your membership number</button>
          ) : nfc === 'denied' ? (
            <button onClick={() => router.push('/kiosk/member')} style={linkBtn}>Enter your membership number</button>
          ) : (
            // Honest: it is NOT listening yet, and says so rather than implying it is.
            <>Touch the screen to begin<br /><span style={{ color: 'rgba(229,212,194,.35)' }}>Chạm màn hình để bắt đầu</span></>
          )}
        </div>
        <button onClick={() => router.push('/kiosk/staff')} style={{ ...linkBtn, fontSize: 11, opacity: .4 }}>Staff</button>
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(229,212,194,.6)', fontFamily: MONO,
  fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0,
}
