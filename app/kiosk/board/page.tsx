'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SPACE_TO_FLOOR } from '@/lib/kiosk/floors'

// THE EVENT BOARD — the idle state, and the only way into either other mode.
// No identity. The event comes from kiosk_board(), a fixed set of non-PII columns.
// Since 2026-09-15 the board ALSO lists tonight's bookings for this room by name —
// the owner's call: the floor tablets are internal (see app/api/kiosk/board).

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
  bookings?: BoardBooking[]
}
interface BoardBooking { id: string; time: string | null; name: string; nickname: string | null; party: number | null; arrived: boolean }
const MAX_BOOKINGS = 6   // the board never scrolls; more than this collapses to "+N more"
// 'off' and 'error' exist because "touch the screen to enable card tap" was
// shown for EVERY failure (2026-09-17): NFC switched off on the tablet, a
// tablet with no NFC at all, a refused permission — all of it looked like a
// screen waiting to be touched, and touching it changed nothing.
type Nfc = 'idle' | 'scanning' | 'gesture' | 'unsupported' | 'denied' | 'off' | 'error'
interface Tap { member_no: string; first_name: string | null }

const ABANDON_MS = 15_000  // a tap-and-walk-away must not leave a name on the bar

const hhmm = (iso: string | null) => iso
  ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
  : ''

