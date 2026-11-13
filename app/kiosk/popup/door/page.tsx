'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import { tr, type Lang } from '@/lib/popup/strings'

// ═══════════════════════════════════════════════════════════════════════════
// THE DOOR — a staff phone, at the entrance to the pop-up.
// ───────────────────────────────────────────────────────────────────────────
// Scan, or type the code, or find the name. Tick. Next.
//
// ══ WHAT THIS SCREEN IS BUILT AROUND ═════════════════════════════════════
// 1 · SEVERAL PHONES AT ONCE. Every admit goes through popup_scan's atomic
//     claim, so two people ticking the same guest in the same instant resolve
//     to one admit and one "already admitted by Ni at 19:04" — a sentence,
//     not an error. The list re-reads every four seconds, so a tick on one
//     phone shows on the others before anybody can tick it twice.
// 2 · NO SIGNAL. The list is cached on every successful read. With the
//     network gone the door KEEPS WORKING from that cache and admits are
//     QUEUED with the time they actually happened — not the time they sync.
//     ⚠ THIS IS THE ONE PLACE IN THE POP-UP THAT QUEUES ANYTHING. The sign-up
//     screen deliberately never does, because it would have to promise a
//     place it cannot hold. A door tick promises nothing: the guest is
//     already inside, and the record catches up.
// 3 · THE WRONG ROW GETS TICKED. Two guests with the same first name, a phone
//     handed over mid-scan. Undo is on the row, not buried in an admin.
// 4 · A PARTY OF THREE WHERE TWO TURN UP. The commonest thing a door sees.
//     Admit asks how many when the party is bigger than one.
// ═══════════════════════════════════════════════════════════════════════════

const POLL_MS = 4_000
const CACHE_KEY = 'trc_popup_door_cache_v1'
const QUEUE_KEY = 'trc_popup_door_queue_v1'

type State =
  | 'valid'       // their session is running — let them in
  | 'early_ok'    // the NEXT group, checked in while the current one is inside
  | 'late_ok'     // within the late allowance
  | 'too_early'   // a later group — not yet
  | 'passed'      // beyond the late allowance
  | 'used' | 'waiting' | 'cancelled'
  | 'unknown' | 'wrong_event' | 'malformed' | 'queued'
  // kept so an older cached answer still renders rather than falling through
  | 'early' | 'late'
  // ⚠ ADDED BECAUSE THINGS WERE FAILING SILENTLY. A refused or broken action
  // now lands on a screen like any other answer.
  | 'failed' | 'offline'

interface Row {
  booking_id: string; ticket_code: string; door_code?: string | null
  name: string; email: string | null
  party_size: number; status: string; session_idx: number
  starts_at: string; ends_at: string
  admitted_at: string | null; admitted_by: string | null
  admitted_party: number | null; admitted_offline: boolean
  taken_by: string | null; source: string
}
interface Sess {
  session_id: string; idx: number; starts_at: string; ends_at: string
  cap: number; booked: number; arrived: number; waiting: number
  no_show: number; over_by: number; closed: boolean; ticked: number
  // ⚠ CHECKED IN, STANDING OUTSIDE. Not the same number as `arrived`, which
  // means in the room.
  waiting_outside?: number
}
interface Queued { code: string; party: number | null; at: string; name?: string }
interface Result {
  state: State; booking_id?: string; name?: string; party_size?: number
  their_practice?: boolean; this_practice?: boolean
  gap_minutes?: number; come_back_at?: string | null; inside?: boolean
  ticket_code?: string; moved_to?: string | null
  admitted_at?: string | null; admitted_by?: string | null
  admitted_party?: number | null; starts_at?: string | null; code?: string
}

const hhmm = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) : '--:--'

