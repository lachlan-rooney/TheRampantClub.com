'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import { tr, timeLabel, type Lang } from '@/lib/popup/strings'

// ═══════════════════════════════════════════════════════════════════════════
// THE STAFF PHONE.  Sign in once, then two jobs.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ THIS SCREEN WAS REBUILT ON 12 NOVEMBER BECAUSE A STAFF MEMBER WAS HANDED
// THE OLD ONE AND COULD NOT SEE WHAT TO DO. She landed straight on a booking
// form; the door was behind a small unlabelled ◆ in the corner and a second
// PIN. Nothing told her the phone did two things.
//
// What replaced it:
//   · ONE HOME SCREEN after the PIN — her name, two large buttons, nothing
//     else. Every job returns here when it is finished.
//   · THE PIN IS ASKED ONCE, when she picks the phone up for the evening.
//     Not between her own two jobs. On a staff phone, staff are the users.
//   · THE SLOT LIST IS THE FIRST THING in a sign-up, every time in order,
//     with its state readable at arm's length.
//
// ══ WHAT IS KEPT FROM THE LOCKED-DOWN VERSION, AND WHY ═══════════════════
// 1 · THE FORM CLEARS COMPLETELY between guests — remounted, not blanked, so
//     no React state, no browser autofill and no scroll position survives.
// 2 · A GUEST HOLDING THE PHONE MID-FORM CANNOT REACH THE DOOR LIST. While a
//     guest's details are on screen the way home is hidden; it comes back on
//     the confirmation screen, which is the moment staff take the phone back.
// 3 · NOTHING IS PROMISED BEFORE POSTGRES HAS WRITTEN IT. No optimistic
//     confirmation, no offline queue on this side: a place has to be real.
// ═══════════════════════════════════════════════════════════════════════════

const IDLE_MS = 45_000          // a half-typed guest does not sit on the phone
const RETRY_FOR_MS = 10_000
const POLL_MS = 8_000

interface Session {
  session_id: string; idx: number; starts_at: string; ends_at: string
  places_left: number; is_full: boolean; closed: boolean; party_max: number
  bookings_paused: boolean
}
interface EventInfo {
  title_en: string; title_vn: string | null
  venue_en: string; venue_vn: string | null
  session_minutes: number; party_max: number; default_cap: number
  published: boolean; paused: boolean; practice: boolean; slug: string
}

// ⚠ WHAT THE PHONE IS ON, IN ONE PLACE. The owner held a practice ticket while
// his phone was set to the real, unpublished evening; every message it gave
// him was misleading because none of them said which list was being used.
function eventLine(L: Lang, ev: EventInfo | null): { name: string; state: string; ok: boolean } {
  if (!ev) return { name: '—', state: '', ok: false }
  if (ev.practice) return { name: tr(L, 'm_practice'), state: tr(L, 'm_open'), ok: true }
  const name = (L === 'vn' ? ev.title_vn : ev.title_en) || ev.title_en
  const where = (L === 'vn' ? ev.venue_vn : ev.venue_en) || ev.venue_en
  return {
    name: `${name} · ${where}`,
    state: !ev.published ? tr(L, 'm_not_open') : ev.paused ? tr(L, 'm_paused') : tr(L, 'm_open'),
    ok: ev.published && !ev.paused,
  }
}
interface Staff { id: string; display_name: string }
type Mode = 'home' | 'signup'
type Step = 'slots' | 'who' | 'done'
interface Done { name: string; time: string; waiting: boolean; emailed: boolean; had_email: boolean; door_code: string | null }

