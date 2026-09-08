'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import RadarChart from '@/components/whisky/RadarChart'
import { RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import EmptyState from '@/components/members/EmptyState'
import { SkeletonLines } from '@/components/members/Skeleton'

// MEMBER MODE — the PIN screen, then the member's own view.
//
// The greeting is a FIRST NAME and nothing else. This screen sits open on a bar
// top while six digits are thumbed in, in a room with other people; a full name
// parked there for twenty seconds is the wrong trade for a club that sells
// discretion, and a weaker confirmation of the card→name binding is the point.
// No balance, no visit history, no tier. The API doesn't send them either.

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const INK = '#E5D4C2'
const GROUND = '#052E20'

const ABANDON_MS = 15_000   // tap-and-walk-away must not leave a name on the bar
const IDLE_MS = 85_000      // just inside the server's 90s, so the exit is graceful

interface Me {
  first_name: string | null; palate: string[]; room: string | null; expires_at: string
  cats: Cat[] | null; shape: ShapeValues | null
}
interface Entry { id: string; title: string; title_vn: string | null; entry_date: string
                  start_time: string | null; end_time: string | null; space: string | null; kind: string }
interface Fixture { id: string; sport: string; title: string; date: string; location: string | null }
interface Week { from: string; to: string; entries: Entry[]; fixtures: Fixture[] }

const VN = 'Asia/Ho_Chi_Minh'
const vnNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: VN }))

// THE CLUB RUNS PAST MIDNIGHT. "Good morning" to someone three drinks into a
// Thursday reads as broken, so the evening runs until 05:00 — the day boundary is
// not where the evening ends. Same lesson as the board's midnight arithmetic.
function greeting(): string {
  const h = vnNow().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  return 'Good evening'
}

// TONIGHT / TOMORROW, then weekday + date. Seven INCLUSIVE days is exactly one of
// each weekday, so a label can never repeat; the date is carried anyway.
function dayLabel(iso: string): string {
  const today = vnNow().toLocaleDateString('en-CA', { timeZone: VN })
  const tomorrow = new Date(vnNow().getTime() + 864e5).toLocaleDateString('en-CA', { timeZone: VN })
  if (iso === today) return 'Tonight'
  if (iso === tomorrow) return 'Tomorrow'
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: VN })
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