export default function KioskBoard() {
  const router = useRouter()
  const [b, setB] = useState<Board | null>(null)
  const [clock, setClock] = useState('')
  const [nfc, setNfc] = useState<Nfc>('idle')
  // What the tablet actually said, and what it actually read — both were thrown
  // away, which left "it doesn't work" with nothing behind it.
  const [nfcWhy, setNfcWhy] = useState('')
  const [unknownCard, setUnknownCard] = useState<string | null>(null)
  // The room's logo, if one has been added. Try SVG, fall back to PNG, and if
  // neither exists show nothing at all — never a broken image on a bar top.
  // See public/images/floors/README.md: drop a file in, no code change needed.
  const [logoExt, setLogoExt] = useState<'png' | 'svg' | null>('png')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanning = useRef(false)

  // ── SIGN-IN, ON THE BOARD ────────────────────────────────────────────────
  // The greeting and the keypad live here rather than behind a navigation: a card
  // tap should be answered on the screen the member is already looking at.
  const [panel, setPanel] = useState(false)
  const [tap, setTap] = useState<Tap | null>(null)
  const [num, setNum] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState('')
  const abandon = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closePanel = useCallback(() => {
    setPanel(false); setTap(null); setNum(''); setPin(''); setErr(false); setSent('')
  }, [])

  // Everything clears on abandon — the name never sits on the bar unattended.
  const bump = useCallback(() => {
    if (abandon.current) clearTimeout(abandon.current)
    abandon.current = setTimeout(closePanel, ABANDON_MS)
  }, [closePanel])
  useEffect(() => { if (panel) bump(); return () => { if (abandon.current) clearTimeout(abandon.current) } }, [panel, pin, num, bump])

  const submit = useCallback(async (code: string) => {
    if (code.length !== 6 || busy) return
    setBusy(true); setErr(false)
    const r = await fetch('/api/kiosk/member/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_no: (tap?.member_no || num).trim(), pin: code }),
    })
    setBusy(false)
    if (!r.ok) { setErr(true); setPin(''); bump(); return }
    router.push('/kiosk/member')
  }, [busy, tap, num, router, bump])

  const key = (d: string) => {
    if (d === 'del') { setPin(p => p.slice(0, -1)); setErr(false); bump(); return }
    setPin(p => {
      const next = (p + d).slice(0, 6)
      if (next.length === 6) setTimeout(() => submit(next), 60)
      return next
    })
    setErr(false); bump()
  }

  // ── the board itself ────────────────────────────────────────────────────
  // Re-fetch at next_transition_at, so a tablet left on for days advances with no
  // reload and no client-side state to go stale. Capped at 1 min (was 5) so a
  // booking made or marked arrived shows within a minute; floored at 5s so a
  // just-passed transition can't spin.
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/kiosk/board', { cache: 'no-store' })
      const j = await r.json()
      setB(j.board || null)
      const next = j.board?.next_transition_at ? +new Date(j.board.next_transition_at) - Date.now() : 60_000
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(load, Math.min(Math.max(next + 1000, 5_000), 60_000))
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
      // A card we cannot place used to do NOTHING — no greeting, no message, no
      // trace. Show what was read, so staff can say which card and we can link it.
      if (!j.found) {
        setUnknownCard(String(j.scanned || uid))
        setTimeout(() => setUnknownCard(null), 20_000)
        return
      }
      setUnknownCard(null)
      // The first name goes through sessionStorage, not the URL — a name in the
      // address bar would sit in history long after the member has walked away.
      // Answer the tap here: greet them, open the keypad, pre-fill the number.
      setTap({ member_no: j.member_no, first_name: j.first_name })
      setNum(j.member_no); setPin(''); setErr(false); setPanel(true)
    } catch { /* silent — the board is not a place for error text */ }
  }, [router])

  const startNfc = useCallback(async () => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) { setNfc('unsupported'); return false }
    try {
      // @ts-expect-error — Web NFC types vary by TS lib version
      const reader = new window.NDEFReader()
      await reader.scan()
      scanning.current = true
      setNfc('scanning'); setNfcWhy('')
      reader.addEventListener('reading', (e: { serialNumber?: string }) => {
        const uid = e.serialNumber?.toUpperCase().replace(/:/g, '') || ''
        if (uid) onTap(uid)
      })
      // A card the tablet can sense but cannot read — an older door-entry card,
      // for instance — fires this and nothing else. Silence here reads as a
      // broken tablet, so say it.
      reader.addEventListener('readingerror', () => {
        setUnknownCard('unreadable')
      })
      return true
    } catch (e) {
      scanning.current = false
      const err = e as { name?: string; message?: string }
      const name = err?.name || ''
      const msg = err?.message || ''
      // The browser distinguishes these, and each has a different answer:
      //   NotAllowedError  — permission refused, or no user gesture yet
      //   NotSupportedError— this tablet has no NFC hardware at all
      //   NotReadableError — NFC exists but is switched off in Android settings
      if (/NotSupported/i.test(name)) { setNfc('unsupported'); setNfcWhy('This device has no NFC.') }
      else if (/NotReadable/i.test(name)) { setNfc('off'); setNfcWhy('NFC is switched off in the tablet’s own settings.') }
      else if (/NotAllowed/i.test(name) || /denied|not allowed/i.test(msg)) { setNfc('denied'); setNfcWhy('Chrome refused NFC for this site.') }
      else if (name || msg) { setNfc('error'); setNfcWhy(`${name}${name && msg ? ': ' : ''}${msg}`.slice(0, 120)) }
      else setNfc('gesture')
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

  // ── A USB CARD READER IS A KEYBOARD (2026-09-18) ──────────────────────────
  // The Library Bar tablet has no NFC radio at all — Chrome answers
  // NotSupportedError, which is the hardware talking and not something code can
  // fix. But the club already owns Tagtix CK06 readers: plugged into the
  // tablet's USB-C port, one behaves as a keyboard, TYPES the card number and
  // presses Enter. That is also the number already stored against every member,
  // so it matches without conversion.
  //
  // Same buffer-and-flush as /admin/cards: characters are collected, Enter (or
  // a 250ms gap — a reader types far faster than a person) sends them. Typing
  // into a field is never captured, so the surname box and the PIN pad are
  // untouched. With no reader attached this listens and never fires.
  useEffect(() => {
    let buf = ''
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      const v = buf; buf = ''; timer = null
      if (v.length >= 4) onTap(v.toUpperCase())
    }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'Enter') { if (timer) clearTimeout(timer); flush(); return }
      if (e.key.length === 1 && /^[0-9A-Za-z]$/.test(e.key)) {
        buf += e.key
        if (timer) clearTimeout(timer)
        timer = setTimeout(flush, 250)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer) }
  }, [onTap])

  const s = b?.state ?? 'no_event'
  const eyebrow = s === 'arrival' ? ['Doors are open', 'Cửa đã mở']
    : s === 'live' ? ['This evening', 'Tối nay']
    : s === 'wind_down' ? ['Drawing to a close', 'Sắp kết thúc'] : null

  // The board fills the screen exactly, so it must take the bottom bar's height
  // off rather than let the bar sit over its buttons (--kiosk-bar, KioskBar).
  return (
    <div style={{ height: 'calc(100dvh - var(--kiosk-bar, 0px))', background: GROUND, color: INK, display: 'flex', flexDirection: 'column', padding: 'clamp(14px,3.5vh,40px) clamp(16px,6vw,64px)', overflow: 'hidden', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: MONO, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(229,212,194,.55)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {b?.room && SPACE_TO_FLOOR[b.room] && logoExt && (
            <img
              src={`/images/floors/${SPACE_TO_FLOOR[b.room]}.${logoExt}`}
              alt=""
              onError={() => setLogoExt(e => (e === 'png' ? 'svg' : null))}
              style={{ height: 'clamp(26px,5vh,52px)', width: 'auto', opacity: .92 }}
            />
          )}
          {b?.room ?? ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          {clock}
          {/* Staff used to live in this corner. They now live in the bottom bar
              (components/kiosk/KioskBar) with everything else that navigates —
              one Staff button on the screen, not two. */}
        </span>
      </div>

      {/* While the keypad is open the event yields the room it needs — the panel
          must never push itself off the bottom of a phone. */}
      <div style={{ flex: panel ? '0 1 auto' : 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        {panel ? null : s === 'no_event' ? (
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

      {/* ── TONIGHT'S BOOKINGS ─────────────────────────────────────────────
          Hidden while the keypad is open, so it never competes for the room the
          panel needs. */}
      {!panel && (b?.bookings?.length ?? 0) > 0 && (
        <div style={{ borderTop: '1px solid rgba(229,212,194,.14)', paddingTop: 'clamp(10px,2vh,18px)', flexShrink: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#D4B85A', marginBottom: 10 }}>
            Booked tonight <span style={{ color: 'rgba(229,212,194,.4)' }}>· Đặt chỗ tối nay</span>
          </div>
          {b!.bookings!.slice(0, MAX_BOOKINGS).map(k => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(12px,2.4vw,26px)', padding: '5px 0', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 15, color: 'rgba(229,212,194,.7)', minWidth: 52 }}>{k.time || '—'}</span>
              <span style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2.4vw,26px)' }}>
                {k.name}
                {k.nickname && <span style={{ color: 'rgba(229,212,194,.45)', fontSize: '.75em' }}> · {k.nickname}</span>}
              </span>
              {k.party != null && (
                <span style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(229,212,194,.55)' }}>
                  party of {k.party} <span style={{ color: 'rgba(229,212,194,.35)' }}>· {k.party} khách</span>
                </span>
              )}
              {k.arrived && (
                <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8FA37A' }}>
                  Arrived <span style={{ opacity: .6 }}>· Đã đến</span>
                </span>
              )}
            </div>
          ))}
          {b!.bookings!.length > MAX_BOOKINGS && (
            <div style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(229,212,194,.45)', marginTop: 4 }}>
              +{b!.bookings!.length - MAX_BOOKINGS} more
            </div>
          )}
        </div>
      )}

      {/* ── SIGN IN, ON THE BOARD ─────────────────────────────────────────
          Optimised for members, with the sign-in opportunity always visible. The
          card tap is a shortcut that pre-fills the number and greets them by first
          name; the button opens the same keypad for anyone without a card to hand.
          First name only, and nothing else — this panel sits open on a bar top
          while six digits are entered, in a room with other people. */}
      {!panel ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Sign-in only. The Flavour Finder and the room's menu moved to the
              bottom bar (components/kiosk/KioskBar) — they were on this row too,
              and the same button twice on one screen reads as two things. */}
          <button onClick={() => { setPanel(true); bump() }} style={primaryBtn}>Member sign in</button>
          {/* A BUTTON, NOT AN INSTRUCTION TO TOUCH THE SCREEN. Web NFC needs a
              real gesture, and "touch the screen" gave staff nowhere to press
              and no sign anything had happened (2026-09-17). */}
          {nfc !== 'scanning' && nfc !== 'unsupported' && (
            <button onClick={() => startNfc()} style={tapBtn}>Enable card tap</button>
          )}
          <div style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(229,212,194,.45)', lineHeight: 1.7, marginLeft: 4 }}>
            {nfc === 'scanning'
              ? <>or hold your card to the tablet<br /><span style={{ color: 'rgba(229,212,194,.3)' }}>hoặc chạm thẻ vào máy</span></>
              : nfcWhy
                ? <span style={{ color: '#C49555' }}>{nfcWhy}</span>
                : nfc === 'unsupported'
                  // A laptop, an iPhone, or a tablet without the hardware. Telling
                  // someone to press a button that cannot help them wastes their
                  // evening — say so instead, and leave the keypad as the way in.
                  ? <span style={{ color: '#C49555' }}>This tablet has no card reader built in — plug a USB card reader into it, or sign in with your surname and code.</span>
                  : <>press Enable card tap, then hold your card to the tablet<br /><span style={{ color: 'rgba(229,212,194,.3)' }}>nhấn bật thẻ, rồi chạm thẻ vào máy</span></>}
          </div>
          {unknownCard && (
            <div style={{ fontFamily: MONO, fontSize: 12, color: '#C49555', lineHeight: 1.7, marginLeft: 4 }}>
              {unknownCard === 'unreadable'
                ? 'A card was there but could not be read — it may be an older type this tablet cannot use.'
                : <>Card read, but not linked to a member — <span style={{ color: '#E5D4C2' }}>{unknownCard}</span></>}
            </div>
          )}
        </div>
      ) : (
        <div style={panelWrap} onPointerDown={bump}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: SERIF, fontSize: 'clamp(20px,3.4vh,38px)' }}>
              {tap?.first_name ? <>Welcome, {tap.first_name}</> : 'Member sign in'}
            </div>
            {!tap && (
              <input
                value={num} onChange={e => { setNum(e.target.value.toUpperCase()); bump() }}
                placeholder="Your surname" autoCapitalize="words"
                autoComplete="off" spellCheck={false} style={numField}
              />
            )}
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)', marginTop: 16 }}>
              {busy ? 'One moment' : 'Enter your six-digit code'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              {[0,1,2,3,4,5].map(i => (
                <div key={i} style={{ ...dot, background: i < pin.length ? '#E5D4C2' : 'transparent' }} />
              ))}
            </div>
            {err && (
              <div style={{ fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 14, lineHeight: 1.7 }}>
                That didn&rsquo;t match. Please try again.<br />
                <span style={{ color: 'rgba(229,212,194,.4)' }}>Not set a code yet? You can set one in your member portal.</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 18, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={closePanel} style={{ ...staffCorner, fontSize: 12 }}>Cancel</button>
              {/* Same answer whether or not there is a member behind it. */}
              <button
                onClick={async () => {
                  const who = (tap?.member_no || num).trim()
                  if (!who) return
                  bump()
                  const r = await fetch('/api/kiosk/member/reset', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ who }),
                  })
                  const j = await r.json().catch(() => ({}))
                  setSent(j.message || 'If that matches a member, a link has been sent.')
                }}
                style={{ ...staffCorner, fontSize: 12 }}
              >Forgot your code?</button>
            </div>
            {sent && (
              <div style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(229,212,194,.6)', marginTop: 12, lineHeight: 1.7, maxWidth: 380 }}>
                {sent}
              </div>
            )}
          </div>

          {/* The keypad. A fullscreen PWA can't rely on a soft keyboard appearing. */}
          <div style={pad}>
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button key={d} onClick={() => key(d)} style={padKey}>{d}</button>
            ))}
            <div />
            <button onClick={() => key('0')} style={padKey}>0</button>
            <button onClick={() => key('del')} style={{ ...padKey, fontSize: 20 }}>←</button>
          </div>
        </div>
      )}
    </div>
  )
}