export default function PopupDoor() {
  const router = useRouter()
  const { lang, setLang } = useLang()
  const L = lang as Lang
  const [rows, setRows] = useState<Row[]>([])
  const [sessions, setSessions] = useState<Sess[]>([])
  const [staff, setStaff] = useState<string | null>(null)
  const [needsPin, setNeedsPin] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [lastRead, setLastRead] = useState<number | null>(null)
  const [queue, setQueue] = useState<Queued[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState('')
  // ⚠ A FOUR-DIGIT LOOKUP IS NOT AN ADMIT. It produces a booking to LOOK AT;
  // admitting is a second, deliberate tap after staff have checked the name.
  const [lookedUp, setLookedUp] = useState<null | { booking_id: string; name: string
    party_size: number; status: string; ticket_code: string; door_code: string
    starts_at: string; admitted_at: string | null; admitted_by: string | null }>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  // ⚠ CORRECTING A BOOKING WHERE IT WENT WRONG. Reached from the name list,
  // from a four-digit lookup, and from the confirmation screen of a booking
  // just taken — the three places a mistake is noticed.
  const [fixing, setFixing] = useState<Row | null>(null)
  // Only three fields are ever read from it, and a whole Row is not available
  // from a four-digit lookup. Say what is actually needed.
  const [asking, setAsking] = useState<{ name: string; party_size: number; ticket_code: string } | null>(null)
  const [walkup, setWalkup] = useState<string | null>(null) // session id
  const [busy, setBusy] = useState(false)
  const [partyMax, setPartyMax] = useState(2)
  // Which evening this phone is on — so a refusal can name the list it searched.
  const [evInfo, setEvInfo] = useState<{ title: string; practice: boolean
    gap: number; late: number } | null>(null)
  // ⚠ THE CAMERA IS OPEN ON ARRIVAL. "Scan a ticket" means scan a ticket —
  // making her find and press a second button to start the camera was a step
  // that existed only because the screen used to be a list with a scanner
  // bolted on. Typing the code and finding a name sit underneath it.
  const [scanning, setScanning] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  // ── THE CACHE AND THE QUEUE, read once on mount ────────────────────────
  useEffect(() => {
    try {
      const c = localStorage.getItem(CACHE_KEY)
      if (c) {
        const j = JSON.parse(c)
        setRows(j.rows || []); setSessions(j.sessions || []); setLastRead(j.at || null)
        if (j.ev) setEvInfo(j.ev)
      }
      const q = localStorage.getItem(QUEUE_KEY)
      if (q) setQueue(JSON.parse(q) || [])
    } catch { /* a cleared or blocked store is not a fault; the door reloads */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch {}
  }, [queue])

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(t) }, [])

  // ── READING THE LIST ───────────────────────────────────────────────────
  const read = useCallback(async () => {
    try {
      const r = await fetch('/api/kiosk/popup/door', { cache: 'no-store' })
      if (r.status === 401) { setNeedsPin(true); setOnline(true); return }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        // ⚠ A 500 IS NOT "NO BOOKINGS". A door showing an empty list because a
        // function is missing looks exactly like a quiet evening, and people
        // get turned away on it.
        setSchemaError(j.detail || j.error || 'The list could not be read.')
        setOnline(true)
        return
      }
      const j = await r.json()
      setSchemaError(null); setNeedsPin(false); setOnline(true)
      setRows(j.list || []); setSessions(j.sessions || []); setStaff(j.staff)
      setPartyMax(j.event?.party_max ?? 2)
      // ⚠ THE WINDOW TRAVELS WITH THE CACHE. Offline, the phone has to apply
      // the same rules the server would — which means it needs the gap between
      // starts and the late allowance, not just the times.
      setEvInfo({ title: j.event?.title ?? '', practice: !!j.event?.practice,
                  gap: j.event?.gap_minutes ?? 20, late: j.event?.admit_late_minutes ?? 5 })
      const at = Date.now(); setLastRead(at)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({
        rows: j.list, sessions: j.sessions, at,
        ev: { title: j.event?.title, practice: !!j.event?.practice,
              gap: j.event?.gap_minutes ?? 20, late: j.event?.admit_late_minutes ?? 5 },
      })) } catch {}
    } catch {
      // Only a thrown fetch means the network is gone. An HTTP error does not.
      setOnline(false)
    }
  }, [])

  useEffect(() => { read() }, [read])

  // ⚠ ARRIVING STRAIGHT ON A BOOKING. The confirmation screen sends her here
  // with ?fix=<id>, so correcting the booking she has just taken is one tap
  // from the screen she is already showing the guest — not a search.
  // ⚠ AND WHERE SHE CAME FROM. A correction opened from the sign-up
  // confirmation belongs back at the sign-up when it is finished, not on a
  // door list she never asked for.
  const [cameFromSignup, setCameFromSignup] = useState(false)
  // One camera for the whole visit to this screen. See useDoorCamera.
  const cam = useDoorCamera()
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('fix')
    if (!id || !rows.length) return
    window.history.replaceState({}, '', '/kiosk/popup/door')
    const r = rows.find(x => x.booking_id === id)
    if (r) { setFixing(r); setCameFromSignup(true); return }
    // ⚠ NOT ON THE DOOR LIST IS NOT "DOES NOT EXIST". A cancelled booking is
    //   kept off that list on purpose; asked for by name it must still be
    //   found, and shown as cancelled rather than silently doing nothing.
    ;(async () => {
      const j = await fetch('/api/kiosk/popup/door', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find_id', booking_id: id }) })
        .then(x => x.json()).catch(() => null)
      if (j?.found) { setFixing(j.row as Row); setCameFromSignup(true) }
    })()
  }, [rows])
  useEffect(() => { const t = setInterval(read, POLL_MS); return () => clearInterval(t) }, [read])

  // ── REPLAYING WHAT WAS TICKED OFFLINE ──────────────────────────────────
  // ⚠ SAFE TO REPLAY, AND THAT IS NOT LUCK. popup_scan admits with
  // `where admitted_at is null`, so a tick that already reached the server
  // comes back 'used' instead of admitting a second time, and a queue sent
  // twice does the same thing once.
  const flushing = useRef(false)
  useEffect(() => {
    if (!online || !queue.length || flushing.current) return
    flushing.current = true
    ;(async () => {
      const left: Queued[] = []
      for (const q of queue) {
        try {
          const r = await fetch('/api/kiosk/popup/door', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'scan', code: q.code, admit: true,
                                   party: q.party, at: q.at, offline: true }),
          })
          if (!r.ok) left.push(q)
        } catch { left.push(q) }
      }
      setQueue(left)
      flushing.current = false
      read()
    })()
  }, [online, queue, read])

  // ── FOUR DIGITS: FIND, THEN ASK ────────────────────────────────────────
  const findCode = useCallback(async (code: string) => {
    setBusy(true); setPressing('find_code'); setCodeErr(null); setLookedUp(null)
    try {
      const r = await fetch('/api/kiosk/popup/door', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find_code', code }) })
      const j = await r.json().catch(() => ({}))
      if (r.status === 429) { setCodeErr(tr(L, 'sc_too_many')); return }
      // ⚠ AND A 500 IS NOT "NO BOOKING WITH THAT CODE" EITHER. The guest is
      // standing there with a real code; telling staff it does not exist sends
      // them looking for a problem that is not theirs.
      if (!r.ok) { setCodeErr(`${tr(L, 'b_failed')} ${tr(L, 'b_try_again')}`); return }
      // ⚠ WHICH LIST WAS SEARCHED. "No booking with that code" is true of
      // every evening at once and tells a doorman nothing.
      if (!j.found) {
        const where = evInfo?.practice ? tr(L, 'm_practice') : (evInfo?.title || '—')
        setCodeErr(tr(L, 'm_no_code_on', { event: where }))
        return
      }
      setLookedUp(j)
    } catch { setOnline(false); setCodeErr(tr(L, 'd_off_title')) }
    finally { setBusy(false); setPressing(null) }
  }, [L, evInfo])

  // ── ADMITTING ──────────────────────────────────────────────────────────
  // ⚠ WHICH BUTTON IS WORKING, so the one that was pressed can say so rather
  // than every button on the screen greying out together.
  const [pressing, setPressing] = useState<string | null>(null)

  // ⚠ THE SAME LADDER THE SERVER WALKS, so an offline answer and an online
  // answer for the same ticket at the same minute are the same answer. If this
  // and popup_scan ever disagree, the door tells two stories in one evening.
  const offlineState = useCallback((row: Row): State => {
    const gap = evInfo?.gap ?? 20
    const late = evInfo?.late ?? 5
    const t = Date.now()
    const start = +new Date(row.starts_at), end = +new Date(row.ends_at)
    if (row.status === 'cancelled') return 'cancelled'
    if (row.status === 'waiting') return 'waiting'
    if (row.admitted_at) return 'used'
    if (t < start - gap * 60_000) return 'too_early'
    if (t < start) return 'early_ok'
    if (t <= start + late * 60_000) return t > start ? 'late_ok' : 'valid'
    if (t <= end) return 'valid'
    return 'passed'
  }, [evInfo])

  const admit = useCallback(async (code: string, party: number | null, name?: string) => {
    setBusy(true); setPressing(code)
    const at = new Date().toISOString()
    try {
      const r = await fetch('/api/kiosk/popup/door', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', code, admit: true, party }),
      })
      const j = await r.json().catch(() => ({}))
      // ⚠ A 500 IS NOT "NOT ON THE LIST". Without this the body came back as
      // { error: … }, state was undefined, and the card fell through to its
      // default — telling a doorman the guest had no booking when in fact the
      // server had fallen over. Worse than silence: a wrong answer, confidently.
      if (!r.ok) { setResult({ state: 'failed', name: typeof j?.error === 'string' ? j.error : undefined }); return }
      setResult(j)
      read()
    } catch {
      // ⚠ NO SIGNAL — QUEUED, AND SAID SO. The guest walks in; the record
      // catches up carrying the time it is now, not the time it syncs.
      // ⚠ OFFLINE, THE RULES STILL APPLY. Queuing a guest whose time has
      // passed, or who belongs to a later group, would admit them the moment
      // the signal came back — the one thing the window exists to stop.
      const row = rows.find(r => r.ticket_code === code)
      const st = row ? offlineState(row) : 'queued'
      if (row && !['valid', 'early_ok', 'late_ok'].includes(st)) {
        setResult({ state: st, name: row.name, party_size: row.party_size,
                    starts_at: row.starts_at, admitted_at: row.admitted_at,
                    admitted_by: row.admitted_by,
                    come_back_at: new Date(+new Date(row.starts_at) - 5 * 60_000).toISOString() })
        setOnline(false)
        return
      }
      setQueue(q => [...q, { code, party, at, name }])
      setResult({ state: 'queued', name: name ?? row?.name, code })
      setOnline(false)
    } finally { setBusy(false); setPressing(null); setAsking(null) }
  }, [read, rows, offlineState])

  const act = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true); setPressing(String(payload.booking_id || payload.action || ''))
    try {
      const r = await fetch('/api/kiosk/popup/door', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) })
      const j = await r.json().catch(() => ({}))
      // ⚠ AN HTTP ERROR IS AN ANSWER, NOT A SHRUG. Without this a 500 fell
      // through as `{}` and the screen simply carried on looking normal.
      if (!r.ok) {
        setResult({ state: 'failed', name: typeof j?.error === 'string' ? j.error : undefined })
        // The caller is told it failed AND that the network was fine, so it
        // does not blame the router.
        return { ok: false, error: typeof j?.error === 'string' ? j.error : undefined }
      }
      read()
      return j
    } catch {
      setOnline(false)
      setResult({ state: 'offline' })
      return { ok: false, offline: true }
    } finally { setBusy(false); setPressing(null) }
  }, [read])

  // ── WHAT IS HAPPENING NOW, AND WHAT IS NEXT ────────────────────────────
  const { current, next } = useMemo(() => {
    const t = now
    const cur = sessions.find(s => +new Date(s.starts_at) <= t && t <= +new Date(s.ends_at)) || null
    const nxt = sessions.find(s => +new Date(s.starts_at) > t) || null
    return { current: cur, next: nxt }
  }, [sessions, now])

  // ── THE ORDER THEY APPEAR IN ───────────────────────────────────────────
  // ⚠ NOT TIME ORDER. popup_runsheet returns the evening in time order, which
  // is right for a run sheet and wrong for a door: by 20:40 there would be
  // eight finished sessions to scroll past before reaching the one with people
  // standing in front of you.
  //
  // Live first, then what is still to come, then the finished ones last — and
  // the finished ones are still THERE, because a guest who missed their slot
  // is found in a finished session or not at all.
  const ordered = useMemo(() => {
    const t = now
    const rank = (s: Sess) =>
      +new Date(s.starts_at) <= t && t <= +new Date(s.ends_at) ? 0
      : +new Date(s.starts_at) > t ? 1 : 2
    return [...sessions].sort((x, y) => {
      const d = rank(x) - rank(y)
      if (d !== 0) return d
      // Inside each band, time order — and finished ones most-recent first,
      // because the session that just ended is the one being asked about.
      return rank(x) === 2
        ? +new Date(y.starts_at) - +new Date(x.starts_at)
        : +new Date(x.starts_at) - +new Date(y.starts_at)
    })
  }, [sessions, now])

  // ── SEARCH ACROSS EVERY SESSION, name or email ─────────────────────────
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return null
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      r.ticket_code.toLowerCase().includes(q))
  }, [rows, query])

  if (needsPin) return <PinGate onIn={() => { setNeedsPin(false); read() }} />

  const byIdx = (i: number) => rows.filter(r => r.session_idx === i)

  return (
    <main className="dr">
      {/* Home is at the TOP LEFT, where a back control lives on a phone — not
          at the bottom of a list she would have to scroll to the end of. */}
      <button className="dr-home" onClick={() => router.push('/kiosk/popup')}>
        ← {tr(L, 'h_back_home')}
      </button>

      {/* ── THE BAR: who, when, and whether this phone is actually connected ── */}
      <header className="dr-top">
        <div>
          <div className="dr-who">
            {staff || '…'}
            {evInfo && <em className="dr-on">{evInfo.practice ? tr(L, 'm_practice') : evInfo.title}</em>}
          </div>
          {/* ⚠ THE TWO GROUPS THAT SCAN GREEN RIGHT NOW. Staff have to know
              which two without working it out: the one inside, and the one
              being checked in. */}
          <div className="dr-when dr-groups">
            <span><em>{tr(L, 'w_now')}</em><b>{current ? hhmm(current.starts_at) : tr(L, 'w_none_now')}</b>
              {current && <i>{current.arrived}/{current.booked}</i>}</span>
            <span><em>{tr(L, 'w_next')}</em><b>{next ? hhmm(next.starts_at) : tr(L, 'w_none_now')}</b>
              {next && (next.waiting_outside ?? 0) > 0 &&
                <i>{tr(L, 'w_waiting_out', { n: next.waiting_outside ?? 0 })}</i>}</span>
          </div>
        </div>
        <div className="dr-net">
          <span className={`dr-dot ${online ? 'is-on' : 'is-off'}`} />
          {online ? (lastRead ? `${Math.max(0, Math.round((now - lastRead) / 1000))}s` : '—') : tr(L, 'd_offline')}
          {queue.length > 0 && <span className="dr-q">{tr(L, 'd_to_send', { n: queue.length })}</span>}
        </div>
      </header>

      {schemaError && (
        <div className="dr-bad">
          <strong>{tr(L, 'd_bad_title')}</strong>
          <span>{schemaError}</span>
          <span>{tr(L, 'd_bad_sub')}</span>
        </div>
      )}
      {!online && (
        <div className="dr-warn">
          <strong>{tr(L, 'd_off_title')}</strong>
          <span>{tr(L, 'd_off_sub')}{lastRead ? ` (${Math.round((now - lastRead) / 60000)} min)` : ''}</span>
        </div>
      )}

      {/* ── SCAN / TYPE ─────────────────────────────────────────────────── */}
      {scanning
        ? <Scanner L={L} cam={cam} onCode={c => { setScanning(false); admit(c, null) }} onClose={() => setScanning(false)} />
        : <button className="dr-scan" onClick={() => setScanning(true)}>{tr(L, 'd_scan')}</button>}

      <div className="dr-orlabel">{tr(L, 'sc_type')}</div>
      {/* ⚠ FOUR DIGITS, NOT EIGHT HEX CHARACTERS. Nobody reads "7E833C4F"
          across a door and nobody says it. The eight-character ticket code
          still exists and still rides in the QR; this is the one a guest can
          actually read out. */}
      <form className="dr-manual" onSubmit={e => { e.preventDefault(); if (manual.length === 4) { findCode(manual); setManual('') } }}>
        <input value={manual} maxLength={4} inputMode="numeric" pattern="[0-9]*"
               autoComplete="off" spellCheck={false} placeholder={tr(L, 'sc_code_label')}
               onChange={e => setManual(e.target.value.replace(/\D/g, ''))} />
        <button type="submit" disabled={manual.length !== 4 || busy}>
          {busy && pressing === 'find_code' ? tr(L, 'b_looking') : tr(L, 'd_go')}
        </button>
      </form>
      {codeErr && <div className="dr-bad"><strong>{codeErr}</strong></div>}

      {/* ── WHAT FOUR DIGITS BUY: A NAME TO CHECK ────────────────────────
          Not an admit button on its own. The guest is in front of her; the
          code is not proof that they are the person it belongs to. */}
      {fixing && (
        <FixBooking L={L} row={fixing} partyMax={partyMax}
                    onClose={() => {
                      setFixing(null)
                      if (cameFromSignup) { setCameFromSignup(false); router.push('/kiosk/popup'); return }
                      read()
                    }} />
      )}

      {lookedUp && (
        <div className="dr-found">
          <button className="dr-x" onClick={() => setLookedUp(null)} aria-label={tr(L, 'd_close')}>×</button>
          <div className="dr-found-ask">{tr(L, 'sc_ask_name')}</div>
          <div className="dr-found-name">{lookedUp.name}</div>
          <div className="dr-found-meta">
            {hhmm(lookedUp.starts_at)} · {lookedUp.party_size > 1
              ? tr(L, 'd_party_of', { n: lookedUp.party_size }) : tr(L, 'd_one_person')}
            {lookedUp.status === 'waiting' && ` · ${tr(L, 'd_waiting_list')}`}
          </div>
          <div className="dr-found-sub">{tr(L, 'sc_ask_sub')}</div>
          <button className="dr-fixlink" onClick={() => {
            const r = lookedUp; setLookedUp(null)
            setFixing({ booking_id: r.booking_id, name: r.name, party_size: r.party_size,
                        status: r.status, ticket_code: r.ticket_code, door_code: r.door_code,
                        email: null,
                        session_idx: 0, starts_at: r.starts_at, ends_at: r.starts_at,
                        admitted_at: r.admitted_at, admitted_by: r.admitted_by,
                        admitted_party: null, admitted_offline: false,
                        taken_by: null, source: 'kiosk' } as Row)
          }}>{tr(L, 'f_fix')}</button>
          {lookedUp.admitted_at ? (
            <div className="dr-found-already">
              {tr(L, 'd_s_used')} — {tr(L, 'd_s_used_by', { who: lookedUp.admitted_by || '—', time: hhmm(lookedUp.admitted_at) })}
            </div>
          ) : lookedUp.status === 'waiting' ? (
            <div className="dr-found-already">{tr(L, 'd_s_waiting_sub')}</div>
          ) : (
            <button className="dr-found-go" disabled={busy || pressing === lookedUp.ticket_code}
                    onClick={() => {
                      const r = lookedUp
                      setLookedUp(null)
                      // A party of more than one still asks how many are here.
                      if (r.party_size > 1) setAsking({ name: r.name, party_size: r.party_size, ticket_code: r.ticket_code })
                      else admit(r.ticket_code, 1, r.name)
                    }}>
              {pressing === lookedUp.ticket_code ? tr(L, 'b_admitting') : tr(L, 'sc_confirm_in')}
            </button>
          )}
        </div>
      )}

      {result && (
        <ResultCard L={L} r={result} busy={busy}
          onClose={() => setResult(null)}
          onUndo={async () => { if (result.booking_id) { await act({ action: 'unadmit', booking_id: result.booking_id }); setResult(null) } }}
          // ⚠ ONE BUTTON FOR A GUEST WHOSE TIME HAS GONE. It uses the same
          // Fix-a-booking move as everything else, so the old place is freed,
          // the waiting list is promoted and a new ticket goes out — rather
          // than a second, quieter way of moving somebody.
          onMove={async () => {
            if (!result.booking_id) return
            const room = await act({ action: 'rooms', party: result.party_size ?? 1,
                                     booking_id: result.booking_id })
            const next = room?.sessions?.[0]
            if (!next) { setResult({ ...result, state: 'failed' }); return }
            const j = await act({ action: 'fix', booking_id: result.booking_id,
                                  session_id: next.session_id })
            if (j?.ok) setResult({ ...result, moved_to: next.starts_at })
          }} />
      )}

      {/* ── SEARCH ──────────────────────────────────────────────────────── */}
      <div className="dr-orlabel">{tr(L, 'sc_byname')}</div>
      <input className="dr-search" value={query} onChange={e => setQuery(e.target.value)}
             placeholder={tr(L, 'd_find')}
             autoComplete="off" spellCheck={false} />

      {found
        ? <Group L={L} pressing={pressing} onFix={setFixing} title={found.length === 1 ? tr(L, 'd_match_one') : tr(L, 'd_matches', { n: found.length })} rows={found}
                 onAdmit={r => r.party_size > 1 ? setAsking(r) : admit(r.ticket_code, 1, r.name)}
                 onUndo={r => act({ action: 'unadmit', booking_id: r.booking_id })}
                 onParty={(r, n) => act({ action: 'set_party', booking_id: r.booking_id, party: n })}
                 busy={busy} showTime />
        : ordered.map(s => (
            <Group L={L} key={s.session_id} pressing={pressing} onFix={setFixing} rows={byIdx(s.idx)} busy={busy}
                   title={`${hhmm(s.starts_at)}`}
                   done={+new Date(s.ends_at) < now}
                   note={`${s.arrived}/${s.booked} ${tr(L, 'd_in_count')} · ${s.waiting ? `${tr(L, 'd_waiting_n', { n: s.waiting })} · ` : ''}${tr(L, 'd_cap', { n: s.cap })}${s.over_by ? ` · ${tr(L, 'd_over_by', { n: s.over_by })}` : ''}`}
                   live={current?.session_id === s.session_id}
                   onAdmit={r => r.party_size > 1 ? setAsking(r) : admit(r.ticket_code, 1, r.name)}
                   onUndo={r => act({ action: 'unadmit', booking_id: r.booking_id })}
                   onParty={(r, n) => act({ action: 'set_party', booking_id: r.booking_id, party: n })}
                   onWalkup={() => setWalkup(s.session_id)} />
          ))}

      {asking && (
        <Sheet L={L} title={asking.name} sub={tr(L, 'd_how_many', { n: asking.party_size })}
               onClose={() => setAsking(null)}>
          <div className="dr-nums">
            {Array.from({ length: asking.party_size }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => admit(asking.ticket_code, n, asking.name)} disabled={busy}>{n}</button>
            ))}
          </div>
        </Sheet>
      )}

      {walkup && (
        <WalkUp L={L} sessionId={walkup} partyMax={partyMax} busy={busy}
                onClose={() => setWalkup(null)}
                onGo={async (name, party, force) => {
                  const j = await act({ action: 'walkup', session_id: walkup, name, party, force })
                  // ⚠ THE SHEET STAYS OPEN LONG ENOUGH TO SAY SO. It used to
                  // close the instant it worked, which on a slow connection
                  // looked identical to nothing happening.
                  if (j?.ok) {
                    setResult({ state: 'valid', name, admitted_party: party, party_size: party,
                                admitted_at: new Date().toISOString() })
                    setTimeout(() => setWalkup(null), 1400)
                  }
                  return j
                }} />
      )}

      <div className="dr-lang">
        {(['en', 'vn'] as Lang[]).map(l => (
          <button key={l} className={L === l ? 'is-on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <button className="dr-out" onClick={() => router.push('/kiosk/popup')}>{tr(L, 'h_back_home')}</button>
      <Styles />
    </main>
  )
}

// ── THE RESULT OF A SCAN, in the words a doorman says out loud ────────────
// ⚠ GREEN TICK = MAY ENTER OR IS CHECKED IN. RED CROSS = EVERYTHING ELSE.
// Two shapes, not two colours: a cross and a tick are different outlines, so
// the answer survives bad light and a reader who cannot separate the hues.
const SAY: Record<State, { k: Parameters<typeof tr>[1]; yes: boolean }> = {
  valid:       { k: 'w_now_title',     yes: true },
  early_ok:    { k: 'w_next_title',    yes: true },
  late_ok:     { k: 'w_late_title',    yes: true },
  queued:      { k: 'd_s_queued',      yes: true },
  too_early:   { k: 'w_later_title',   yes: false },
  passed:      { k: 'w_passed_title',  yes: false },
  used:        { k: 'w_used_title',    yes: false },
  waiting:     { k: 'd_s_waiting',     yes: false },
  cancelled:   { k: 'd_s_cancelled',   yes: false },
  unknown:     { k: 'd_s_unknown',     yes: false },
  wrong_event: { k: 'd_s_wrong',       yes: false },
  malformed:   { k: 'd_s_malformed',   yes: false },
  failed:      { k: 'b_failed',        yes: false },
  offline:     { k: 'd_off_title',     yes: false },
  early:       { k: 'w_later_title',   yes: false },
  late:        { k: 'd_s_late',        yes: false },
}

// ⚠ TWO DIFFERENT SHAPES, drawn big enough to read across a doorway. A circle
// with a tick, and a circle with a cross — not a green dot and a red dot.
function Tick() {
  return (
    <svg viewBox="0 0 120 120" className="dr-icon" role="img" aria-label="yes">
      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="7" />
      <path d="M36 62 L53 79 L85 44" fill="none" stroke="currentColor"
            strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function Cross() {
  return (
    <svg viewBox="0 0 120 120" className="dr-icon" role="img" aria-label="no">
      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="7" />
      <path d="M42 42 L78 78 M78 42 L42 78" fill="none" stroke="currentColor"
            strokeWidth="11" strokeLinecap="round" />
    </svg>
  )
}

// ⚠ A SHORT, DISTINCT BUZZ FOR EACH. The room is loud and the phone is in a
// hand, not in view. One pulse for yes, three short for no. Silent where the
// browser does not support it, which is every iPhone — so it is an addition to
// the screen, never a substitute for it.
function buzz(yes: boolean) {
  try { navigator.vibrate?.(yes ? 60 : [40, 60, 40, 60, 40]) } catch { /* not supported */ }
}

function ResultCard({ L, r, onClose, onUndo, onMove, busy }: {
  L: Lang; r: Result; onClose: () => void; onUndo: () => void
  onMove?: () => void; busy?: boolean
}) {
  const s = SAY[r.state] || SAY.unknown
  const box = useRef<HTMLDivElement>(null)
  // The buzz fires once, when the answer appears.
  //
  // ⚠ AND THE ANSWER IS BROUGHT TO WHERE SHE IS LOOKING. The card renders in
  // one fixed place near the top of the page; a name ticked off in a later
  // group is halfway down a long list, and without this the screen appears to
  // do nothing at all — the one failure this whole card exists to prevent.
  useEffect(() => {
    buzz(s.yes)
    box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [s.yes])

  return (
    <div ref={box} className={`dr-result ${s.yes ? 'is-yes' : 'is-no'}`} role="status" aria-live="assertive">
      <button className="dr-x" onClick={onClose} aria-label={tr(L, 'd_close')}>×</button>

      {/* ⚠ THE ICON FILLS THE TOP OF THE SCREEN. It is the first thing read
          across a doorway, before any word. */}
      {s.yes ? <Tick /> : <Cross />}

      <div className="dr-r-h">{tr(L, s.k)}</div>
      {r.name && <div className="dr-r-name">{r.name}</div>}

      {/* ── THE CURRENT GROUP ─────────────────────────────────────────── */}
      {(r.state === 'valid' || r.state === 'late_ok') && (
        <div className="dr-r-sub">
          {r.party_size != null && (r.party_size > 1
            ? tr(L, 'd_party_of', { n: r.party_size }) : tr(L, 'd_one_person'))}
          {r.admitted_party != null && ` · ${tr(L, 'd_s_in_of', { n: r.admitted_party, total: r.party_size ?? r.admitted_party })}`}
        </div>
      )}

      {/* ── THE NEXT GROUP: checked in, not inside ─────────────────────── */}
      {r.state === 'early_ok' && (
        <div className="dr-r-sub dr-r-big">{tr(L, 'w_next_sub', { time: hhmm(r.starts_at) })}</div>
      )}

      {/* ── A LATER GROUP: when, and when to come back ─────────────────── */}
      {r.state === 'too_early' && (
        <div className="dr-r-sub dr-r-big">
          {tr(L, 'w_later_sub', { time: hhmm(r.starts_at), back: hhmm(r.come_back_at) })}
        </div>
      )}

      {/* ── PASSED: one button, and it says where they went ────────────── */}
      {r.state === 'passed' && (
        r.moved_to
          ? <div className="dr-r-sub dr-r-big">{tr(L, 'w_moved_to', { time: hhmm(r.moved_to) })}</div>
          : <>
              <div className="dr-r-sub">{hhmm(r.starts_at)}</div>
              {onMove && (
                <button className="dr-found-go" disabled={busy} onClick={onMove}>
                  {busy ? tr(L, 'b_working') : tr(L, 'w_passed_move')}
                </button>
              )}
            </>
      )}

      {r.state === 'used' && (
        <div className="dr-r-sub">
          {tr(L, 'w_used_sub', { time: hhmm(r.admitted_at), who: r.admitted_by || '—' })}
          {r.admitted_party != null && ` · ${r.admitted_party} ${tr(L, 'd_in_count')}`}
        </div>
      )}

      {r.state === 'waiting' && <div className="dr-r-sub">{tr(L, 'd_s_waiting_sub')}</div>}
      {r.state === 'wrong_event' && (
        <div className="dr-r-sub">
          {r.their_practice && !r.this_practice ? tr(L, 'm_wrong_event_practice')
            : !r.their_practice && r.this_practice ? tr(L, 'm_wrong_event_real')
            : tr(L, 'd_s_wrong_sub', { code: r.code || '' })}
        </div>
      )}
      {r.state === 'failed' && <div className="dr-r-sub">{tr(L, 'b_try_again')}</div>}
      {r.state === 'offline' && <div className="dr-r-sub">{tr(L, 'd_off_sub')}</div>}

      {(s.yes || r.state === 'used') && r.booking_id && (
        <button className="dr-undo" onClick={onUndo}>{tr(L, 'd_s_wrong_row')}</button>
      )}
    </div>
  )
}

// ── A SESSION'S NAMES ─────────────────────────────────────────────────────
function Group({ L, title, note, rows, onAdmit, onUndo, onParty, onWalkup, onFix, busy, pressing, live, showTime, done }: {
  L: Lang; title: string; note?: string; rows: Row[]; busy: boolean; pressing?: string | null
  live?: boolean; showTime?: boolean
  done?: boolean
  onAdmit: (r: Row) => void; onUndo: (r: Row) => void
  onParty: (r: Row, n: number) => void; onWalkup?: () => void; onFix?: (r: Row) => void
}) {
  // A finished session folds shut, with the ones who never arrived still
  // counted on the header — that number is the reason to open it.
  const missed = rows.filter(r => !r.admitted_at && r.status === 'confirmed').length
  const [open, setOpen] = useState(!done)
  return (
    <section className={`dr-grp ${live ? 'is-live' : ''} ${done ? 'is-done' : ''}`}>
      <div className="dr-grp-h" onClick={() => done && setOpen(o => !o)}>
        <span className="dr-grp-t">{title}{done && <em> {tr(L, 'd_finished')}{missed ? ` · ${tr(L, 'd_never_came', { n: missed })}` : ''}</em>}</span>
        {note && <span className="dr-grp-n">{note}{done && <> · {open ? tr(L, 'd_hide') : tr(L, 'd_show')}</>}</span>}
      </div>
      {!open ? null : <>
      {rows.length === 0 && <div className="dr-empty">{tr(L, 'd_nobody')}</div>}
      {rows.map(r => {
        const inNow = !!r.admitted_at
        return (
          <div key={r.booking_id} className={`dr-row ${inNow ? 'is-in' : ''} ${r.status === 'waiting' ? 'is-wait' : ''}`}>
            <div className="dr-row-l">
              <div className="dr-name">{r.name}</div>
              <div className="dr-meta">
                {showTime && <>{hhmm(r.starts_at)} · </>}
                {r.party_size > 1 ? tr(L, 'd_party_of', { n: r.party_size }) : tr(L, 'd_one_person')}
                {r.status === 'waiting' && ` · ${tr(L, 'd_waiting_list')}`}
                {r.source === 'door' && ` · ${tr(L, 'd_is_walkup')}`}
                {inNow && <> · {tr(L, 'd_in_at', { time: hhmm(r.admitted_at), who: r.admitted_by || '—' })}{r.admitted_offline ? ` ${tr(L, 'd_offline_tag')}` : ''}</>}
                <span className="dr-code">{r.ticket_code}</span>
              </div>
              {/* A party where only some came in: correcting the number is one
                  tap, on the row, because the third guest turns up at 19:09. */}
              {inNow && r.party_size > 1 && (
                <div className="dr-mini">
                  {Array.from({ length: r.party_size }, (_, i) => i + 1).map(n => (
                    <button key={n} className={r.admitted_party === n ? 'is-on' : ''}
                            disabled={busy} onClick={() => onParty(r, n)}>{n}</button>
                  ))}
                  <span>{tr(L, 'd_in_count')}</span>
                </div>
              )}
              {onFix && (
                <button className="dr-fixlink dr-fixrow" onClick={e => { e.stopPropagation(); onFix(r) }}>
                  {tr(L, 'f_fix')}
                </button>
              )}
            </div>
            {inNow
              ? <button className="dr-undo-s" disabled={busy} onClick={() => onUndo(r)}>
                  {pressing === r.booking_id ? tr(L, 'b_working') : tr(L, 'd_undo')}
                </button>
              : <button className="dr-admit" disabled={busy || r.status === 'waiting'} onClick={() => onAdmit(r)}>
                  {r.status === 'waiting' ? '—'
                    : pressing === r.ticket_code ? tr(L, 'b_admitting') : tr(L, 'd_admit')}
                </button>}
          </div>
        )
      })}
      {onWalkup && !done && <button className="dr-walk" onClick={onWalkup}>{tr(L, 'd_walkup')}</button>}
      </>}
    </section>
  )
}

// ── THE CAMERA ────────────────────────────────────────────────────────────
// TWO DECODERS, ONE RESULT.
//
// ⚠ iOS SAFARI HAS NO BarcodeDetector AND IS NOT GOING TO GET ONE IN TIME.
// A door that can only scan on Android is a door that half the staff cannot
// scan on. So:
//
//   BarcodeDetector  where it exists (Chrome on Android) — native, decoded off
//                    the main thread, costs us nothing.
//   jsQR             everywhere else (iOS Safari) — 328 KB of pure JavaScript,
//                    IMPORTED ONLY WHEN THE CAMERA IS OPENED so it never lands
//                    in the bundle of a phone that is taking sign-ups.
//
// Both feed the SAME admit path, so there is one answer to "what happens when
// a code is read" and not two.
//
// ── WHAT MAKES IT WORK ON AN iPHONE, SPECIFICALLY ────────────────────────
// · getUserMedia on iOS Safari requires HTTPS. It works on therampantclub.com
//   and on localhost, and NOWHERE ELSE — a phone pointed at a bare IP address
//   gets a permission error that reads like a broken camera.
// · playsInline is not optional. Without it iOS takes the video fullscreen and
//   the scanner disappears behind the system player.
// · play() has to happen inside a user gesture. It does: the camera opens on
//   the staff member's own tap.
// · The frame is CROPPED TO THE CENTRE SQUARE AND SCALED TO 400px before jsQR
//   sees it. Decoding a full 1280×720 frame takes 60–100ms on an older phone,
//   which is a visibly stuttering preview; 400×400 is a few milliseconds and
//   matches the aiming frame the guest is holding their phone inside anyway.
// · Throttled to ~12 frames a second. A QR does not move that fast and the
//   phone stays cool.
const DECODE_EVERY_MS = 80
const DECODE_SIZE = 400

type CamState = 'starting' | 'running' | 'denied' | 'none' | 'failed' | 'idle'
type Perm = 'granted' | 'prompt' | 'denied' | 'unknown'

// ── ONE CAMERA, FOR AS LONG AS SHE IS AT THE DOOR ─────────────────────────
// ⚠ THE PROMPT WAS COMING BACK ALL EVENING, and the reason was ours: the
// scanner owned the stream, so every result card unmounted it, stopped every
// track, and the next scan asked the browser for the camera from cold. On
// iOS that is a fresh permission decision often enough to be unbearable at a
// door with somebody standing in front of you.
//
// The stream now lives above the scanner and outlives it. It is released on
// exactly two events, both of which are "she is no longer at the door":
//   · leaving the door screen — home, sign-up, sign out
//   · the tab hidden for more than a minute — a phone in a pocket should not
//     hold a green light, but a glance at a message should not cost a prompt
//
// ⚠ AND OUR OWN EXPLAINER IS NOT A SECOND PROMPT. "Your phone will ask to use
// the camera" is true exactly once. Shown again to somebody who has already
// granted it, it reads as another decision to make.
const CAM_OK_KEY = 'trc_popup_cam_ok'
const camEverOk = () => { try { return localStorage.getItem(CAM_OK_KEY) === '1' } catch { return false } }

function useDoorCamera() {
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CamState>('idle')
  const [perm, setPerm] = useState<Perm>('unknown')
  const [known, setKnown] = useState(false)   // has this phone ever said yes
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setKnown(camEverOk()) }, [])

  // ⚠ READ THE STATE BEFORE ASKING, where that is possible. Chrome on Android
  // answers this; Safari has no 'camera' permission name at all and throws,
  // which is why the remembered flag above exists as the only memory there.
  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const q = await (navigator.permissions as unknown as {
          query?: (d: { name: string }) => Promise<PermissionStatus>
        })?.query?.({ name: 'camera' })
        if (off || !q) return
        setPerm(q.state as Perm)
        q.onchange = () => setPerm(q.state as Perm)
      } catch { /* not supported — 'unknown' is the honest answer */ }
    })()
    return () => { off = true }
  }, [])

  const live = () => !!streamRef.current?.getTracks().some(t => t.readyState === 'live')
  // ⚠ ONE REQUEST IN FLIGHT. Two callers arriving before the first resolves
  //   used to make two separate getUserMedia calls — which on a phone is two
  //   permission decisions for one tap.
  const pending = useRef<Promise<MediaStream | null> | null>(null)

  const open = useCallback(async (): Promise<MediaStream | null> => {
    if (live()) { setState('running'); return streamRef.current }
    if (pending.current) return pending.current
    if (!navigator.mediaDevices?.getUserMedia) { setState('none'); return null }
    setState('starting')
    pending.current = (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        streamRef.current = s
        try { localStorage.setItem(CAM_OK_KEY, '1') } catch { /* private mode */ }
        setKnown(true); setPerm('granted'); setState('running')
        return s
      } catch (e) {
        // ⚠ THE FAILURES READ DIFFERENTLY TO STAFF. "You said no" and "this
        // phone has no camera" need different actions from her.
        const name = (e as { name?: string })?.name || ''
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'failed')
        if (name === 'NotAllowedError') setPerm('denied')
        return null
      } finally { pending.current = null }
    })()
    return pending.current
  }, [])

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setState('idle')
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        hideTimer.current = setTimeout(() => release(), 60_000)
      } else if (hideTimer.current) {
        clearTimeout(hideTimer.current); hideTimer.current = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [release])

  // Leaving the door at all — home, sign-up, sign out — stops the light.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  return { open, release, state, perm, known, stream: streamRef }
}