const pretty = (slug: string) => slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function KioskMember() {
  const router = useRouter()
  const [tap, setTap] = useState<{ member_no: string; first_name: string | null } | null>(null)
  const [num, setNum] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [week, setWeek] = useState<Week | null>(null)
  const abandon = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTouch = useRef(Date.now())

  const toBoard = useCallback(async (reason = 'done') => {
    try { await fetch('/api/kiosk/member/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }) } catch {}
    router.replace('/kiosk/board')
  }, [router])

  // Sign-in now happens ON THE BOARD, so the usual arrival here is with a session
  // already minted. Ask first; only fall back to the PIN screen if there isn't one
  // (someone deep-linking here, or a session that expired on the way).
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
        if (r.ok) setMe((await r.json()).member)
      } catch {}
      setChecked(true)
    })()
    try {
      const raw = sessionStorage.getItem('trc_kiosk_tap')
      if (raw) { const j = JSON.parse(raw); setTap({ member_no: j.member_no, first_name: j.first_name }); setNum(j.member_no || '') }
      sessionStorage.removeItem('trc_kiosk_tap')
    } catch {}
  }, [])

  // ── ABANDON: the PIN screen clears itself. Every keypress resets it, so a real
  //    member thumbing six digits is never cut off; a walk-away clears in 15s.
  const bumpAbandon = useCallback(() => {
    if (me) return
    if (abandon.current) clearTimeout(abandon.current)
    abandon.current = setTimeout(() => router.replace('/kiosk/board'), ABANDON_MS)
  }, [me, router])
  useEffect(() => { bumpAbandon(); return () => { if (abandon.current) clearTimeout(abandon.current) } }, [bumpAbandon, pin, num])

  // ── IDLE, once signed in. Reset on REAL INTERACTION — scroll and touch, not just
  //    navigation. Phase 3 has a scrollable newsletter and comfortable reading
  //    exceeds 90 seconds of no navigation; being logged out mid-read reads as broken.
  useEffect(() => {
    if (!me) return
    const mark = () => { lastTouch.current = Date.now() }
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'touchmove', 'scroll', 'wheel', 'keydown']
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }))
    const beat = setInterval(async () => {
      if (Date.now() - lastTouch.current > IDLE_MS) { toBoard('idle'); return }
      if (Date.now() > +new Date(me.expires_at)) { toBoard('ttl'); return }
      // Touching /me bumps the server-side idle clock — the member is still here.
      const r = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
      if (!r.ok) toBoard('idle')
    }, 30_000)
    return () => { evs.forEach(e => window.removeEventListener(e, mark)); clearInterval(beat) }
  }, [me, toBoard])

  // The week loads AFTER the greeting: /me carries the fixed column, so the
  // member's own name is on screen while this is still in flight.
  useEffect(() => {
    if (!me) return
    fetch('/api/kiosk/member/week', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setWeek(j?.week ?? { from: '', to: '', entries: [], fixtures: [] }))
      .catch(() => setWeek({ from: '', to: '', entries: [], fixtures: [] }))
  }, [me])

  const submit = async () => {
    if (pin.length !== 6 || busy) return
    setBusy(true); setErr(false)
    const r = await fetch('/api/kiosk/member/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_no: num.trim(), pin }),
    })
    setBusy(false)
    if (!r.ok) { setErr(true); setPin(''); return }
    const m = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
    if (!m.ok) { setErr(true); setPin(''); return }
    setMe((await m.json()).member)
  }

  // ── THE MEMBER'S OWN VIEW ───────────────────────────────────────────────
  // Left column FIXED: who they are, and it never scrolls. Right column scrolls,
  // and scrolling resets the idle clock — a member who scrolls is still present.
  if (me) {
    const days: Array<{ iso: string; items: Array<{ ms: number; time: string; title: string; title_vn?: string | null; where: string | null; tag: string }> }> = []
    const push = (iso: string, item: { ms: number; time: string; title: string; title_vn?: string | null; where: string | null; tag: string }) => {
      let d = days.find(x => x.iso === iso)
      if (!d) { d = { iso, items: [] }; days.push(d) }
      d.items.push(item)
    }
    for (const e of week?.entries || []) {
      push(e.entry_date, {
        ms: new Date(`${e.entry_date}T${e.start_time ? e.start_time.slice(0,5) : '12:00'}:00+07:00`).getTime(),
        time: hhmm(e.start_time), title: e.title, title_vn: e.title_vn, where: e.space, tag: e.kind,
      })
    }
    for (const f of week?.fixtures || []) {
      const iso = new Date(f.date).toLocaleDateString('en-CA', { timeZone: VN })
      push(iso, {
        ms: new Date(f.date).getTime(),
        time: new Date(f.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN }),
        title: f.title, where: f.location, tag: f.sport,
      })
    }
    days.sort((a, b) => a.iso.localeCompare(b.iso))
    days.forEach(d => d.items.sort((a, b) => a.ms - b.ms))

    return (
      <div style={twoCol}>
        {/* ── FIXED: who they are ─────────────────────────────────────────── */}
        <div style={fixedCol}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)' }}>
            {me.room}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 'clamp(30px,4.4vh,52px)', lineHeight: 1.1, marginTop: 10 }}>
            {greeting()}, {me.first_name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(229,212,194,.55)', marginTop: 10 }}>
            {vnNow().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: VN })}
          </div>

          {me.cats && me.shape && Object.keys(me.shape).length > 0 && (
            <div style={{ marginTop: 'clamp(14px,3vh,32px)' }}>
              <div style={sectionLabel}>Your palate</div>
              {/* The portal's radar, not a second one — so it inherits f5d2c90. */}
              <div style={{ marginLeft: -18 }}>
                <RadarChart cats={me.cats} shapes={[{ values: me.shape, color: RADAR_GOLD, label: '' }]} size={230} />
              </div>
            </div>
          )}

          {/* Sign-out is unmissable but NOT in the top-right, where the eye goes for
              the clock and a wandering thumb would dump a member to the board. */}
          <button onClick={() => toBoard('done')} style={doneBtn}>Done</button>
        </div>

        {/* ── SCROLLS: what's on ──────────────────────────────────────────── */}
        <div style={weekCol}>
          <div style={sectionLabel}>This week</div>

          {!week ? (
            <div style={{ marginTop: 22 }}><SkeletonLines lines={6} gap={16} /></div>
          ) : days.length === 0 ? (
            <div style={{ marginTop: 30, maxWidth: 420 }}>
              <EmptyState
                title="Nothing in the diary this week."
                body={<>The bar is the event.<br />
                  <span style={{ opacity: .55 }}>{/* VN — Miss Châu, not machine-translated */}</span></>}
              />
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              {days.map(d => (
                <div key={d.iso} style={{ marginBottom: 26 }}>
                  <div style={dayHead}>{dayLabel(d.iso)}</div>
                  {d.items.map((it, i) => (
                    <div key={i} style={row}>
                      <div style={rowTime}>{it.time}</div>
                      <div>
                        <div style={{ fontFamily: SERIF, fontSize: 'clamp(17px,2.4vh,24px)', lineHeight: 1.25 }}>{it.title}</div>
                        {it.title_vn && <div style={{ fontFamily: SERIF, fontSize: 15, color: 'rgba(229,212,194,.45)', marginTop: 2 }}>{it.title_vn}</div>}
                        <div style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(229,212,194,.5)', marginTop: 4 }}>
                          {it.where || '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Don't flash a PIN screen while the session check is still in flight.
  if (!checked) return <div style={wrap} />

  // ── THE PIN SCREEN (fallback — normal entry is from the board) ───────────
  return (
    <div style={wrap} onPointerDown={bumpAbandon}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 460 }}>
        {tap?.first_name
          ? <div style={{ fontFamily: SERIF, fontSize: 'clamp(28px,4.2vw,46px)' }}>Good evening, {tap.first_name}</div>
          : <div style={{ fontFamily: SERIF, fontSize: 'clamp(24px,3.4vw,38px)' }}>Your surname</div>}

        {!tap && (
          <input
            value={num} onChange={e => { setNum(e.target.value); bumpAbandon() }}
            placeholder="Your surname" autoCapitalize="words" autoComplete="off" spellCheck={false}
            style={{ ...field, marginTop: 18 }}
          />
        )}

        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)', marginTop: 26 }}>
          Enter your six-digit PIN
        </div>
        <input
          value={pin} inputMode="numeric" autoFocus={!!tap}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setErr(false); bumpAbandon() }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          style={{ ...field, marginTop: 12, fontSize: 34, letterSpacing: '.5em' }}
        />

        <button onClick={submit} disabled={pin.length !== 6 || !num.trim() || busy}
          style={{ ...ghost, marginTop: 20, opacity: pin.length === 6 && num.trim() && !busy ? 1 : .35 }}>
          {busy ? 'One moment' : 'Continue'}
        </button>

        {/* ONE generic failure. It never says which membership numbers exist, and the
            set-a-PIN line is shown on EVERY failure so it carries no signal. */}
        {err && (
          <div style={{ fontFamily: MONO, fontSize: 12, color: '#C27070', marginTop: 16, lineHeight: 1.7 }}>
            That didn’t match. Please try again.<br />
            <span style={{ color: 'rgba(229,212,194,.45)' }}>Not set a PIN yet? You can set one in your member portal.</span>
          </div>
        )}
      </div>
      <button onClick={() => router.replace('/kiosk/board')} style={{ ...ghost, alignSelf: 'flex-start', opacity: .5 }}>Cancel</button>
    </div>
  )
}

// Landscape tablet, arm's length, read standing with a drink in hand. Two columns:
// the left is fixed and answers "is this mine", the right scrolls and answers
// "what's on". Only the right scrolls, so the fixed column can never be lost.
const twoCol: React.CSSProperties = {
  height: '100dvh', background: GROUND, color: INK, display: 'flex',
  gap: 'clamp(20px,4vw,64px)', padding: 'clamp(16px,4vh,44px) clamp(20px,5vw,64px)', overflow: 'hidden',
}
const fixedCol: React.CSSProperties = {
  flex: '0 0 clamp(280px, 34%, 420px)', display: 'flex', flexDirection: 'column', minHeight: 0,
}
const weekCol: React.CSSProperties = {
  flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto',
  borderLeft: '1px solid rgba(229,212,194,.12)', paddingLeft: 'clamp(18px,3vw,44px)',
}
const sectionLabel: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#D4B85A',
}
const dayHead: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase',
  color: 'rgba(229,212,194,.45)', borderBottom: '1px solid rgba(229,212,194,.1)',
  paddingBottom: 6, marginBottom: 12,
}
const row: React.CSSProperties = { display: 'flex', gap: 18, marginBottom: 16, alignItems: 'baseline' }
const rowTime: React.CSSProperties = {
  fontFamily: MONO, fontSize: 15, color: '#D4B85A', flex: '0 0 52px', letterSpacing: '.04em',
}
const doneBtn: React.CSSProperties = {
  marginTop: 'auto', alignSelf: 'flex-start',
  background: 'none', border: '1px solid rgba(229,212,194,.35)', borderRadius: 8, color: INK,
  fontFamily: MONO, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
  padding: '16px 34px', minHeight: 56, cursor: 'pointer',
}

const wrap: React.CSSProperties = {
  minHeight: '100vh', background: GROUND, color: INK,
  display: 'flex', flexDirection: 'column', padding: '5vh 6vw',
}
const field: React.CSSProperties = {
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.2)', borderRadius: 4,
  color: INK, fontFamily: MONO, fontSize: 22, padding: '14px 16px', width: '100%', outline: 'none',
}
const ghost: React.CSSProperties = {
  background: 'none', border: '1px solid rgba(229,212,194,.35)', borderRadius: 4, color: INK,
  fontFamily: MONO, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
  padding: '12px 24px', cursor: 'pointer',
}