export default function PopupPhone() {
  const { lang, setLang } = useLang()
  const L = lang as Lang
  const router = useRouter()

  const [me, setMe] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [ev, setEv] = useState<EventInfo | null>(null)
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [mode, setMode] = useState<Mode>('home')
  const [guest, setGuest] = useState(0)          // remount key

  // ── WHO IS HOLDING THIS PHONE ──────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/kiosk/popup/sessions', { cache: 'no-store' })
      if (r.status === 401) { setMe(null); setChecking(false); return }
      if (!r.ok) { setLoadFailed(true); setChecking(false); return }
      const j = await r.json()
      setEv(j.event); setSessions(j.sessions || []); setMe(j.staff || 'Staff')
      setLoadFailed(false); setChecking(false)
    } catch { setLoadFailed(true); setChecking(false) }
  }, [])
  useEffect(() => { load() }, [load])
  // ⚠ THE COUNTS MUST MOVE WHILE SHE IS LOOKING AT THEM. Another phone taking
  // the last place at 19:02 has to show here before she offers it at 19:03.
  useEffect(() => {
    if (!me) return
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [me, load])

  if (checking) return <Shell L={L} setLang={setLang}><div className="ph-wait">…</div><Styles /></Shell>
  if (!me) return <SignIn L={L} setLang={setLang} onIn={() => { setChecking(true); load() }} />

  return (
    <Shell L={L} setLang={setLang} practice={ev?.practice}>
      {mode === 'home' ? (
        <Home L={L} me={me} ev={ev}
              // ⚠ READ THE COUNTS AGAIN AS SHE OPENS THE LIST. The poll runs
              // every eight seconds, so without this the first thing she sees
              // can be up to eight seconds stale — and the moment she is most
              // likely to be looking at it is the moment she has just taken
              // the phone back from somebody else who booked on it.
              onSignUp={() => { setGuest(g => g + 1); setMode('signup'); load() }}
              onScan={() => router.push('/kiosk/popup/door')}
              onSignOut={async () => {
                await fetch('/api/kiosk/staff/logout', { method: 'POST' }).catch(() => {})
                setMe(null)
              }} />
      ) : (
        <SignUp key={guest} L={L} ev={ev} sessions={sessions} loadFailed={loadFailed}
                refresh={load} onHome={() => setMode('home')} />
      )}
      <Styles />
    </Shell>
  )
}

// ── THE HOME SCREEN ───────────────────────────────────────────────────────
function Home({ L, me, ev, onSignUp, onScan, onSignOut }: {
  L: Lang; me: string; ev: EventInfo | null
  onSignUp: () => void; onScan: () => void; onSignOut: () => void
}) {
  const line = eventLine(L, ev)
  return (
    <div className="ph-home">
      <Lion />
      <div className="ph-me">{tr(L, 'h_signed_in', { name: me })}</div>
      {/* ⚠ WHICH EVENING, AND WHETHER IT IS OPEN — in large type, always,
          before any other message on this phone can be trusted. */}
      <div className={`ph-event ${line.ok ? 'is-open' : 'is-shut'}`}>
        <b>{line.name}</b>
        <span>{line.state}</span>
      </div>
      <button className="ph-big" onClick={onSignUp}>
        <span className="ph-big-icon" aria-hidden>{ICON.pen}</span>
        {tr(L, 'h_signup')}
      </button>
      <button className="ph-big ph-big-2" onClick={onScan}>
        <span className="ph-big-icon" aria-hidden>{ICON.qr}</span>
        {tr(L, 'h_scan')}
      </button>
      <button className="ph-signout" onClick={onSignOut}>{tr(L, 'h_signout')}</button>
    </div>
  )
}