function Scanner({ L, cam, onCode, onClose }: {
  L: Lang; cam: ReturnType<typeof useDoorCamera>
  onCode: (c: string) => void; onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [how, setHow] = useState<'native' | 'jsqr' | null>(null)
  const state = cam.state
  const { open } = cam
  // ⚠ THE HANDLER LIVES IN A REF, AND THAT IS HALF THE BUG. onCode is written
  // inline at the call site, so it is a new function on every render of the
  // door — which put it in this effect's dependencies and tore the whole
  // scanner down and back up each time anything on the page changed. Every
  // one of those rebuilds was another request for the camera.
  const onCodeRef = useRef(onCode)
  useEffect(() => { onCodeRef.current = onCode }, [onCode])

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout> | null = null

    // A QR may carry the whole ticket URL, or CODE.SIGNATURE, or the bare
    // eight characters a member of staff would type. All three land here.
    const pull = (raw: string) => {
      const m = raw.match(/([0-9A-Fa-f]{8})(?:\.|$|[^0-9A-Za-z])/)
      return m ? m[1].toUpperCase() : null
    }
    const hit = (raw: string) => {
      const code = pull(raw)
      if (code && !stop) { stop = true; onCodeRef.current(code) }
      return !!code
    }

    ;(async () => {
      // ── 1 · THE CAMERA, BORROWED ─────────────────────────────────────
      // ⚠ THE SCANNER NO LONGER OWNS IT. The same stream is handed back on
      // every scan all evening, so the browser is asked once and not once a
      // guest. The teardown below detaches the video and stops decoding; it
      // does NOT stop a track.
      const stream = await open()
      if (!stream || stop || !video.current) return
      video.current.srcObject = stream
      try { await video.current.play() } catch { /* a re-attached stream can
        reject play() on iOS and still render; the decode loop is the test */ }
      if (stop) return

      // ── 2 · THE DECODER ──────────────────────────────────────────────
      const D = (window as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> }
      }).BarcodeDetector

      if (D) {
        setHow('native')
        const det = new D({ formats: ['qr_code'] })
        const tick = async () => {
          if (stop || !video.current) return
          try {
            const found = await det.detect(video.current)
            for (const f of found) if (hit(f.rawValue)) return
          } catch { /* a frame that cannot be read is not worth reporting */ }
          timer = setTimeout(tick, DECODE_EVERY_MS)
        }
        tick()
        return
      }

      // ── jsQR · the iOS path ──────────────────────────────────────────
      setHow('jsqr')
      const { default: jsQR } = await import('jsqr')
      if (stop) return
      if (!canvas.current) canvas.current = document.createElement('canvas')
      canvas.current.width = DECODE_SIZE
      canvas.current.height = DECODE_SIZE
      const ctx = canvas.current.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      const tick = () => {
        if (stop || !video.current) return
        const v = video.current
        const vw = v.videoWidth, vh = v.videoHeight
        if (vw && vh) {
          // Centre square, scaled down. The aiming frame on screen marks the
          // same region, so what staff see is what is actually being read.
          const side = Math.min(vw, vh)
          ctx.drawImage(v, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, DECODE_SIZE, DECODE_SIZE)
          const img = ctx.getImageData(0, 0, DECODE_SIZE, DECODE_SIZE)
          // attemptBoth: a ticket printed dark-on-light and one shown on a
          // phone at night are not the same image.
          const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
          if (r?.data && hit(r.data)) return
        }
        timer = setTimeout(tick, DECODE_EVERY_MS)
      }
      tick()
    })()

    return () => {
      stop = true
      if (timer) clearTimeout(timer)
      // ⚠ DETACHED, NOT STOPPED. Stopping the track here is exactly what made
      // the permission prompt come back on the next scan. The stream is
      // released by useDoorCamera when she leaves the door or the phone goes
      // in a pocket — not when a result card appears.
      if (video.current) video.current.srcObject = null
    }
  }, [L, open])

  const message =
    state === 'denied' ? { h: tr(L, 'd_cam_denied'), s: tr(L, 'd_cam_denied_ios') }
    : state === 'none' ? { h: tr(L, 'd_cam_none_found'), s: '' }
    : state === 'failed' ? { h: tr(L, 'd_cam_fail'), s: '' }
    : null

  return (
    <div className="dr-cam">
      {message ? (
        <div className="dr-camerr">
          <strong>{message.h}</strong>
          {message.s && <span>{message.s}</span>}
        </div>
      ) : (
        <div className="dr-cam-wrap">
          <video ref={video} playsInline muted autoPlay />
          <div className="dr-cam-frame" aria-hidden />
          <div className="dr-cam-hint">
            {state === 'starting' ? tr(L, 'd_cam_starting') : tr(L, 'd_cam_aim')}
          </div>
          {/* ⚠ ONCE. Not every time the camera opens — only while the browser
              genuinely still has a decision to make. A phone that has already
              granted it goes straight to the picture. */}
          {state === 'starting' && cam.perm !== 'granted' && !cam.known &&
            <div className="dr-cam-ask">{tr(L, 'd_cam_asking')}</div>}
          {how && <span className="dr-cam-how">{how === 'native' ? 'native' : 'jsQR'}</span>}
        </div>
      )}
      <button onClick={onClose}>{message ? tr(L, 'd_cam_type') : tr(L, 'd_close')}</button>
    </div>
  )
}

