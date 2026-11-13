'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// THE RUN SHEET — what the owner watches the evening by.
// ───────────────────────────────────────────────────────────────────────────
// Nine sessions, the cap, the two switches, and whether each staff phone is
// actually talking to us. It is the only screen that carries guest names, and
// the only one that can change a cap.
//
// ══ THE TWO RULES IT EXISTS TO MAKE VISIBLE ══════════════════════════════
// · RAISING THE CAP PROMOTES AT ONCE. Not on a timer, not on the next page
//   load — in the same request, under the same lock, and the promoted names
//   come back so they can be told. A waiting list that fills "soon" is a
//   waiting list nobody trusts.
// · LOWERING THE CAP CANCELS NOBODY. It marks the session over capacity and
//   shows who is last in. The decision is the owner's: move them, waitlist
//   them, or leave the session over and tell the floor. THE DOOR NEVER
//   CONSULTS THE CAP, so nothing is turned away by a number changing.
// ═══════════════════════════════════════════════════════════════════════════

interface Sess {
  session_id: string; idx: number; starts_at: string; ends_at: string
  cap: number; booked: number; parties: number; arrived: number
  no_show: number; waiting: number; over_by: number; closed: boolean; ticked: number
}
interface B {
  id: string; name: string; email: string | null; party_size: number; status: string
  ticket_code: string; door_code: string | null; session_id: string; admitted_at: string | null
  admitted_by: string | null; admitted_party: number | null
  created_at: string; waiting_since: string | null; source: string
  consent_marketing: boolean; confirmation_sent_at: string | null; taken_by: string | null
}
interface Dl { kind: string; rows_out: number; by_email: string | null; at: string }
interface Phone { id: string; label: string; paired: boolean; last_seen_at: string | null; seconds_ago: number | null; online: boolean; practice: boolean }
interface Ev {
  id: string; title_en: string; venue_en: string; event_date: string
  default_cap: number; party_max: number; published: boolean
  public_bookings: boolean; bookings_paused: boolean
  reminder_lead_minutes: number; admit_early_minutes: number; admit_late_minutes: number
}

const hhmm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB',
  { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) : '--:--'
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