const staffCorner: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
  color: 'rgba(229,212,194,.3)',
}
const panelWrap: React.CSSProperties = {
  display: 'flex', gap: 'clamp(16px,3.5vw,56px)', alignItems: 'center',
  flexWrap: 'wrap', justifyContent: 'space-between',
  borderTop: '1px solid rgba(229,212,194,.14)', paddingTop: 'clamp(14px,2.5vh,26px)',
  minHeight: 0,
}
const numField: React.CSSProperties = {
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.2)', borderRadius: 6,
  color: '#E5D4C2', fontFamily: MONO, fontSize: 20, letterSpacing: '.12em',
  padding: '12px 14px', marginTop: 14, width: 'min(260px, 100%)', outline: 'none',
}
const dot: React.CSSProperties = {
  width: 'clamp(12px,1.7vh,16px)', height: 'clamp(12px,1.7vh,16px)',
  borderRadius: '50%', border: '1px solid rgba(229,212,194,.45)',
}
const pad: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, clamp(58px, 19vw, 84px))',
  gap: 'clamp(7px, 1.4vh, 12px)',
}
const padKey: React.CSSProperties = {
  height: 'clamp(46px, 8.2vh, 72px)', borderRadius: 10, cursor: 'pointer',
  background: 'rgba(229,212,194,.06)', border: '1px solid rgba(229,212,194,.18)',
  color: '#E5D4C2', fontFamily: MONO, fontSize: 'clamp(18px, 3.4vh, 26px)',
}
// Outlined, beside the filled "Member sign in" — it is the second thing you do,
// not the first. (The old menuBtn style went with the board's menu link.)
const tapBtn: React.CSSProperties = {
  fontFamily: MONO, fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase',
  color: '#D4B85A', background: 'none', cursor: 'pointer',
  border: '1px solid rgba(212,184,90,.45)', borderRadius: 8,
  padding: '17px 30px', minHeight: 56,
}
const primaryBtn: React.CSSProperties = {
  background: '#E5D4C2', color: '#052E20', border: 'none', borderRadius: 8,
  fontFamily: MONO, fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase',
  padding: '18px 34px', cursor: 'pointer', minHeight: 56,
}