function WalkUp({ L, sessionId, partyMax, busy, onClose, onGo }: {
  L: Lang; sessionId: string; partyMax: number; busy: boolean; onClose: () => void
  onGo: (name: string, party: number, force: boolean) => Promise<{ ok?: boolean; reason?: string; error?: string; offline?: boolean; places_left?: number } | null>
}) {
  const [name, setName] = useState('')
  const [party, setParty] = useState(1)
  const [full, setFull] = useState(false)
  const [working, setWorking] = useState(false)
  const [said, setSaid] = useState<{ bad: boolean; text: string; sub?: string } | null>(null)

  // ⚠ EVERY REFUSAL GETS WORDS. The first version handled reason === 'full'
  // and nothing else — so a walk-up on the real, unpublished evening was
  // refused with 'not_published', the component did nothing at all, and a
  // member of staff pressed the button and watched nothing happen. Found on a
  // real phone at the door.
  const explain = (r: { ok?: boolean; reason?: string; error?: string; offline?: boolean } | null) => {
    // ⚠ NULL MEANT TWO DIFFERENT THINGS and both read as "no signal": a lost
    // connection, and the server answering 500. Staff were told to expect the
    // router when the router was fine.
    if (!r) return { bad: true, text: tr(L, 'b_failed'), sub: tr(L, 'b_try_again') }
    if (r.offline) return { bad: true, text: tr(L, 'd_off_title'), sub: tr(L, 'd_off_sub') }
    switch (r.reason) {
      case 'not_published': return { bad: true, text: tr(L, 'm_not_open_lead'), sub: tr(L, 'm_not_open_sub') }
      case 'over':          return { bad: true, text: tr(L, 'b_walkup_over') }
      case 'too_big':       return { bad: true, text: tr(L, 'b_walkup_toobig') }
      case 'no_session':    return { bad: true, text: tr(L, 'd_s_unknown') }
      default:              return { bad: true, text: r.error || tr(L, 'b_failed'), sub: tr(L, 'b_try_again') }
    }
  }

  const go = async () => {
    setWorking(true); setSaid(null)
    try {
      const j = await onGo(name.trim(), party, full)
      if (j?.ok) { setSaid({ bad: false, text: tr(L, 'b_walkup_ok', { name: name.trim() }) }); return }
      // A full session is the one refusal that offers a next step rather than
      // an apology: the owner can let them in over the cap on purpose.
      if (j?.reason === 'full') { setFull(true); setSaid({ bad: true, text: tr(L, 'd_walk_full'), sub: tr(L, 'd_walk_full_sub') }); return }
      setSaid(explain(j))
    } finally { setWorking(false) }
  }

  return (
    <Sheet L={L} title={tr(L, 'd_walk_title')} sub={tr(L, 'd_walk_sub')} onClose={onClose}>
      <input className="dr-wn" value={name} onChange={e => setName(e.target.value)} placeholder={tr(L, 'd_walk_name')}
             autoComplete="off" maxLength={80} />
      <div className="dr-nums">
        {Array.from({ length: partyMax }, (_, i) => i + 1).map(n => (
          <button key={n} className={party === n ? 'is-on' : ''} onClick={() => setParty(n)}>{n}</button>
        ))}
      </div>
      {said && (
        <div className={said.bad ? 'dr-warn' : 'dr-good'} role="status">
          <strong>{said.text}</strong>
          {said.sub && <span>{said.sub}</span>}
        </div>
      )}
      <button className="dr-scan" disabled={!name.trim() || busy || working} onClick={go}>
        {working ? tr(L, 'b_working') : full ? tr(L, 'd_walk_anyway') : tr(L, 'd_walk_go')}
      </button>
      <input type="hidden" value={sessionId} readOnly />
    </Sheet>
  )
}