export default function RunSheet() {
  const [ev, setEv] = useState<Ev | null>(null)
  const [sessions, setSessions] = useState<Sess[]>([])
  const [bookings, setBookings] = useState<B[]>([])
  const [phones, setPhones] = useState<Phone[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [capDraft, setCapDraft] = useState('')
  const [practice, setPractice] = useState<{ exists: boolean; bookings: number }>({ exists: false, bookings: 0 })
  const [exports, setExports] = useState<Dl[]>([])
  const [exportsReady, setExportsReady] = useState(true)
  const [edits, setEdits] = useState<{ booking_id: string; field: string; was: string | null
    now_: string | null; by: string | null; at: string }[]>([])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/popup', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Could not read the pop-up.'); return }
      setErr(null); setEv(j.event); setSessions(j.sessions || [])
      setBookings(j.bookings || []); setPhones(j.phones || [])
      setPractice(j.practice || { exists: false, bookings: 0 })
      setExports(j.exports || [])
      setExportsReady(j.exports_ready !== false)
      setEdits(j.edits || [])
      setCapDraft(String(j.event?.default_cap ?? ''))
    } catch { setErr('Could not reach the server.') }
  }, [])
  useEffect(() => { load() }, [load])
  // Six seconds: fast enough that the owner sees a tick from the door while
  // still looking at the screen, slow enough to be invisible.
  useEffect(() => { const t = setInterval(load, 6_000); return () => clearInterval(t) }, [load])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(t) }, [])

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/popup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setMsg(j.error || 'That did not work.')
      await load()
      return j
    } finally { setBusy(false) }
  }, [load])

  const { current, next } = useMemo(() => {
    const t = now
    return {
      current: sessions.find(s => +new Date(s.starts_at) <= t && t <= +new Date(s.ends_at)) || null,
      next: sessions.find(s => +new Date(s.starts_at) > t) || null,
    }
  }, [sessions, now])

  const totals = useMemo(() => sessions.reduce((a, s) => ({
    booked: a.booked + s.booked, arrived: a.arrived + s.arrived,
    waiting: a.waiting + s.waiting, no_show: a.no_show + s.no_show,
  }), { booked: 0, arrived: 0, waiting: 0, no_show: 0 }), [sessions])

  const forSession = (id: string) => bookings.filter(b => b.session_id === id && b.status !== 'cancelled')

  // ── RAISING THE CAP ─────────────────────────────────────────────────────
  const setCap = async (n: number) => {
    const j = await post({ action: 'cap', cap: n })
    if (j?.ok) {
      // ⚠ REPORT WHAT THE SEND ACTUALLY DID. This used to say "they have been
      // emailed their ticket" whether or not anything had been sent — and for
      // a while nothing was.
      setMsg(j.raising
        ? j.promoted?.length
          ? `Cap is ${n}. ${j.promoted.length} promoted off the waiting list · ${j.emailed ?? 0} emailed`
            + `${j.no_email ? ` · ${j.no_email} gave no address — tell them by name` : ''}`
            + `${j.failed?.length ? ` · ⚠ ${j.failed.length} COULD NOT BE EMAILED` : ''}`
          : `Cap is ${n}. Nobody was waiting.`
        : `Cap is ${n}. NOBODY HAS BEEN CANCELLED — any session now over capacity is marked below for you to decide.`)
    }
  }

  // ⚠ FETCHED, NOT A PLAIN LINK. An <a download> that comes back 500 lands
  //   the browser on an error page or, worse, saves the JSON as a .csv. This
  //   way a refusal — the register not being there — is said on this screen
  //   and nothing is saved.
  const download = async (kind: 'all' | 'consented') => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/admin/popup/export?kind=${kind}`, { cache: 'no-store' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setMsg(j.error || 'The export failed. Nothing was downloaded.')
        return
      }
      const blob = await r.blob()
      const cd = r.headers.get('Content-Disposition') || ''
      const file = (cd.match(/filename="([^"]+)"/) || [])[1] || `rampant-popup-${kind}.csv`
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url; el.download = file
      document.body.appendChild(el); el.click(); el.remove()
      URL.revokeObjectURL(url)
      const n = r.headers.get('X-Rows') ?? '?'
      setMsg(`${file} — ${n} guest${n === '1' ? '' : 's'}. The download is on the register below.`)
      load()
    } catch {
      setMsg('The export could not be reached. Nothing was downloaded.')
    } finally { setBusy(false) }
  }

  if (err) return <Frame><div style={bad}>{err}</div></Frame>
  if (!ev) return <Frame><div style={muted}>Reading the evening…</div></Frame>

  const over = sessions.filter(s => s.over_by > 0)

  return (
    <Frame>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, color: '#E5D4C2', margin: 0 }}>{ev.title_en}</h1>
        <Link href="/admin/popup/print" style={link}>Printable door sheets →</Link>
      </div>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', margin: '4px 0 20px' }}>
        {ev.venue_en} · {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {msg && <div style={banner} onClick={() => setMsg(null)}>{msg}</div>}

      {/* ── NOW AND NEXT, LARGE ───────────────────────────────────────── */}
      <div style={nowNext}>
        <div>
          <div style={eyebrow}>In now</div>
          <div style={bigTime}>{current ? hhmm(current.starts_at) : '—'}</div>
          <div style={sub}>{current ? `${current.arrived} of ${current.booked} in · ${current.parties} ${current.parties === 1 ? 'booking' : 'bookings'}` : 'No session running'}</div>
        </div>
        <div>
          <div style={eyebrow}>Next</div>
          <div style={{ ...bigTime, color: '#B2AA98' }}>{next ? hhmm(next.starts_at) : '—'}</div>
          <div style={sub}>{next ? `${next.booked} booked of ${next.cap}${next.waiting ? ` · ${next.waiting} waiting` : ''}` : 'Nothing left tonight'}</div>
        </div>
        <div>
          <div style={eyebrow}>Tonight</div>
          <div style={{ ...bigTime, fontSize: 40 }}>{totals.arrived}<span style={{ fontSize: 20, opacity: .5 }}>/{totals.booked}</span></div>
          <div style={sub}>{totals.waiting} waiting · {totals.no_show} no-show</div>
        </div>
      </div>

      {/* ── PRACTICE ──────────────────────────────────────────────────── */}
      {/* ⚠ FIRST ON THE PAGE TONIGHT, because the real evening is unpublished
          and a phone pointed at it shows no sessions at all — which is what
          the first staff member handed one actually saw. */}
      <div style={sectionLabel}>Practice</div>
      <div style={{ ...card, ...(practice.exists ? {} : { borderColor: '#C9A84C' }) }}>
        {!practice.exists ? (
          <>
            <b style={{ fontFamily: SERIF, color: '#E5D4C2' }}>There is no practice evening yet.</b>
            <p style={{ ...muted, margin: '6px 0 0' }}>
              Run <code>db/popup_practice.sql</code> and reload this page. It creates a whole evening
              of nine sessions, marked PRACTICE on every screen, that you can switch any phone to.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button disabled={busy} style={{ ...btn, ...btnOn }} onClick={async () => {
                const j = await post({ action: 'practice_reset' })
                if (j?.ok) setMsg(`Practice reset — ${j.bookings_removed} booking(s) cleared, ${j.sessions} sessions now running from ${hhmm(j.first_at)}.`)
              }}>Wipe and restart practice</button>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98' }}>
                {practice.bookings} practice booking{practice.bookings === 1 ? '' : 's'}
              </span>
              {/* ⚠ ALL OF THEM AT ONCE. Five handsets, five people, one tap —
                  and it names the phones that moved rather than saying "done". */}
              <button disabled={busy || !phones.length} style={btn} onClick={async () => {
                const j = await post({ action: 'practice_all', practice: true })
                if (j?.ok) setMsg(`${j.moved.length} phone(s) now on PRACTICE: ${j.moved.join(', ')}. Reload each one.`)
              }}>All phones → practice</button>
              <button disabled={busy || !phones.length} style={btn} onClick={async () => {
                const j = await post({ action: 'practice_all', practice: false })
                if (j?.ok) setMsg(`${j.moved.length} phone(s) back on the real evening: ${j.moved.join(', ')}. Reload each one.`)
              }}>All phones → real evening</button>
            </div>
            <p style={{ ...muted, marginTop: 10 }}>
              One control. It clears every practice booking and re-times the nine sessions to run from
              now, so the grid is always live enough to rehearse on. It <b style={{ color: '#E5D4C2' }}>cannot
              touch Friday</b> — the database refuses any event not marked as practice.
              Emails are real: whatever address is typed receives a real ticket.
            </p>
          </>
        )}
      </div>

      {/* ── THE PHONES ────────────────────────────────────────────────── */}
      <div style={sectionLabel}>Staff phones</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {phones.length === 0 && (
          <div style={muted}>
            None paired yet. Admin → Kiosk &amp; Staff PINs → add a device, kind &ldquo;Pop-up staff phone&rdquo;,
            named after whoever is carrying it.
          </div>
        )}
        {phones.map(p => (
          <div key={p.id} style={{ ...chip, borderColor: p.practice ? '#C9A84C' : p.online ? '#7FA86B' : '#C27070',
                                   flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: p.online ? '#7FA86B' : '#C27070' }} />
              <b>{p.label}</b>
              {/* The mode, in the heartbeat list, so it is visible without
                  opening anything. */}
              <span style={{ fontSize: 9, letterSpacing: '.1em', padding: '2px 6px', borderRadius: 3,
                             background: p.practice ? '#C9A84C' : '#7FA86B', color: '#052E20' }}>
                {p.practice ? 'PRACTICE' : 'REAL'}
              </span>
              <span style={{ opacity: .6 }}>
                {p.online ? `${p.seconds_ago}s ago` : p.last_seen_at ? `quiet ${Math.round((p.seconds_ago || 0) / 60)} min` : 'never'}
              </span>
            </div>
            {/* Per handset. One can rehearse while another takes real names. */}
            <button disabled={busy || !practice.exists} style={{ ...btn, ...(p.practice ? btnOn : {}), minHeight: 30, fontSize: 11 }}
                    onClick={async () => {
                      const j = await post({ action: 'practice_device', device_id: p.id, practice: !p.practice })
                      if (j?.ok) setMsg(`${p.label} is now on the ${j.practice ? 'PRACTICE' : 'real'} evening. Reload that phone.`)
                    }}>
              {p.practice ? 'ON PRACTICE — switch to the real evening' : 'Switch to practice'}
            </button>
          </div>
        ))}
      </div>
      {/* ⚠ "Online" means asked us something recently, not switched on. A phone
          sitting on a finished screen goes quiet and is not broken. */}
      <div style={{ ...muted, marginTop: -16, marginBottom: 22 }}>
        A phone counts as online if it has asked us for something in the last 90 seconds. One left on a
        finished screen goes quiet without being broken.
      </div>

      {/* ── THE CAP ───────────────────────────────────────────────────── */}
      <div style={sectionLabel}>Capacity</div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98' }}>Every session:</span>
          {[4, 6, 8, 10, 12].map(n => (
            <button key={n} onClick={() => setCap(n)} disabled={busy}
                    style={{ ...btn, ...(ev.default_cap === n ? btnOn : {}) }}>{n}</button>
          ))}
          <input value={capDraft} onChange={e => setCapDraft(e.target.value.replace(/\D/g, ''))}
                 style={{ ...input, width: 70, textAlign: 'center' }} />
          <button onClick={() => setCap(Number(capDraft))} disabled={busy || !capDraft} style={btn}>Set</button>
        </div>
        <p style={{ ...muted, marginTop: 12 }}>
          Raising it promotes the waiting list immediately and emails whoever moves up.
          Lowering it <b style={{ color: '#E5D4C2' }}>cancels nobody</b> — any session that ends up over
          capacity is marked below and left to you.
        </p>
      </div>

      {over.length > 0 && (
        <div style={{ ...card, borderColor: '#C9A84C', background: '#C9A84C14' }}>
          <b style={{ fontFamily: SERIF, color: '#E5D4C2' }}>
            {over.length} session{over.length === 1 ? ' is' : 's are'} over capacity.
          </b>
          <p style={{ ...muted, margin: '6px 0 0' }}>
            Nobody has been removed. The last booking taken in each is shown first when you open it,
            so you can move or cancel by hand — or leave it over and tell the floor.
          </p>
        </div>
      )}

      {/* ── THE SWITCHES ──────────────────────────────────────────────── */}
      <div style={sectionLabel}>Switches</div>
      <div style={card}>
        <Toggle on={ev.published} label="Published"
                note="Off, the phones show “ask a member of staff” rather than an empty list."
                onClick={() => post({ action: 'event', fields: { published: !ev.published } })} busy={busy} />
        <Toggle on={ev.bookings_paused} danger label="Bookings paused"
                note="Stops new sign-ups at once. The door is unaffected — nobody already booked is turned away."
                onClick={() => post({ action: 'event', fields: { bookings_paused: !ev.bookings_paused } })} busy={busy} />
        <Toggle on={ev.public_bookings} label="Public booking page"
                note="Off by default. The phones are the way in."
                onClick={() => post({ action: 'event', fields: { public_bookings: !ev.public_bookings } })} busy={busy} />
      </div>

      {/* ── THE GUEST LIST AS A FILE ──────────────────────────────────── */}
      {/* ⚠ THE ONLY CONTROL ON THIS PAGE THAT PUTS GUEST EMAILS SOMEWHERE WE
          CANNOT REACH THEM AGAIN. Every press is recorded with a name and a
          time, and the register is shown here rather than hidden in a table,
          because a log nobody sees is not a control. */}
      <div style={sectionLabel}>Export</div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button disabled={busy} style={btn} onClick={() => download('all')}>All guests</button>
          <button disabled={busy} style={btn} onClick={() => download('consented')}>
            Guests who agreed to hear from the club
          </button>
        </div>
        <p style={{ ...muted, marginTop: 12 }}>
          Name, email, party size, session, status, language, who took the booking and the consent
          tick. The second file leaves out anyone who did not tick, anyone with no address, and
          anyone who has <b style={{ color: '#E5D4C2' }}>unsubscribed since</b> — a tick given in
          November is not consent that outlives being asked to stop.
        </p>

        {!exportsReady ? (
          <p style={{ ...muted, marginTop: 10, color: '#C9A84C' }}>
            The download register is missing — run <code>db/popup_exports.sql</code> and reload.
            Until then both buttons refuse: a copy of the guest list that nothing recorded is the
            one thing the register exists to prevent.
          </p>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Downloads</div>
            {exports.length === 0
              ? <div style={muted}>Nobody has taken a copy.</div>
              : exports.map((d, i) => (
                  <div key={i} style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', lineHeight: 1.9 }}>
                    {new Date(d.at).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                    {' · '}{d.kind === 'consented' ? 'agreed to hear from the club' : 'all guests'}
                    {' · '}{d.rows_out} row{d.rows_out === 1 ? '' : 's'}
                    {' · '}{d.by_email || 'unknown account'}
                  </div>
                ))}
          </div>
        )}
      </div>

      {/* ── THE NINE ──────────────────────────────────────────────────── */}
      <div style={sectionLabel}>The evening</div>
      {sessions.map(s => {
        const live = current?.session_id === s.session_id
        const done = +new Date(s.ends_at) < now
        const rows = forSession(s.session_id)
        const isOpen = open === s.session_id
        return (
          <div key={s.session_id} style={{ ...row, ...(live ? { borderColor: '#C9A84C', background: '#C9A84C0f' } : {}), ...(done ? { opacity: .6 } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', cursor: 'pointer' }}
                 onClick={() => setOpen(isOpen ? null : s.session_id)}>
              <span style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2', minWidth: 76 }}>{hhmm(s.starts_at)}</span>
              <Stat n={s.booked} of={s.cap} label="booked" warn={s.over_by > 0} />
              <Stat n={s.arrived} label="arrived" />
              {done && <Stat n={s.no_show} label="no-show" warn={s.no_show > 0} />}
              {s.waiting > 0 && <Stat n={s.waiting} label="waiting" />}
              {s.over_by > 0 && <span style={pillWarn}>OVER BY {s.over_by}</span>}
              {s.closed && <span style={pillWarn}>CLOSED</span>}
              {live && <span style={pillLive}>IN NOW</span>}
              <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: '#7E7864' }}>
                {isOpen ? 'hide' : `${rows.length} name${rows.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, borderTop: '1px solid #ffffff14', paddingTop: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98' }}>This session only:</span>
                  {[null, 4, 6, 8, 10, 12].map(n => (
                    <button key={String(n)} disabled={busy} style={btn}
                            onClick={() => post({ action: 'session_cap', session_id: s.session_id, cap: n })}>
                      {n === null ? 'use the event cap' : n}
                    </button>
                  ))}
                  <button disabled={busy} style={{ ...btn, marginLeft: 'auto' }}
                          onClick={() => post({ action: 'close_session', session_id: s.session_id, closed: !s.closed })}>
                    {s.closed ? 'Re-open' : 'Close'}
                  </button>
                </div>
                {rows.length === 0 && <div style={muted}>Nobody booked.</div>}
                {/* ⚠ LAST IN, FIRST SHOWN when the session is over capacity:
                    the booking to move is almost always the most recent one. */}
                {[...rows].sort((a, b) => s.over_by > 0
                    ? +new Date(b.created_at) - +new Date(a.created_at)
                    : a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                  .map(b => (
                  <div key={b.id} style={guest}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#E5D4C2', fontSize: 14 }}>
                        {b.name}
                        {b.status === 'waiting' && <span style={pillWait}>WAITING</span>}
                        {b.admitted_at && <span style={pillIn}>IN {hhmm(b.admitted_at)}{b.admitted_party != null ? ` · ${b.admitted_party}` : ''}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#7E7864', marginTop: 2 }}>
                        {b.party_size > 1 ? `party of ${b.party_size}` : 'one'}
                        {b.email ? ` · ${b.email}` : ' · no email'}
                        {b.taken_by ? ` · taken by ${b.taken_by}` : ''}
                        {b.source === 'door' ? ' · walk-up' : ''}
                        {' · code '}<b style={{ color: '#E5D4C2', letterSpacing: '.12em' }}>{b.door_code || b.ticket_code}</b>
                      </div>
                    </div>
                    <select disabled={busy} value="" style={{ ...input, width: 128, fontSize: 10 }}
                            onChange={e => { if (e.target.value) post({ action: 'move', booking_id: b.id, session_id: e.target.value }) }}>
                      <option value="">move to…</option>
                      {sessions.filter(x => x.session_id !== s.session_id)
                        .map(x => <option key={x.session_id} value={x.session_id}>{hhmm(x.starts_at)} ({x.booked}/{x.cap})</option>)}
                    </select>
                    <button disabled={busy} style={btnBad}
                            onClick={() => { if (confirm(`Cancel ${b.name}'s place? They are not told automatically.`)) post({ action: 'cancel', booking_id: b.id }) }}>
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* ── WHAT STAFF HAVE CORRECTED ───────────────────────────────────
          A change made on a phone at the door is invisible to whoever is
          running the evening unless it is shown. */}
      {edits.length > 0 && (
        <>
          <div style={sectionLabel}>Corrections ({edits.length})</div>
          <div style={card}>
            {edits.slice(0, 14).map((e, i) => {
              const who = bookings.find(b => b.id === e.booking_id)
              return (
                <div key={i} style={{ ...guest, borderBottom: i === 13 ? 'none' : guest.borderBottom }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', minWidth: 44 }}>{hhmm(e.at)}</span>
                  <span style={{ flex: 1, fontFamily: MONO, fontSize: 11, color: '#B2AA98' }}>
                    <b style={{ color: '#E5D4C2' }}>{who?.name || '—'}</b>
                    {' · '}{e.field}
                    {e.was != null && <> · <s style={{ opacity: .6 }}>{e.was || '(none)'}</s></>}
                    {e.now_ != null && <> → <b style={{ color: '#E5D4C2' }}>{e.now_}</b></>}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#C9A84C' }}>{e.by}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
        <button disabled={busy} style={btn} onClick={async () => {
          const j = await post({ action: 'promote_all' })
          if (j?.ok) setMsg(j.promoted?.length ? `${j.promoted.length} promoted off the waiting list.` : 'Nobody could be promoted.')
        }}>Walk the waiting list</button>
      </div>
    </Frame>
  )
}

function Stat({ n, of, label, warn }: { n: number; of?: number; label: string; warn?: boolean }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, color: warn ? '#C9A84C' : '#B2AA98' }}>
      <b style={{ fontSize: 15, color: warn ? '#C9A84C' : '#E5D4C2' }}>{n}</b>
      {of != null && <span style={{ opacity: .5 }}>/{of}</span>} {label}
    </span>
  )
}

function Toggle({ on, label, note, onClick, busy, danger }: {
  on: boolean; label: string; note: string; onClick: () => void; busy: boolean; danger?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0' }}>
      <button onClick={onClick} disabled={busy}
              style={{ ...btn, minWidth: 64, background: on ? (danger ? '#C27070' : '#7FA86B') : 'transparent',
                       color: on ? '#052E20' : '#B2AA98' }}>
        {on ? 'ON' : 'OFF'}
      </button>
      <div>
        <div style={{ fontFamily: SERIF, fontSize: 14, color: '#E5D4C2' }}>{label}</div>
        <div style={{ ...muted, marginTop: 2 }}>{note}</div>
      </div>
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1000 }}>{children}</div>
}

const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#7E7864', margin: '26px 0 10px' }
const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: .75, lineHeight: 1.7, maxWidth: '70ch' }
const bad: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#C27070', padding: 20, border: '1px solid #C27070', borderRadius: 8 }
const banner: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#052E20', background: '#C9A84C', padding: '12px 14px', borderRadius: 6, marginBottom: 16, lineHeight: 1.6, cursor: 'pointer' }
const card: React.CSSProperties = { border: '1px solid #ffffff1f', borderRadius: 8, padding: 16, marginBottom: 14 }
const row: React.CSSProperties = { border: '1px solid #ffffff14', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }
const guest: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #ffffff0a' }
const btn: React.CSSProperties = { minHeight: 34, padding: '0 12px', borderRadius: 5, border: '1px solid #ffffff2e', background: 'transparent', color: '#E5D4C2', fontFamily: MONO, fontSize: 12, cursor: 'pointer' }
const btnOn: React.CSSProperties = { background: '#C9A84C', color: '#052E20', borderColor: '#C9A84C' }
const btnBad: React.CSSProperties = { ...btn, borderColor: '#C2707059', color: '#C27070' }
const input: React.CSSProperties = { minHeight: 34, padding: '0 10px', borderRadius: 5, border: '1px solid #ffffff2e', background: '#ffffff0a', color: '#E5D4C2', fontFamily: MONO, fontSize: 12 }
const chip: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid', borderRadius: 6, fontFamily: MONO, fontSize: 11, color: '#E5D4C2' }
const link: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#C9A84C', textDecoration: 'none' }
const nowNext: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, padding: 18, border: '1px solid #ffffff1f', borderRadius: 8, marginBottom: 6 }
const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7E7864' }
const bigTime: React.CSSProperties = { fontFamily: SERIF, fontSize: 52, lineHeight: 1, color: '#E5D4C2', margin: '4px 0 2px' }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98' }
const pillWarn: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', background: '#C9A84C', color: '#052E20', padding: '2px 6px', borderRadius: 3 }
const pillLive: React.CSSProperties = { ...pillWarn, background: '#7FA86B' }
const pillWait: React.CSSProperties = { ...pillWarn, background: 'transparent', border: '1px solid #C9A84C', color: '#C9A84C', marginLeft: 8 }
const pillIn: React.CSSProperties = { ...pillWarn, background: '#7FA86B', marginLeft: 8 }