// ── SIGNING UP A GUEST ────────────────────────────────────────────────────
function SignUp({ L, ev, sessions, loadFailed, refresh, onHome }: {
  L: Lang; ev: EventInfo | null; sessions: Session[] | null
  loadFailed: boolean; refresh: () => void; onHome: () => void
}) {
  const [step, setStep] = useState<Step>('slots')
  const [picked, setPicked] = useState<Session | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [party, setParty] = useState(1)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ msg: string; extra?: string } | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  const attempt = useMemo(() => crypto.randomUUID(), [])
  // iOS Safari ignores autocomplete="off"; a field name it has never seen is
  // the one thing it cannot offer the last guest's address for.
  const fieldId = useMemo(() => Math.random().toString(36).slice(2, 10), [])
  const terms = tr(L, 'k_privacy')

  // ── A HALF-TYPED GUEST DOES NOT SIT ON THE PHONE ───────────────────────
  useEffect(() => {
    if (busy || step === 'done') return
    let t: ReturnType<typeof setTimeout>
    const arm = () => { clearTimeout(t); t = setTimeout(onHome, IDLE_MS) }
    arm()
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
    evs.forEach(e => window.addEventListener(e, arm, { passive: true }))
    return () => { clearTimeout(t); evs.forEach(e => window.removeEventListener(e, arm)) }
  }, [busy, step, onHome])

  const clearOfKeyboard = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }

  const submit = async (allowWaiting: boolean) => {
    if (!picked) return
    setErr(null); setBusy(true)
    const started = Date.now()
    try {
      for (;;) {
        try {
          const r = await fetch('/api/kiosk/popup/book', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: picked.session_id, name: name.trim(), email: email.trim(),
              party_size: party, lang: L, consent, terms_text: terms,
              attempt_id: attempt, allow_waiting: allowWaiting,
            }),
          })
          const j = await r.json().catch(() => ({}))
          if (r.ok && j.ok) {
            setDone({ name: j.name, time: j.time, waiting: !!j.waiting,
                      emailed: !!j.emailed, had_email: !!j.had_email,
                      door_code: j.door_code ?? null })
            setStep('done'); refresh(); return
          }
          if (r.status === 409 || r.status === 400) {
            setErr({ msg: j.error || tr(L, 'k_err_offline'), extra: j.extra })
            if (j.refresh) { refresh(); setStep('slots') }
            return
          }
          // ⚠ A SERVER ERROR IS NOT A LOST CONNECTION. Marked as it is thrown,
          // because by the time the retry loop gives up the two look identical
          // — and the message was telling staff the signal had gone when the
          // phone was online and the server had fallen over.
          const err = new Error(j.error || 'server') as Error & { serverSaid?: string }
          err.serverSaid = typeof j.error === 'string' ? j.error : ''
          throw err
        } catch (e) {
          if (Date.now() - started > RETRY_FOR_MS) throw e
          await new Promise(res => setTimeout(res, 900))
        }
      }
    } catch (e) {
      // ⚠ NEVER A FALSE CONFIRMATION — and never the wrong reason either.
      const said = (e as { serverSaid?: string })?.serverSaid
      if (said !== undefined) setErr({ msg: said || tr(L, 'b_failed'), extra: tr(L, 'b_try_again') })
      else setErr({ msg: tr(L, 'k_err_offline'), extra: tr(L, 'k_err_offline_ask') })
    } finally { setBusy(false) }
  }

  // ══ THE CONFIRMATION — the screen she turns round ══════════════════════
  if (step === 'done' && done) {
    return (
      <div className="ph-done">
        <div className="ph-done-eyebrow">{tr(L, 's_show_guest')}</div>
        <div className="ph-done-name">{done.name}</div>
        {done.waiting ? (
          <>
            <h1 className="ph-done-h">{tr(L, 'k_wait_title')}</h1>
            <p className="ph-done-sub">{tr(L, 'k_wait_line', { time: done.time })}</p>
            <p className="ph-done-warn">{tr(L, 'k_wait_note')}</p>
          </>
        ) : (
          <>
            <div className="ph-time">{done.time}</div>
            <h1 className="ph-done-h">{tr(L, 'k_done_title')}</h1>
            {/* ⚠ THE FOUR DIGITS, SO SHE CAN SAY THEM OUT LOUD as she hands
                the phone round: "your code is 4821". It is the same number in
                the email, on the run sheet and on the printed door list. */}
            {done.door_code && (
              <div className="ph-code">
                <span>{tr(L, 's_their_code')}</span>
                <b>{done.door_code}</b>
              </div>
            )}
            <p className="ph-done-sub">{tr(L, 'k_done_early')}</p>
            <p className={`ph-done-mail ${done.had_email && !done.emailed ? 'is-warn' : ''}`}>
              {!done.had_email ? tr(L, 's_not_emailed')
                : done.emailed ? tr(L, 's_emailed') : tr(L, 's_email_failed')}
            </p>
          </>
        )}
        <button className="ph-big" onClick={onHome}>{tr(L, 'h_done')}</button>
      </div>
    )
  }

  // ══ WHO ════════════════════════════════════════════════════════════════
  if (step === 'who' && picked) {
    const full = picked.is_full || picked.closed
    return (
      <div className="ph-form">
        <button className="ph-back" onClick={() => { setErr(null); setStep('slots') }}>
          ← {tr(L, 'k_back')}
        </button>
        <div className="ph-chosen">
          {timeLabel(picked.starts_at)}
          {full && <span className="ph-chosen-tag">{tr(L, 's_full')}</span>}
        </div>
        {err && <Err err={err} />}

        <label className="ph-field">
          <span>{tr(L, 'k_name')}</span>
          <input name={`n-${fieldId}`} autoComplete="off" autoCorrect="off" spellCheck={false}
                 value={name} maxLength={80} autoFocus
                 onChange={e => setName(e.target.value)} onFocus={clearOfKeyboard} />
        </label>

        <label className="ph-field">
          <span>{tr(L, 'k_email')}</span>
          <input name={`e-${fieldId}`} autoComplete="off" autoCorrect="off" spellCheck={false}
                 inputMode="email" value={email} maxLength={120}
                 onChange={e => setEmail(e.target.value)} onFocus={clearOfKeyboard} />
          <em className="ph-hint">{tr(L, 'k_email_hint')}</em>
        </label>

        <div className="ph-field">
          <span className="ph-label">{tr(L, 's_how_many')}</span>
          <div className="ph-party">
            {Array.from({ length: ev?.party_max ?? 2 }, (_, i) => i + 1).map(n => (
              <button key={n} className={`ph-num ${party === n ? 'is-on' : ''}`}
                      onClick={() => setParty(n)}>{n}</button>
            ))}
          </div>
        </div>

        <label className="ph-consent">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>{tr(L, 'k_consent')}</span>
        </label>
        <p className="ph-privacy">{tr(L, 'k_privacy')}</p>

        <button className="ph-big" disabled={!name.trim() || busy}
                onClick={() => submit(full)}>
          {busy ? <>{tr(L, 'k_working')}<Dots /></>
            : full ? tr(L, 's_waitlist_btn') : tr(L, 's_confirm_btn')}
        </button>
      </div>
    )
  }

  // ══ THE SLOTS — the first thing she sees ═══════════════════════════════
  const list = sessions || []
  const nextFree = list.find(s => !s.is_full && !s.closed)
  const now = Date.now()
  return (
    <div className="ph-slots">
      <button className="ph-back" onClick={onHome}>← {tr(L, 'h_back_home')}</button>
      <h1 className="ph-h">{tr(L, 's_choose')}</h1>

      {/* ⚠ THREE DIFFERENT THINGS, SAID DIFFERENTLY. They used to share one
          message — "we can't take bookings at the moment" — which reads as a
          fault whichever of the three it actually was. */}
      {ev && !ev.published ? (
        <div className="ph-offline">
          <strong>{tr(L, 'm_not_open_lead')}</strong>
          <span>{tr(L, 'm_not_open_sub')}</span>
        </div>
      ) : loadFailed ? (
        <div className="ph-offline">
          <strong>{tr(L, 'k_err_offline')}</strong>
          <span>{tr(L, 'k_err_offline_ask')}</span>
        </div>
      ) : ev?.paused ? (
        <div className="ph-offline"><strong>{tr(L, 'k_paused')}</strong></div>
      ) : sessions === null ? <div className="ph-wait">…</div>
        : list.length === 0 ? <div className="ph-offline"><strong>{tr(L, 'k_none_left')}</strong></div>
        : list.map(s => {
          const isFull = s.is_full || s.closed
          const running = +new Date(s.starts_at) <= now && now <= +new Date(s.ends_at)
          const isNext = !isFull && nextFree?.session_id === s.session_id
          return (
            <button key={s.session_id}
                    className={`ph-slot ${isFull ? 'is-full' : ''} ${isNext ? 'is-next' : ''}`}
                    onClick={() => { setPicked(s); setStep('who') }}>
              <span className="ph-slot-time">{timeLabel(s.starts_at)}</span>
              <span className="ph-slot-state">
                {isFull ? <b className="ph-full">{tr(L, 's_full')}</b>
                  : s.places_left === 1 ? <b className="ph-one">{tr(L, 's_one_place')}</b>
                  : <b>{tr(L, 's_places', { n: s.places_left })}</b>}
                {running && <em className="ph-tag ph-tag-now">{tr(L, 's_running')}</em>}
                {isNext && !running && <em className="ph-tag">{tr(L, 's_next_free')}</em>}
              </span>
            </button>
          )
        })}
    </div>
  )
}