// ── FIXING A BOOKING ──────────────────────────────────────────────────────
// ⚠ ONE SHEET FOR ALL OF IT. A staff member who has spotted a mistake wants to
// correct it, not choose which kind of correction screen to open. Name, email,
// how many, when — and cancel, behind a confirm.
//
// ⚠ AND IT SAYS WHAT A CORRECTION COSTS. The codes never change, so a guest
// who already screenshotted their ticket is not stranded; and a new address or
// a new time sends a new ticket, which the screen says before it is pressed.
function FixBooking({ L, row, partyMax, onClose }: {
  L: Lang; row: Row; partyMax: number; onClose: () => void
}) {
  const inAlready = !!row.admitted_at
  // ⚠ RESULT, THEN RETURN — the same shape walk-up already had. The sheet used
  // to sit there saying "cancelled" over a booking that no longer existed,
  // with Save still pressable and the fixed backdrop holding the page still.
  const [leaving, setLeaving] = useState(false)
  // ⚠ ONE PRESS ONLY. A second tap on a slow connection used to send a second
  // cancel; the database is idempotent about it but the screen was not.
  const settled = useRef(false)
  const goBack = useCallback((ms: number) => {
    settled.current = true
    setLeaving(true)
    setTimeout(onClose, ms)
  }, [onClose])
  const [name, setName] = useState(row.name)
  const [email, setEmail] = useState(row.email || '')
  const [party, setParty] = useState(row.party_size)
  const [session, setSession] = useState<string | null>(null)
  const [rooms, setRooms] = useState<{ session_id: string; starts_at: string; places_left: number }[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<{ bad: boolean; text: string; sub?: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const post = async (payload: Record<string, unknown>, which: string) => {
    setBusy(which); setSaid(null)
    try {
      const r = await fetch('/api/kiosk/popup/door', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setSaid({ bad: true, text: j.error || tr(L, 'b_failed'), sub: tr(L, 'b_try_again') }); return null }
      return j
    } catch {
      setSaid({ bad: true, text: tr(L, 'd_off_title'), sub: tr(L, 'd_off_sub') })
      return null
    } finally { setBusy(null) }
  }

  const save = async () => {
    const j = await post({ action: 'fix', booking_id: row.booking_id,
      name, email, party, session_id: session }, 'save')
    if (!j) return
    if (!j.ok) {
      if (j.reason === 'already_in') { setSaid({ bad: true, text: tr(L, 'f_already_in') }); return }
      if (j.reason === 'duplicate') {
        setSaid({ bad: true, text: tr(L, 'f_dupe', { time: hhmm(j.clash_at) }) }); return
      }
      if (j.reason === 'full' || j.reason === 'closed') {
        setRooms(j.alternatives || [])
        setSaid({ bad: true, text: tr(L, 'f_full_here', { n: party }),
                  sub: (j.alternatives || []).length ? tr(L, 'f_try_these') : undefined })
        return
      }
      setSaid({ bad: true, text: tr(L, 'b_failed'), sub: tr(L, 'b_try_again') }); return
    }
    if (!j.changed?.length) { setSaid({ bad: false, text: tr(L, 'f_nothing') }); return }
    const moved = (j.changed as string[]).includes('session')
    setSaid({ bad: false,
      text: moved ? tr(L, 'w_moved_to', { time: hhmm(j.starts_at) })
        : j.resend && j.emailed ? tr(L, 'f_saved_sent') : tr(L, 'f_saved'),
      sub: j.resend && j.emailed === false ? (j.email_error || '') : tr(L, 'f_codes_same') })
    setRooms(null); setSession(null)
    // ⚠ A MOVE GOES BACK, A SPELLING STAYS. Changing the time changes which
    // list the guest is on, so the list is the only place the change can be
    // seen — and the two now behave alike. Correcting a name changes nothing
    // she needs to go and look at.
    if (moved) goBack(1200)
  }

  // ⚠ NO FIELDS AND NO SAVE on something that is already gone. Reached from a
  // four-digit lookup or a stale link, it says what it is and offers one way
  // out — a form here would let Save act on a cancelled booking.
  if (row.status === 'cancelled') {
    return (
      <Sheet L={L} title={tr(L, 'd_s_cancelled')} sub={tr(L, 'f_is_cancelled')}
             onClose={onClose} closeLabel={tr(L, 'k_back')}>
        <div className="dr-found-name">{row.name}</div>
        <div className="dr-found-meta">{hhmm(row.starts_at)}</div>
      </Sheet>
    )
  }

  return (
    <Sheet L={L} title={tr(L, 'f_title')} sub={inAlready ? tr(L, 'f_already_in') : `${row.door_code ?? ''}`} onClose={onClose}>
      <label className="dr-flabel">{tr(L, 'f_name')}</label>
      <input className="dr-wn" value={name} maxLength={80} onChange={e => setName(e.target.value)} autoComplete="off" />

      <label className="dr-flabel">{tr(L, 'f_email')}</label>
      <input className="dr-wn" value={email} maxLength={120} inputMode="email" disabled={inAlready}
             onChange={e => setEmail(e.target.value)} autoComplete="off" spellCheck={false} />

      {!inAlready && (
        <>
          <label className="dr-flabel">{tr(L, 'f_people')}</label>
          <div className="dr-nums">
            {Array.from({ length: partyMax }, (_, i) => i + 1).map(n => (
              <button key={n} className={party === n ? 'is-on' : ''} onClick={() => setParty(n)}>{n}</button>
            ))}
          </div>
        </>
      )}

      {rooms && rooms.length > 0 && (
        <div className="dr-rooms">
          {rooms.map(x => (
            <button key={x.session_id} className={session === x.session_id ? 'is-on' : ''}
                    onClick={() => setSession(x.session_id)}>
              {hhmm(x.starts_at)}<em>{tr(L, 's_places', { n: x.places_left })}</em>
            </button>
          ))}
        </div>
      )}

      {said && (
        <div className={said.bad ? 'dr-warn' : 'dr-good'} role="status">
          <strong>{said.text}</strong>{said.sub && <span>{said.sub}</span>}
        </div>
      )}

      <button className="dr-scan" disabled={!!busy || leaving || !name.trim()}
              onClick={() => { if (!settled.current) save() }}>
        {busy === 'save' ? tr(L, 'b_saving') : leaving ? tr(L, 'f_returning') : tr(L, 'f_save')}
      </button>

      <button className="dr-cancel" disabled={!!busy || leaving || !email.trim()} onClick={async () => {
        const j = await post({ action: 'resend', booking_id: row.booking_id }, 'resend')
        if (j) setSaid(j.ok ? { bad: false, text: tr(L, 'f_sent') }
                            : { bad: true, text: j.error || tr(L, 'b_failed') })
      }}>
        {busy === 'resend' ? tr(L, 'b_working') : email.trim() ? tr(L, 'f_resend') : tr(L, 'f_no_email')}
      </button>

      {!inAlready && !leaving && (confirming ? (
        <div className="dr-warn">
          <strong>{tr(L, 'f_cancel_sure')}</strong>
          <div className="dr-row2">
            <button className="dr-cancel" onClick={() => setConfirming(false)}>{tr(L, 'f_cancel_no')}</button>
            <button className="dr-danger" disabled={!!busy || leaving} onClick={async () => {
              if (settled.current) return
              const j = await post({ action: 'fix', booking_id: row.booking_id, cancel: true }, 'cancel')
              if (j?.ok) {
                setSaid({ bad: false, text: tr(L, 'f_cancelled', { name: row.name }) })
                setConfirming(false)
                goBack(900)
              }
            }}>{busy === 'cancel' ? tr(L, 'b_working') : tr(L, 'f_cancel_yes')}</button>
          </div>
        </div>
      ) : (
        <button className="dr-danger" onClick={() => setConfirming(true)}>{tr(L, 'f_cancel_b')}</button>
      ))}
    </Sheet>
  )
}

function Sheet({ L, title, sub, children, onClose, closeLabel }: {
  L: Lang; title: string; sub?: string; children: React.ReactNode
  onClose: () => void; closeLabel?: string
}) {
  return (
    <div className="dr-sheet-bg" onClick={onClose}>
      <div className="dr-sheet" onClick={e => e.stopPropagation()}>
        <div className="dr-sheet-h">{title}</div>
        {sub && <div className="dr-sheet-s">{sub}</div>}
        {children}
        {/* ⚠ "Cancel" IS THE WRONG WORD ON A CANCELLED BOOKING. The sheet's
            own way out is normally "Cancel" — on the screen that says a
            booking is already cancelled, that reads as cancelling it again. */}
        <button className="dr-cancel" onClick={onClose}>{closeLabel ?? tr(L, 'd_cancel')}</button>
      </div>
    </div>
  )
}

// ── THE PIN, the same one the sign-up screen asks for ─────────────────────
function PinGate({ onIn }: { onIn: () => void }) {
  const { lang, setLang } = useLang()
  const L = lang as Lang
  const [staff, setStaff] = useState<{ id: string; display_name: string }[]>([])
  const [who, setWho] = useState<{ id: string; display_name: string } | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    fetch('/api/kiosk/staff/roster').then(r => r.json()).then(j => setStaff(j.staff || [])).catch(() => {})
  }, [])
  const go = async () => {
    const r = await fetch('/api/kiosk/staff/pick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_member_id: who?.id, pin }) })
    setPin('')
    if (r.ok) onIn()
    else setErr((await r.json().catch(() => ({})))?.error || tr(L, 'd_wrong_pin'))
  }
  return (
    <main className="dr">
      <div className="dr-lang dr-lang-top">
        {(['en', 'vn'] as Lang[]).map(l => (
          <button key={l} className={L === l ? 'is-on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <h1 className="dr-h">{tr(L, 'd_title')}</h1>
      {!who ? (
        <>
          <p className="dr-lead">{tr(L, 'd_who')}</p>
          <div className="dr-staff">
            {staff.map(s => <button key={s.id} onClick={() => setWho(s)}>{s.display_name}</button>)}
          </div>
        </>
      ) : (
        <>
          <p className="dr-lead">{tr(L, 'd_your_pin', { name: who.display_name })}</p>
          <input className="dr-pin" type="password" inputMode="numeric" value={pin} autoFocus
                 autoComplete="off" onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          {err && <div className="dr-bad"><strong>{err}</strong></div>}
          <button className="dr-scan" disabled={pin.length < 4} onClick={go}>{tr(L, 'd_open')}</button>
          <button className="dr-cancel" onClick={() => { setWho(null); setErr('') }}>{tr(L, 'd_someone_else')}</button>
        </>
      )}
      <Styles />
    </main>
  )
}

const INK = '#052E20', PAPER = '#E5D4C2', GOLD = '#C9A84C', RED = '#C27070', GREEN = '#7FA86B'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: `
    /* A DARK DOOR, deliberately: it is used outdoors after dark, and a cream
       page at full brightness is a torch pointed at the guest. Sized for one
       thumb at 390px; nothing below 44px. */
    .dr { min-height: var(--pk-vh, 100dvh); background: ${INK}; color: ${PAPER};
          padding: 12px 14px calc(28px + var(--pk-kb, 0px)); box-sizing: border-box;
          font-family: ${MONO}; }
    .dr-top { display: flex; align-items: flex-start; justify-content: space-between;
              gap: 10px; padding-bottom: 10px; border-bottom: 1px solid ${PAPER}26; }
    .dr-who { font-family: ${SERIF}; font-size: 15px; letter-spacing: .1em; text-transform: uppercase; }
    .dr-on { display: block; font-style: normal; font-family: ${MONO}; font-size: 10px;
             letter-spacing: .1em; color: ${GOLD}; margin-top: 2px; text-transform: none; }
    .dr-when { font-size: 12px; opacity: .72; margin-top: 3px; letter-spacing: .04em; }
    .dr-when b { font-size: 16px; opacity: 1; }
    .dr-groups { display: flex; gap: 18px; margin-top: 5px; }
    .dr-groups span { display: flex; flex-direction: column; gap: 1px; }
    .dr-groups em { font-style: normal; font-size: 9px; letter-spacing: .18em;
                    text-transform: uppercase; opacity: .55; }
    .dr-groups b { font-family: ${SERIF}; font-size: 24px; line-height: 1; }
    .dr-groups i { font-style: normal; font-size: 10px; opacity: .7; }
    .dr-net { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: .8;
              flex-wrap: wrap; justify-content: flex-end; }
    .dr-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dr-dot.is-on { background: ${GREEN}; } .dr-dot.is-off { background: ${RED}; }
    .dr-q { background: ${GOLD}; color: ${INK}; padding: 2px 7px; border-radius: 3px; font-size: 10px; }

    .dr-h { font-family: ${SERIF}; font-size: clamp(28px, 8vw, 44px); margin: 10px 0 4px; font-weight: 400; }
    .dr-lead { font-size: 15px; opacity: .78; margin: 0 0 18px; }

    .dr-scan { width: 100%; min-height: 64px; margin: 12px 0 8px; border: none; border-radius: 10px;
               background: ${GOLD}; color: ${INK}; font-family: ${SERIF}; font-size: 19px;
               font-weight: 700; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; }
    .dr-scan[disabled] { opacity: .4; }
    .dr-manual { display: flex; gap: 8px; margin-bottom: 12px; }
    .dr-manual input { flex: 1; min-width: 0; min-height: 52px; box-sizing: border-box;
                       background: ${PAPER}14; border: 1px solid ${PAPER}33; border-radius: 8px;
                       color: ${PAPER}; font-family: ${MONO}; font-size: 18px; letter-spacing: .22em;
                       padding: 10px 12px; text-align: center; outline: none; }
    .dr-manual input::placeholder { letter-spacing: .04em; font-size: 11px; opacity: .5; }
    .dr-manual button { flex: 0 0 72px; min-height: 52px; border-radius: 8px; border: none;
                        background: ${PAPER}; color: ${INK}; font-family: ${SERIF};
                        font-size: 15px; letter-spacing: .1em; text-transform: uppercase; }
    .dr-manual button[disabled] { opacity: .35; }

    .dr-search { width: 100%; box-sizing: border-box; min-height: 52px; margin: 6px 0 14px;
                 background: ${PAPER}14; border: 1px solid ${PAPER}33; border-radius: 8px;
                 color: ${PAPER}; font-family: ${MONO}; font-size: 16px; padding: 10px 14px; outline: none; }
    .dr-search::placeholder { opacity: .45; font-size: 13px; }

    .dr-grp { margin-bottom: 18px; }
    .dr-grp.is-live { outline: 2px solid ${GOLD}; outline-offset: 6px; border-radius: 4px; }
    .dr-grp.is-done { opacity: .62; }
    .dr-grp.is-done .dr-grp-h { cursor: pointer; min-height: 48px; align-items: center; }
    .dr-grp-t em { font-style: normal; font-family: ${MONO}; font-size: 11px;
                   opacity: .6; margin-left: 10px; letter-spacing: .04em; }
    .dr-grp-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
                padding: 6px 0; border-bottom: 1px solid ${PAPER}1f; margin-bottom: 4px; }
    .dr-grp-t { font-family: ${SERIF}; font-size: 24px; }
    .dr-grp-n { font-size: 11px; opacity: .62; text-align: right; }
    .dr-empty { font-size: 12px; opacity: .4; padding: 10px 2px; }

    .dr-row { display: flex; align-items: center; gap: 10px; padding: 10px 0;
              border-bottom: 1px solid ${PAPER}12; }
    .dr-row-l { flex: 1; min-width: 0; }
    .dr-name { font-size: 17px; line-height: 1.25; word-break: break-word; }
    .dr-meta { font-size: 11px; opacity: .58; margin-top: 2px; line-height: 1.5; }
    .dr-code { opacity: .4; margin-left: 8px; letter-spacing: .12em; }
    .dr-row.is-in { opacity: .55; }
    .dr-row.is-in .dr-name { text-decoration: line-through; text-decoration-thickness: 1px; }
    .dr-row.is-wait .dr-name { font-style: italic; }
    .dr-admit { flex: 0 0 auto; min-width: 86px; min-height: 48px; border: none; border-radius: 8px;
                background: ${GREEN}; color: ${INK}; font-family: ${SERIF}; font-size: 14px;
                letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
    .dr-admit[disabled] { opacity: .3; }
    .dr-undo-s { flex: 0 0 auto; min-width: 86px; min-height: 48px; border-radius: 8px;
                 background: none; border: 1px solid ${PAPER}3d; color: ${PAPER};
                 font-family: ${SERIF}; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; }
    .dr-mini { display: flex; gap: 5px; align-items: center; margin-top: 6px; }
    .dr-mini button { min-width: 44px; min-height: 44px; border-radius: 6px; background: none;
                      border: 1px solid ${PAPER}33; color: ${PAPER}; font-family: ${MONO}; font-size: 15px; }
    .dr-mini button.is-on { background: ${PAPER}; color: ${INK}; border-color: ${PAPER}; }
    .dr-mini span { font-size: 11px; opacity: .5; }
    .dr-fixlink { display: block; margin-top: 8px; padding: 8px 12px; min-height: 44px;
                  background: none; border: 1px solid ${PAPER}33; border-radius: 7px;
                  color: ${PAPER}; font-family: ${MONO}; font-size: 13px; }
    .dr-fixrow { margin-top: 6px; min-height: 38px; padding: 4px 10px; font-size: 11px; opacity: .72; }
    .dr-walk { width: 100%; min-height: 48px; margin-top: 10px; background: none;
               border: 1px dashed ${PAPER}33; border-radius: 8px; color: ${PAPER};
               font-family: ${MONO}; font-size: 13px; }

    /* ⚠ THE ANSWER FILLS THE TOP OF THE SCREEN. Icon first, words under it. */
    .dr-result { position: relative; margin: 10px 0 14px; padding: 18px 16px 20px;
                 border-radius: 12px; text-align: center; border: 2px solid transparent; }
    .dr-icon { display: block; width: 112px; height: 112px; margin: 2px auto 10px; }
    .dr-result.is-yes { background: ${GREEN}2e; border-color: ${GREEN}; color: #A8D48F; }
    .dr-result.is-yes .dr-r-h { color: #BFE3A8; }
    .dr-result.is-no  { background: ${RED}2e;   border-color: ${RED};   color: #F0B3B3; }
    .dr-result.is-no .dr-r-h { color: #F4C4C4; }
    .dr-r-big { font-size: 17px !important; opacity: 1 !important; margin-top: 10px !important;
                line-height: 1.45; }
    .dr-result .dr-found-go { margin-top: 14px; }
    .dr-result .dr-undo { margin-top: 14px; }
    /* ⚠ THE ANSWER IS THE BIGGEST THING ON THE SCREEN. She reads it at a
       glance with somebody waiting in front of her, and the colour says it
       before the words do. */
    .dr-r-h { font-family: ${SERIF}; font-size: clamp(30px, 9vw, 42px); line-height: 1.02;
              letter-spacing: .01em; }
    .dr-r-name { font-size: 19px; margin-top: 6px; word-break: break-word; }
    .dr-r-sub { font-size: 13px; opacity: .78; margin-top: 6px; line-height: 1.5; }
    .dr-x { position: absolute; top: 4px; right: 6px; width: 44px; height: 44px; background: none;
            border: none; color: ${PAPER}; font-size: 26px; opacity: .55; }
    .dr-undo { margin-top: 12px; min-height: 44px; padding: 0 16px; border-radius: 6px;
               background: none; border: 1px solid ${PAPER}3d; color: ${PAPER}; font-family: ${MONO}; font-size: 13px; }

    .dr-bad, .dr-warn { display: flex; flex-direction: column; gap: 4px; margin: 10px 0;
                        padding: 14px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
    .dr-bad { background: ${RED}2e; border-left: 4px solid ${RED}; }
    .dr-good { display: flex; flex-direction: column; gap: 4px; margin: 10px 0;
               padding: 14px; border-radius: 8px; font-size: 14px; line-height: 1.5;
               background: ${GREEN}33; border-left: 4px solid ${GREEN}; }
    .dr-good strong { color: #A8D48F; font-size: 16px; }
    .dr-warn { background: ${GOLD}26; border-left: 4px solid ${GOLD}; }
    .dr-bad span, .dr-warn span { opacity: .82; font-size: 12px; }

    .dr-cam { margin: 12px 0; }
    .dr-cam-wrap { position: relative; border-radius: 10px; overflow: hidden; background: #000; }
    .dr-cam video { display: block; width: 100%; aspect-ratio: 1/1; object-fit: cover; }
    /* The aiming square marks EXACTLY the region jsQR is reading — the centre
       square of the frame. A guide that does not match what is decoded is a
       guide that makes people aim wrong. */
    .dr-cam-frame { position: absolute; inset: 14%; border: 2px solid ${GOLD};
                    border-radius: 8px; box-shadow: 0 0 0 100vmax #00000073; }
    .dr-cam-hint { position: absolute; left: 0; right: 0; bottom: 10px; text-align: center;
                   font-family: ${MONO}; font-size: 13px; color: ${PAPER};
                   text-shadow: 0 1px 3px #000; padding: 0 12px; }
    .dr-cam-ask { position: absolute; left: 12px; right: 12px; top: 12px; text-align: center;
                  font-family: ${MONO}; font-size: 12px; line-height: 1.5; color: ${INK};
                  background: ${GOLD}; border-radius: 6px; padding: 8px 10px; }
    .dr-cam-how { position: absolute; top: 6px; right: 8px; font-family: ${MONO};
                  font-size: 9px; letter-spacing: .1em; color: ${PAPER}; opacity: .4; }
    .dr-camerr { display: flex; flex-direction: column; gap: 6px;
                 padding: 18px 14px; border-radius: 8px; background: ${GOLD}26;
                 border-left: 4px solid ${GOLD}; font-size: 14px; line-height: 1.5; }
    .dr-camerr span { font-size: 12px; opacity: .85; }
    .dr-cam button { width: 100%; min-height: 48px; margin-top: 8px; border-radius: 8px;
                     background: none; border: 1px solid ${PAPER}3d; color: ${PAPER}; font-family: ${MONO}; }

    .dr-sheet-bg { position: fixed; inset: 0; background: #000000b8; z-index: 50;
                   display: flex; align-items: flex-end; }
    /* ⚠ THE SHEET SCROLLS, AND THAT IS WHY THE PAGE DOES. The backdrop is
       position:fixed over the whole viewport. A sheet taller than the screen
       overflowed it with nowhere to scroll, so the phone looked frozen — the
       fault reported as "the page can no longer be scrolled" after a cancel.
       Capped and scrollable, it can never exceed the screen.
       ⚠ vh, NOT dvh: the floor of this estate is iOS 13.4, which cannot parse
       dvh at all, and a rule it cannot parse is a rule it drops. */
    .dr-sheet { width: 100%; box-sizing: border-box; background: ${INK}; color: ${PAPER};
                border-top: 3px solid ${GOLD}; border-radius: 14px 14px 0 0;
                padding: 18px 16px calc(20px + env(safe-area-inset-bottom, 0px));
                max-height: 92vh; overflow-y: auto; -webkit-overflow-scrolling: touch;
                overscroll-behavior: contain; }
    @supports (height: 100dvh) { .dr-sheet { max-height: 92dvh; } }
    .dr-sheet-h { font-family: ${SERIF}; font-size: 26px; line-height: 1.1; }
    .dr-sheet-s { font-size: 13px; opacity: .7; margin: 6px 0 14px; line-height: 1.5; }
    .dr-nums { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .dr-nums button { flex: 1 1 64px; min-height: 64px; border-radius: 8px; background: ${PAPER}14;
                      border: 1px solid ${PAPER}33; color: ${PAPER}; font-family: ${SERIF}; font-size: 24px; }
    .dr-nums button.is-on { background: ${PAPER}; color: ${INK}; }
    .dr-wn { width: 100%; box-sizing: border-box; min-height: 56px; margin-bottom: 12px;
             background: ${PAPER}14; border: 1px solid ${PAPER}33; border-radius: 8px;
             color: ${PAPER}; font-family: ${MONO}; font-size: 18px; padding: 10px 14px; outline: none; }
    .dr-flabel { display: block; font-family: ${SERIF}; font-size: 12px; letter-spacing: .14em;
                 text-transform: uppercase; opacity: .6; margin: 12px 0 5px; }
    .dr-rooms { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .dr-rooms button { flex: 1 1 94px; min-height: 58px; border-radius: 8px; background: ${PAPER}14;
                       border: 1px solid ${PAPER}33; color: ${PAPER}; font-family: ${SERIF}; font-size: 20px;
                       display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
    .dr-rooms button em { font-style: normal; font-family: ${MONO}; font-size: 10px; opacity: .7; }
    .dr-rooms button.is-on { background: ${GOLD}; color: ${INK}; border-color: ${GOLD}; }
    .dr-rooms button.is-on em { opacity: .85; }
    .dr-danger { width: 100%; min-height: 50px; margin-top: 10px; border-radius: 8px;
                 background: none; border: 1px solid ${RED}; color: #F0B3B3;
                 font-family: ${MONO}; font-size: 14px; }
    .dr-row2 { display: flex; gap: 8px; margin-top: 10px; }
    .dr-row2 > * { flex: 1; margin-top: 0; }
    .dr-cancel { width: 100%; min-height: 48px; margin-top: 8px; background: none;
                 border: 1px solid ${PAPER}26; border-radius: 8px; color: ${PAPER};
                 font-family: ${MONO}; font-size: 14px; }

    .dr-staff { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
    .dr-staff button { min-height: 60px; border-radius: 8px; background: ${PAPER}14;
                       border: 1px solid ${PAPER}26; color: ${PAPER}; font-family: ${MONO}; font-size: 15px; }
    .dr-pin { width: 100%; box-sizing: border-box; min-height: 68px; font-size: 30px;
              letter-spacing: .4em; text-align: center; border-radius: 8px; margin: 8px 0 14px;
              background: ${PAPER}14; border: 1px solid ${PAPER}33; color: ${PAPER};
              font-family: ${MONO}; outline: none; }
    .dr-lang { display: flex; gap: 2px; justify-content: center; margin-top: 22px; }
    .dr-lang-top { justify-content: flex-end; margin: 0 0 10px; }
    .dr-lang button { min-width: 64px; min-height: 44px; border: 1px solid ${PAPER}2e;
                      background: none; color: ${PAPER}; font-family: ${MONO}; font-size: 14px;
                      letter-spacing: .1em; }
    .dr-lang button.is-on { background: ${PAPER}; color: ${INK}; border-color: ${PAPER}; }
    .dr-home { min-height: 48px; padding: 0 2px; margin-bottom: 2px; background: none;
               border: none; color: ${PAPER}; font-family: ${MONO}; font-size: 15px; opacity: .8; }
    .dr-manual input { letter-spacing: .3em; font-size: 24px; }
    .dr-found { position: relative; margin: 10px 0 14px; padding: 18px 16px; border-radius: 10px;
                background: ${GOLD}1f; border-left: 4px solid ${GOLD}; }
    .dr-found-ask { font-family: ${SERIF}; font-size: 20px; color: ${GOLD};
                    letter-spacing: .06em; margin-bottom: 10px; }
    .dr-found-name { font-size: 26px; line-height: 1.2; word-break: break-word; }
    .dr-found-meta { font-size: 14px; opacity: .8; margin-top: 4px; }
    .dr-found-sub { font-size: 12px; opacity: .68; margin-top: 8px; line-height: 1.5; }
    .dr-found-go { width: 100%; min-height: 60px; margin-top: 14px; border: none; border-radius: 8px;
                   background: ${GREEN}; color: ${INK}; font-family: ${SERIF}; font-size: 17px;
                   letter-spacing: .1em; text-transform: uppercase; }
    .dr-found-already { margin-top: 12px; font-size: 14px; line-height: 1.5;
                        padding: 12px 14px; border-radius: 8px; background: ${INK}; color: ${PAPER}; }
    .dr-orlabel { font-family: ${SERIF}; font-size: 12px; letter-spacing: .16em;
                  text-transform: uppercase; opacity: .55; margin: 14px 0 6px; }
    .dr-out { width: 100%; min-height: 48px; margin-top: 10px; background: none;
              border: 1px solid ${PAPER}26; border-radius: 8px; color: ${PAPER};
              font-family: ${MONO}; font-size: 13px; opacity: .7; }
  ` }} />
}