// ── SIGNING IN, ONCE ──────────────────────────────────────────────────────
function SignIn({ L, setLang, onIn }: { L: Lang; setLang: (l: Lang) => void; onIn: () => void }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [who, setWho] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/kiosk/staff/roster').then(r => r.json())
      .then(j => setStaff(j.staff || [])).catch(() => {})
  }, [])
  const go = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/kiosk/staff/pick', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: who?.id, pin }) })
      setPin('')
      if (r.ok) onIn()
      else setErr((await r.json().catch(() => ({})))?.error || tr(L, 'd_wrong_pin'))
    } finally { setBusy(false) }
  }
  return (
    <Shell L={L} setLang={setLang}>
      <div className="ph-signin">
        <Lion />
        {!who ? (
          <>
            <h1 className="ph-h">{tr(L, 'h_who')}</h1>
            <div className="ph-staff">
              {staff.map(s => (
                <button key={s.id} onClick={() => setWho(s)}>{s.display_name}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="ph-h">{tr(L, 'h_your_pin', { name: who.display_name })}</h1>
            <input className="ph-pin" type="password" inputMode="numeric" value={pin} autoFocus
                   autoComplete="off" onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
            {err && <div className="ph-err"><strong>{err}</strong></div>}
            <button className="ph-big" disabled={pin.length < 4 || busy} onClick={go}>
              {tr(L, 'h_start')}
            </button>
            <button className="ph-signout" onClick={() => { setWho(null); setErr('') }}>
              {tr(L, 'h_someone_else')}
            </button>
          </>
        )}
      </div>
      <Styles />
    </Shell>
  )
}

function Err({ err }: { err: { msg: string; extra?: string } }) {
  return <div className="ph-err" role="alert"><strong>{err.msg}</strong>{err.extra && <span>{err.extra}</span>}</div>
}
function Dots() { return <span className="ph-dots" aria-hidden="true"><i /><i /><i /></span> }

// The club's mark, the same file the signing page uses. If it ever moves, the
// screen loses a picture and keeps every word — a missing lion must not be a
// blank phone in somebody's hand.
function Lion() {
  return <img src="/images/lion-signature-opt.png" alt="" className="ph-lion"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ICON = {
  pen: <svg width="30" height="30" viewBox="0 0 24 24" {...S}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M14.5 6.5 17.5 9.5" /></svg>,
  qr: <svg width="30" height="30" viewBox="0 0 24 24" {...S}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" /><path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" /><path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" /><path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M7.5 7.5h3v3h-3zM13.5 7.5h3v3h-3zM7.5 13.5h3v3h-3z" /><path d="M13.5 13.5h1.5M16.5 13.5v3M13.5 16.5h1.5" /></svg>,
}

function Shell({ L, setLang, children, practice }: {
  L: Lang; setLang: (l: Lang) => void; children: React.ReactNode; practice?: boolean
}) {
  return (
    <main className="ph">
      {/* ⚠ PRACTICE IS A BAND ACROSS THE TOP OF EVERY SCREEN, not a word in a
          corner. Somebody must never wonder which evening they are in. */}
      {practice && <div className="ph-practice">{tr(L, 'h_practice')}</div>}
      <div className="ph-lang">
        {(['en', 'vn'] as Lang[]).map(l => (
          <button key={l} className={L === l ? 'is-on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      {children}
    </main>
  )
}

const SAGE = '#B0C18E', INK = '#052E20', PAPER = '#E5D4C2', GOLD = '#C9A84C'
const RED = '#B4523F', GREEN = '#5E8A4E'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: `
    /* Built for 360 and 390 wide, one thumb, somebody standing up. Nothing
       below 48px of touch target; no body text under 16px. */
    .ph { min-height: var(--pk-vh, 100dvh); background: ${SAGE}; color: ${INK};
          padding: 10px 16px calc(28px + var(--pk-kb, 0px)); box-sizing: border-box;
          font-family: ${MONO}; }
    .ph-practice { margin: -10px -16px 10px; padding: 7px 16px; background: ${INK}; color: ${GOLD};
                   font-family: ${SERIF}; font-size: 13px; letter-spacing: .28em; text-align: center; }
    .ph-lang { display: flex; gap: 2px; justify-content: flex-end; margin-bottom: 6px; }
    .ph-lang button { min-width: 56px; min-height: 40px; border: 1px solid ${INK}33;
                      background: none; color: ${INK}; font-family: ${MONO}; font-size: 13px;
                      letter-spacing: .1em; }
    .ph-lang button.is-on { background: ${INK}; color: ${SAGE}; border-color: ${INK}; }
    .ph-wait { text-align: center; padding: 60px 0; font-size: 28px; opacity: .4; }
    .ph-lion { display: block; width: 74px; margin: 6px auto 14px; opacity: .9; }

    /* ── HOME ─────────────────────────────────────────────────────────── */
    .ph-home { display: flex; flex-direction: column; align-items: stretch;
               min-height: calc(var(--pk-vh, 100dvh) - 120px); }
    .ph-me { font-family: ${SERIF}; font-size: 19px; text-align: center; margin-bottom: 4px; }
    .ph-practice-note { font-size: 12px; text-align: center; opacity: .7; margin-bottom: 10px; line-height: 1.5; }
    .ph-event { display: flex; flex-direction: column; align-items: center; gap: 3px;
                margin: 10px 0 4px; padding: 11px 14px; border-radius: 9px; text-align: center; }
    .ph-event b { font-family: ${SERIF}; font-size: 17px; line-height: 1.2; }
    .ph-event span { font-family: ${MONO}; font-size: 13px; letter-spacing: .06em; }
    .ph-event.is-open { background: ${INK}; color: ${PAPER}; }
    .ph-event.is-open span { color: #A8D48F; }
    .ph-event.is-shut { background: ${RED}; color: ${PAPER}; }
    .ph-event.is-shut span { color: ${PAPER}; opacity: .9; }
    .ph-big { display: flex; align-items: center; justify-content: center; gap: 12px;
              width: 100%; box-sizing: border-box; min-height: 92px; margin-top: 14px;
              border: none; border-radius: 12px; background: ${GOLD}; color: ${INK};
              font-family: ${SERIF}; font-size: 21px; font-weight: 700;
              letter-spacing: .1em; text-transform: uppercase; cursor: pointer;
              box-shadow: 0 2px 0 ${INK}1f, 0 12px 22px -14px ${INK}80;
              -webkit-tap-highlight-color: transparent; }
    .ph-big[disabled] { opacity: .45; box-shadow: none; }
    .ph-big:active:not([disabled]) { transform: translateY(1px); }
    .ph-big-2 { background: ${PAPER}; }
    .ph-big-icon { display: flex; }
    .ph-signout { margin-top: auto; padding-top: 22px; min-height: 48px; background: none;
                  border: none; color: ${INK}; opacity: .55; font-family: ${MONO}; font-size: 14px;
                  text-decoration: underline; text-underline-offset: 4px; }

    /* ── THE SLOTS ────────────────────────────────────────────────────── */
    .ph-back { min-height: 48px; padding: 0 2px; background: none; border: none; color: ${INK};
               font-family: ${MONO}; font-size: 15px; opacity: .75; }
    .ph-h { font-family: ${SERIF}; font-weight: 400; font-size: clamp(24px, 7vw, 34px);
            margin: 2px 0 12px; line-height: 1.05; }
    .ph-slot { display: flex; align-items: center; justify-content: space-between; gap: 10px;
               width: 100%; box-sizing: border-box; min-height: 76px; margin-bottom: 9px;
               padding: 12px 15px; border-radius: 10px; cursor: pointer; text-align: left;
               background: ${PAPER}; color: ${INK}; border: 1px solid transparent;
               border-left: 5px solid ${GREEN};
               box-shadow: 0 1px 2px ${INK}1a, 0 8px 16px -12px ${INK}59;
               -webkit-tap-highlight-color: transparent; }
    .ph-slot:active { transform: scale(.99); }
    .ph-slot-time { font-family: ${SERIF}; font-size: 34px; line-height: 1; }
    .ph-slot-state { display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
                     font-size: 13px; text-align: right; }
    .ph-slot-state b { font-size: 15px; font-weight: 400; }
    .ph-one { color: ${RED}; font-weight: 700 !important; }
    .ph-full { font-family: ${SERIF}; font-size: 17px !important; letter-spacing: .14em; color: ${RED}; }
    /* ⚠ A FULL SLOT IS A DIFFERENT OBJECT, not grey text. Hatched, pale, and
       its left edge turns red — readable at arm's length without reading. */
    .ph-slot.is-full { background:
        repeating-linear-gradient(135deg, ${INK}0f 0 7px, ${INK}1c 7px 14px);
      border-left-color: ${RED}; box-shadow: none; }
    .ph-slot.is-full .ph-slot-time { opacity: .5; }
    .ph-slot.is-next { border-color: ${GOLD}; box-shadow: 0 0 0 2px ${GOLD}, 0 8px 16px -12px ${INK}59; }
    .ph-tag { font-style: normal; font-family: ${SERIF}; font-size: 10px; letter-spacing: .14em;
              background: ${GOLD}; color: ${INK}; padding: 2px 6px; border-radius: 3px; }
    .ph-tag-now { background: ${GREEN}; color: ${PAPER}; }

    /* ── WHO ──────────────────────────────────────────────────────────── */
    .ph-chosen { font-family: ${SERIF}; font-size: clamp(42px, 12vw, 60px); line-height: 1;
                 margin: 0 0 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .ph-chosen-tag { font-size: 14px; letter-spacing: .14em; background: ${RED}; color: ${PAPER};
                     padding: 4px 9px; border-radius: 4px; }
    .ph-field { display: block; margin: 0 0 16px; }
    .ph-field > span, .ph-label { display: block; font-family: ${SERIF}; font-size: 14px;
                      letter-spacing: .12em; text-transform: uppercase; opacity: .66; margin-bottom: 7px; }
    .ph-field input { width: 100%; box-sizing: border-box; min-height: 58px;
                      background: #ffffff8c; color: ${INK}; border: 1px solid ${INK}2e;
                      border-radius: 8px; padding: 12px 15px; font-family: ${MONO};
                      font-size: 20px; outline: none; }
    .ph-field input[name^="e-"] { font-size: 17px; }
    .ph-field input:focus { border-color: ${GOLD}; box-shadow: 0 0 0 3px ${GOLD}59; }
    .ph-hint { display: block; font-family: ${MONO}; font-size: 13px; font-style: normal;
               opacity: .62; margin-top: 6px; }
    .ph-party { display: flex; gap: 9px; }
    .ph-num { flex: 1; min-height: 62px; border-radius: 8px; border: 1px solid ${INK}2e;
              background: #ffffff5c; color: ${INK}; font-family: ${SERIF}; font-size: 24px; }
    .ph-num.is-on { background: ${INK}; color: ${SAGE}; border-color: ${INK}; }
    .ph-consent { display: flex; align-items: center; gap: 12px; min-height: 52px;
                  font-size: 14px; line-height: 1.5; }
    .ph-consent input { width: 26px; height: 26px; flex: none; accent-color: ${GOLD}; }
    .ph-privacy { font-size: 12px; line-height: 1.6; opacity: .62; margin: 6px 0 16px; }

    /* ── THE CONFIRMATION ─────────────────────────────────────────────── */
    .ph-done { text-align: center; padding: 6px 0 0; }
    .ph-done-eyebrow { font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
                       opacity: .5; margin-bottom: 14px; }
    .ph-done-name { font-family: ${MONO}; font-size: clamp(22px, 6vw, 30px); line-height: 1.25;
                    word-break: break-word; }
    .ph-time { font-family: ${SERIF}; font-size: clamp(88px, 27vw, 150px); line-height: .92;
               margin: 6px 0 8px; }
    .ph-done-h { font-family: ${SERIF}; font-weight: 400; font-size: clamp(21px, 5.6vw, 30px);
                 line-height: 1.1; margin: 0; opacity: .85; }
    .ph-done-sub { font-size: 16px; line-height: 1.55; margin: 10px 0 0; }
    .ph-code { margin: 16px auto 4px; padding: 10px 18px; border-radius: 10px;
               background: ${INK}; color: ${PAPER}; display: inline-flex;
               flex-direction: column; align-items: center; gap: 2px; }
    .ph-code span { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; opacity: .62; }
    .ph-code b { font-family: ${MONO}; font-size: 40px; letter-spacing: .22em;
                 font-weight: 700; line-height: 1.1; }
    .ph-done-mail { font-size: 14px; opacity: .72; margin: 14px 0 0; line-height: 1.5; }
    .ph-done-mail.is-warn { opacity: 1; color: ${RED}; font-weight: 700; }
    .ph-done-warn { font-size: 16px; margin: 14px 0 0; padding: 12px 14px; border-radius: 8px;
                    background: ${INK}; color: ${PAPER}; }
    .ph-done .ph-big { margin-top: 26px; }

    /* ── SIGN IN ──────────────────────────────────────────────────────── */
    .ph-signin { padding-top: 10px; }
    .ph-staff { display: grid; gap: 9px; grid-template-columns: 1fr 1fr; }
    .ph-staff button { min-height: 66px; border-radius: 9px; background: ${PAPER};
                       border: none; color: ${INK}; font-family: ${MONO}; font-size: 15px;
                       box-shadow: 0 1px 2px ${INK}1a; }
    .ph-pin { width: 100%; box-sizing: border-box; min-height: 68px; font-size: 30px;
              letter-spacing: .4em; text-align: center; border-radius: 8px; margin: 4px 0 12px;
              background: #ffffff8c; border: 1px solid ${INK}33; color: ${INK};
              font-family: ${MONO}; outline: none; }

    .ph-err { display: flex; flex-direction: column; gap: 4px; margin: 0 0 14px;
              padding: 14px 16px; border-radius: 8px; background: ${INK}; color: ${PAPER};
              font-size: 16px; line-height: 1.5; }
    .ph-err span { opacity: .78; font-size: 14px; }
    .ph-offline { padding: 22px 18px; border-radius: 10px; background: ${INK}; color: ${PAPER};
                  font-size: 17px; line-height: 1.6; display: flex; flex-direction: column; gap: 7px; }
    .ph-offline span { opacity: .78; font-size: 15px; }

    @keyframes ph-dot { 0%,100% { opacity: .22 } 50% { opacity: 1 } }
    .ph-dots { display: inline-flex; gap: 4px; margin-left: 8px; }
    .ph-dots i { width: 5px; height: 5px; border-radius: 50%; background: currentColor;
                 animation: ph-dot 1.1s ease-in-out infinite; }
    .ph-dots i:nth-child(2) { animation-delay: .18s }
    .ph-dots i:nth-child(3) { animation-delay: .36s }
    @media (prefers-reduced-motion: reduce) { .ph-dots i { animation: none; opacity: .7 } }
  ` }} />
}
