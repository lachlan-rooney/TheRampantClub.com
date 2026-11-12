'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import { tr, timeLabel, type Lang } from '@/lib/popup/strings'

// ═══════════════════════════════════════════════════════════════════════════
// SIGN-UP — A STAFF MEMBER'S PHONE, at the pop-up, beside the guest.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ IT WAS BUILT FOR A TABLET AND IT IS NOT ONE ANY MORE (12 Nov 2026). The
// room tablets are needed INSIDE the pop-up for the Flavour Finder, so sign-up
// moved onto staff phones: a member of staff holds the phone and takes the
// details, or hands the phone over. Everything below is sized for 390px wide
// and one thumb, and the tablet case is now the wide end of the same layout
// rather than the shape it was drawn for.
//
// Three screens: choose a time → who you are → check and confirm. Then the
// guarantee, which is the only screen that matters, and which is made to be
// TURNED ROUND AND SHOWN — the name and the time are the two biggest things
// on it for that reason.
//
// ══ WHAT A PHONE CHANGES, CONCRETELY ═════════════════════════════════════
// · THE SOFT KEYBOARD. It does not resize the window on iOS, it resizes the
//   VISUAL viewport — so `100vh` stays tall, the page keeps its full height,
//   and the button the staff member needs sits underneath the keyboard with
//   nothing to scroll to. Measured below and published as --pk-vh / --pk-kb.
// · NINE SESSIONS DO NOT FIT. The ones with room come first; the full ones go
//   below a line of their own. Time order is kept inside each group.
// · A PHONE HAS A BACK GESTURE. Nothing in this flow is a navigation, so back
//   would leave the sign-up entirely — and from the confirmation screen it
//   would hand the NEXT guest the LAST guest's screen on the way forward.
//   Trapped, and turned into "next guest".
//
// ══ WHAT THIS SCREEN IS NOT ALLOWED TO DO ════════════════════════════════
// 1 · SAY YES BEFORE POSTGRES HAS. Places are limited and a guest is being
//     told out loud that they are in. There is no optimistic confirmation and
//     no offline queue: with no connection it says so and staff take the name
//     on paper. The ONE retry is inside a single interaction, carrying the
//     same attempt id, which popup_book is idempotent on.
// 2 · LEAK THE LAST GUEST TO THE NEXT. After a booking, or 30 seconds of
//     nobody touching it, the whole form is REMOUNTED — not blanked — under a
//     new key, so no React state, no browser autofill and no scroll position
//     survives. The field names are randomised per guest for the same reason:
//     iOS Safari ignores autocomplete="off" and will happily offer the last
//     person's email to the next one.
// 3 · LET WHOEVER IS HOLDING IT OUT OF THE FLOW. No nav, no links, no back,
//     and no reaching the door list — which carries every guest's name — from
//     a phone that has just been handed to a stranger. The way out is the
//     acting staff member's own PIN, and it leads to a staff menu, not out.
// ═══════════════════════════════════════════════════════════════════════════

const IDLE_MS = 30_000
const RETRY_FOR_MS = 10_000

interface Session {
  session_id: string; idx: number; starts_at: string; ends_at: string
  places_left: number; is_full: boolean; closed: boolean; party_max: number
  bookings_paused: boolean
}
interface EventInfo {
  title_en: string; title_vn: string | null
  venue_en: string; venue_vn: string | null
  session_minutes: number; party_max: number; published: boolean; paused: boolean
}
type Step = 'sessions' | 'details' | 'check' | 'done'
interface Done {
  name: string; time: string; waiting: boolean; emailed: boolean; had_email: boolean
}

export default function PopupKiosk() {
  // The remount key. Bumping it throws away every child's state at once —
  // the only reliable way to be sure nothing of the last guest is left.
  const [guest, setGuest] = useState(0)
  const next = useCallback(() => setGuest(g => g + 1), [])

  // ── THE BACK GESTURE, TRAPPED ──────────────────────────────────────────
  // ⚠ IT LIVES IN THIS COMPONENT AND NOT IN Stand, deliberately: Stand is
  // REMOUNTED for every guest, so the same effect there would push a history
  // entry per guest and build an evening-long stack to swipe back through.
  // This mounts once.
  //
  // A swipe does not take the guest back a screen — the three screens are
  // state, not pages. It starts the NEXT guest, which is the only thing a
  // backwards gesture can safely mean on a phone being handed round.
  useEffect(() => {
    history.pushState({ pk: 1 }, '')
    const onPop = () => { history.pushState({ pk: 1 }, ''); next() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [next])

  // ── THE KEYBOARD'S HEIGHT, PUBLISHED AS A CSS VARIABLE ─────────────────
  // visualViewport is the only honest source for this. window.innerHeight does
  // NOT change when the iOS keyboard opens, so a layout built on vh/dvh puts
  // the confirm button under the keyboard and offers nothing to scroll.
  //   --pk-vh  the height actually visible
  //   --pk-kb  how much of it the keyboard is covering
  // Also mounted once: the measurement is about the device, not the guest.
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    if (!vv) { root.style.setProperty('--pk-vh', '100dvh'); return }
    const set = () => {
      root.style.setProperty('--pk-vh', `${Math.round(vv.height)}px`)
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--pk-kb', `${Math.round(covered)}px`)
    }
    set()
    vv.addEventListener('resize', set); vv.addEventListener('scroll', set)
    return () => { vv.removeEventListener('resize', set); vv.removeEventListener('scroll', set) }
  }, [])

  return <Stand key={guest} onReset={next} />
}

function Stand({ onReset }: { onReset: () => void }) {
  const { lang, setLang } = useLang()
  const L = lang as Lang

  const [ev, setEv] = useState<EventInfo | null>(null)
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const [step, setStep] = useState<Step>('sessions')
  const [picked, setPicked] = useState<Session | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [party, setParty] = useState(1)
  const [consent, setConsent] = useState(false)   // ⚠ ALWAYS STARTS UNTICKED
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ msg: string; extra?: string } | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  // ⚠ ONE ATTEMPT ID PER GUEST, made once. It is what makes the retry below
  // safe: a request that timed out after succeeding returns its first answer
  // instead of taking a second place.
  const attempt = useMemo(() => crypto.randomUUID(), [])
  // iOS Safari ignores autocomplete="off"; a field name it has never seen is
  // the thing it cannot offer a suggestion for.
  const fieldId = useMemo(() => Math.random().toString(36).slice(2, 10), [])

  const terms = tr(L, 'k_privacy')

  // ── A FOCUSED FIELD MUST BE VISIBLE ─────────────────────────────────────
  // --pk-kb keeps the PAGE short enough to scroll clear of the keyboard; this
  // does the scrolling. The delay is not decoration: on iOS the keyboard
  // animates in over ~250ms and a scroll issued before it lands is measured
  // against the old viewport and undone.
  const clearOfKeyboard = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }

  // ── THE LIST ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/kiosk/popup/sessions', { cache: 'no-store' })
      if (!r.ok) { setLoadFailed(true); return }
      const j = await r.json()
      setEv(j.event); setSessions(j.sessions || []); setLoadFailed(false)
    } catch { setLoadFailed(true) }
  }, [])

  useEffect(() => { load() }, [load])
  // Refreshed while the guest is choosing, so a session that filled up on
  // another tablet twenty seconds ago is not still offered here.
  useEffect(() => {
    if (step !== 'sessions') return
    const id = setInterval(load, 12_000)
    return () => clearInterval(id)
  }, [step, load])

  // ── THE IDLE RESET ──────────────────────────────────────────────────────
  // Thirty seconds with nobody touching it and the stand clears completely.
  // Suspended while a booking is in flight — a guest must never watch their
  // own confirmation vanish.
  useEffect(() => {
    if (busy) return
    let t: ReturnType<typeof setTimeout>
    const reset = () => { clearTimeout(t); t = setTimeout(onReset, IDLE_MS) }
    reset()
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
    evs.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => { clearTimeout(t); evs.forEach(e => window.removeEventListener(e, reset)) }
  }, [busy, onReset])

  const title = (L === 'vn' ? ev?.title_vn : ev?.title_en) || ev?.title_en || ''

  // ── NINE SESSIONS, ON A PHONE ───────────────────────────────────────────
  // popup_public already drops sessions that have started, so the list only
  // ever holds times still to come. What it does NOT do is move the full ones
  // out of the way, and at 390px wide a full 18:00 and a full 18:20 are two
  // whole thumb-scrolls between a staff member and the time they can actually
  // give away.
  //
  // So: two groups, THE ONES WITH ROOM FIRST, time order kept inside each.
  // Not re-sorted into one list by availability — two adjacent tiles reading
  // 18:40 then 18:00 is how somebody says the wrong time out loud.
  const withRoom = (sessions || []).filter(x => !x.is_full && !x.closed)
  const noRoom = (sessions || []).filter(x => x.is_full || x.closed)

  // ── TAKING THE PLACE ────────────────────────────────────────────────────
  const submit = async (allowWaiting: boolean) => {
    if (!picked) return
    setErr(null); setBusy(true)
    const started = Date.now()
    try {
      // THE ONE SAFE RETRY: same attempt id, inside this interaction, while
      // the guest is still standing here watching the busy state.
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
                      emailed: !!j.emailed, had_email: !!j.had_email })
            setStep('done')
            return
          }
          // A refusal with a reason is an answer, not a failure — show it.
          if (r.status === 409 || r.status === 400) {
            setErr({ msg: j.error || tr(L, 'k_err_offline'), extra: j.extra })
            if (j.refresh) { await load(); setStep('sessions') }
            return
          }
          throw new Error(j.error || 'unreachable')
        } catch (e) {
          if (Date.now() - started > RETRY_FOR_MS) throw e
          await new Promise(res => setTimeout(res, 900))
        }
      }
    } catch {
      // ⚠ NEVER A FALSE CONFIRMATION.
      setErr({ msg: tr(L, 'k_err_offline'), extra: tr(L, 'k_err_offline_ask') })
    } finally { setBusy(false) }
  }

  // ═══ THE GUARANTEE ══════════════════════════════════════════════════════
  if (step === 'done' && done) {
    return (
      <Shell lang={L} setLang={setLang} onExit={() => setUnlocking(true)} unlocking={unlocking}
             onCancelUnlock={() => setUnlocking(false)}>
        <div className="pk-done">
          {/* ⚠ THE NAME IS LARGE NOW, not an eyebrow. The staff member turns
              the phone round and shows this screen to the guest, so the two
              facts being confirmed — who, and when — are both read at arm's
              length. It is set in the TEXT face, not the display one: the
              club's display face is caps-only and a guest's name must not be
              shouted back at them. */}
          <div className="pk-done-name">{done.name}</div>
          {done.waiting ? (
            <>
              <h1 className="pk-done-h">{tr(L, 'k_wait_title')}</h1>
              <p className="pk-done-sub">{tr(L, 'k_wait_line', { time: done.time })}</p>
              <p className="pk-done-warn">{tr(L, 'k_wait_note')}</p>
            </>
          ) : (
            <>
              <h1 className="pk-done-h">{tr(L, 'k_done_title')}</h1>
              {/* THE TIME IS THE BIGGEST THING ON THE SCREEN. It is what the
                  guest has to remember, and the only thing they will. */}
              <div className="pk-time">{done.time}</div>
              <p className="pk-done-sub">{tr(L, 'k_done_come', { time: done.time })}</p>
              <p className="pk-done-sub">{tr(L, 'k_done_early')}</p>
              {/* The email is reported, never relied on. */}
              <p className="pk-done-mail">
                {done.had_email && done.emailed ? tr(L, 'k_done_mail') : tr(L, 'k_done_nomail')}
              </p>
            </>
          )}
          <button className="pk-big" onClick={onReset}>{tr(L, 'k_done_again')}</button>
        </div>
        <Styles />
      </Shell>
    )
  }

  return (
    <Shell lang={L} setLang={setLang} onExit={() => setUnlocking(true)} unlocking={unlocking}
           onCancelUnlock={() => setUnlocking(false)}>
      {/* ── SCREEN 1 ───────────────────────────────────────────────────── */}
      {step === 'sessions' && (
        <>
          <h1 className="pk-h">{tr(L, 'k_title')}</h1>
          <p className="pk-lead">{tr(L, 'k_lead', { n: ev?.session_minutes ?? 15 })}</p>
          {err && <Err err={err} />}

          {loadFailed || (ev && !ev.published) ? (
            <div className="pk-offline">
              <strong>{tr(L, 'k_err_offline')}</strong>
              <span>{tr(L, 'k_err_offline_ask')}</span>
            </div>
          ) : ev?.paused ? (
            <div className="pk-offline"><strong>{tr(L, 'k_paused')}</strong></div>
          ) : sessions === null ? null
            : sessions.length === 0 ? <div className="pk-offline"><strong>{tr(L, 'k_none_left')}</strong></div>
            : (
              <>
                <div className="pk-grid">
                  {withRoom.map((s, i) => (
                    <button key={s.session_id} className={`pk-slot ${i === 0 ? 'is-next' : ''}`}
                            onClick={() => { setPicked(s); setStep('details') }}>
                      {/* The soonest one with room, marked. On a phone the top
                          tile is the one a thumb lands on without scrolling,
                          and it should be the one staff reach for. */}
                      {i === 0 && <span className="pk-slot-tag">{tr(L, 'k_soonest')}</span>}
                      <span className="pk-slot-time">{timeLabel(s.starts_at)}</span>
                      <span className="pk-slot-left">
                        {s.places_left === 1 ? tr(L, 'k_places_one')
                          : tr(L, 'k_places', { n: s.places_left })}
                      </span>
                    </button>
                  ))}
                </div>
                {noRoom.length > 0 && (
                  <>
                    {/* Full sessions stay reachable — pressing one is how a
                        guest asks for the waiting list — but they are below a
                        line and out of the way of the times staff can give. */}
                    <div className="pk-divider">{tr(L, 'k_full_heading')}</div>
                    <div className="pk-grid">
                      {noRoom.map(s => (
                        <button key={s.session_id} className="pk-slot is-full"
                                onClick={() => { setPicked(s); setStep('details') }}>
                          <span className="pk-slot-time">{timeLabel(s.starts_at)}</span>
                          <span className="pk-slot-left">{tr(L, 'k_waitlist')}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
        </>
      )}

      {/* ── SCREEN 2 ───────────────────────────────────────────────────── */}
      {step === 'details' && picked && (
        <>
          <h1 className="pk-h">{tr(L, 'k_your_details')}</h1>
          {/* ⚠ THE CHOSEN TIME, LARGE. It was set as a lead line and read as
              small print — the one fact the guest has just chosen and the one
              they would notice if it were wrong. */}
          <div className="pk-chosen">{timeLabel(picked.starts_at)}</div>
          {err && <Err err={err} />}

          <label className="pk-field">
            <span>{tr(L, 'k_name')}</span>
            <input name={`n-${fieldId}`} autoComplete="off" autoCorrect="off"
                   spellCheck={false} value={name} maxLength={80}
                   onChange={e => setName(e.target.value)} onFocus={clearOfKeyboard} />
          </label>

          <label className="pk-field">
            <span>{tr(L, 'k_email')}</span>
            <input name={`e-${fieldId}`} autoComplete="off" autoCorrect="off"
                   spellCheck={false} inputMode="email" value={email} maxLength={120}
                   onChange={e => setEmail(e.target.value)} onFocus={clearOfKeyboard} />
            <em className="pk-hint">{tr(L, 'k_email_hint')}</em>
          </label>

          <div className="pk-field">
            <span className="pk-label">{tr(L, 'k_party')}</span>
            <div className="pk-party">
              {Array.from({ length: ev?.party_max ?? 2 }, (_, i) => i + 1).map(n => (
                <button key={n} className={`pk-chip ${party === n ? 'is-on' : ''}`}
                        onClick={() => setParty(n)}>
                  {n === 1 ? tr(L, 'k_party_one') : tr(L, 'k_party_n', { n })}
                </button>
              ))}
            </div>
          </div>

          <div className="pk-row">
            <button className="pk-quiet" onClick={() => { setErr(null); setStep('sessions') }}>
              {tr(L, 'k_back')}
            </button>
            <button className="pk-big" disabled={!name.trim()}
                    onClick={() => {
                      if (!name.trim()) return setErr({ msg: tr(L, 'k_err_name') })
                      setErr(null); setStep('check')
                    }}>
              {tr(L, 'k_next')}
            </button>
          </div>
        </>
      )}

      {/* ── SCREEN 3 · the typo catcher ────────────────────────────────── */}
      {step === 'check' && picked && (
        <>
          <h1 className="pk-h">{tr(L, 'k_check')}</h1>
          {err && <Err err={err} />}

          <div className="pk-check">
            <div className="pk-check-name">{name.trim()}</div>
            <div className="pk-check-time">{timeLabel(picked.starts_at)}</div>
            {/* ⚠ LARGE. This is the only moment a typed address can be caught,
                and it is read by somebody standing up. */}
            {email.trim()
              ? <>
                  <div className="pk-check-email">{email.trim()}</div>
                  <div className="pk-check-note">{tr(L, 'k_check_email')}</div>
                </>
              : <div className="pk-check-note">{tr(L, 'k_done_nomail')}</div>}
          </div>

          <label className="pk-consent">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>{tr(L, 'k_consent')}</span>
          </label>
          <p className="pk-privacy">
            {tr(L, 'k_privacy')}{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">{tr(L, 'k_privacy_link')}</a>
          </p>

          <div className="pk-row">
            <button className="pk-quiet" disabled={busy}
                    onClick={() => { setErr(null); setStep('details') }}>{tr(L, 'k_edit')}</button>
            <button className="pk-big" disabled={busy} onClick={() => submit(false)}>
              {busy ? <>{tr(L, 'k_working')}<Dots /></> : tr(L, 'k_confirm')}
            </button>
          </div>
          {/* Offered only after a refusal for a full session, never instead of
              one — the waiting list is something a guest chooses. */}
          {err && picked.is_full && !busy && (
            <button className="pk-wait" onClick={() => submit(true)}>{tr(L, 'k_waitlist')}</button>
          )}
        </>
      )}
      <Styles />
    </Shell>
  )
}

function Err({ err }: { err: { msg: string; extra?: string } }) {
  return (
    <div className="pk-err" role="alert">
      <strong>{err.msg}</strong>
      {err.extra && <span>{err.extra}</span>}
    </div>
  )
}

function Dots() {
  return <span className="pk-dots" aria-hidden="true"><i /><i /><i /></span>
}

// ── THE SHELL: the language switch, and the only way out ──────────────────
//
// ⚠ THE PIN NO LONGER LEADS OUT OF THE BUILDING, IT LEADS TO A STAFF MENU.
// It used to send the staff member to /kiosk/board. On a phone paired as a
// pop-up device that is a page middleware will not open — it would have
// bounced straight back to this screen and looked like a broken PIN.
//
// The menu is also the answer to "the same people may do either during the
// evening": sign-up and the door list are one tap apart for a member of
// staff, and both behind the PIN for anybody else holding the phone.
function Shell({ lang, setLang, children, onExit, unlocking, onCancelUnlock }: {
  lang: Lang; setLang: (l: Lang) => void; children: React.ReactNode
  onExit: () => void; unlocking: boolean
  onCancelUnlock: () => void
}) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [bad, setBad] = useState('')
  const [who, setWho] = useState<string | null>(null)   // set once the PIN is right

  const go = async () => {
    const r = await fetch('/api/kiosk/popup/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const j = await r.json().catch(() => ({}))
    // The PIN is dropped either way, the instant it has been answered.
    setPin('')
    if (r.ok) { setBad(''); setWho(j.staff || 'Staff') }
    else setBad(j?.error || tr(lang, 'd_wrong_pin'))
  }
  const close = () => { setWho(null); setBad(''); setPin(''); onCancelUnlock() }

  return (
    <main className="pk">
      <div className="pk-top">
        {/* Deliberately unlabelled and small: it is for staff, and a guest
            should not be invited to press it. */}
        <button className="pk-exit" onClick={onExit} aria-label="Staff">◆</button>
        <div className="pk-lang">
          {(['en', 'vn'] as Lang[]).map(l => (
            <button key={l} className={lang === l ? 'is-on' : ''} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {unlocking ? (
        who ? (
          <div className="pk-unlock">
            <h1 className="pk-h">{who}</h1>
            <p className="pk-lead">{tr(lang, 'k_menu_sub')}</p>
            <button className="pk-big pk-menu" onClick={close}>{tr(lang, 'k_menu_signup')}</button>
            {/* The door list carries every guest's name, which is why it is
                behind the PIN and not on the sign-up screen. */}
            <button className="pk-big pk-menu" onClick={() => router.push('/kiosk/popup/door')}>
              {tr(lang, 'k_menu_door')}
            </button>
            <button className="pk-quiet pk-menu" onClick={close}>{tr(lang, 'k_back')}</button>
          </div>
        ) : (
          <div className="pk-unlock">
            <h1 className="pk-h">{tr(lang, 'k_pin_title')}</h1>
            <input className="pk-pin" type="password" inputMode="numeric" value={pin}
                   autoComplete="off" autoFocus onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
            {bad && <div className="pk-err"><strong>{bad}</strong></div>}
            <div className="pk-row">
              <button className="pk-quiet" onClick={close}>{tr(lang, 'd_cancel')}</button>
              <button className="pk-big" disabled={pin.length < 4} onClick={go}>{tr(lang, 'k_continue')}</button>
            </div>
          </div>
        )
      ) : children}
    </main>
  )
}

const SAGE = '#B0C18E', INK = '#052E20', PAPER = '#E5D4C2', GOLD = '#C9A84C'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: `
    /* ⚠ SIZES ARE FOR SOMEBODY STANDING UP, holding a drink, at arm's length.
       Nothing here is below 44px of touch target and no body text is under
       17px. The club's display face is a CAPS face, so it sets headings and
       labels only — a guest's typed name must not be forced into capitals. */
    /* ⚠ --pk-vh, NOT 100vh AND NOT 100dvh. Published from visualViewport in
       PopupKiosk. On iOS the soft keyboard does not change the layout
       viewport at all, so both vh units stay at full screen height while half
       the screen is keyboard — the page keeps a height it does not have and
       the confirm button sits under the keys with nothing to scroll to.
       --pk-kb is how much is covered, and it is added to the bottom padding so
       there is always something to scroll INTO.
       Both fall back to the old behaviour where visualViewport is missing. */
    .pk { min-height: var(--pk-vh, 100dvh); background: ${SAGE}; color: ${INK};
          padding: 14px 16px calc(32px + var(--pk-kb, 0px) + var(--kiosk-bar, 0px));
          box-sizing: border-box; }
    @media (min-width: 560px) { .pk { padding: 20px 24px calc(40px + var(--pk-kb, 0px) + var(--kiosk-bar, 0px)); } }
    .pk-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .pk-exit { width: 48px; height: 48px; border: none; background: none; color: ${INK};
               opacity: .3; font-size: 20px; cursor: pointer; }
    .pk-lang { display: flex; gap: 2px; }
    .pk-lang button { min-width: 60px; min-height: 44px; border: 1px solid ${INK}40;
                      background: none; color: ${INK}; font-family: ${MONO}; font-size: 15px;
                      letter-spacing: .1em; cursor: pointer; }
    .pk-lang button.is-on { background: ${INK}; color: ${SAGE}; border-color: ${INK}; }

    .pk-h { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 7vw, 46px);
            line-height: 1.05; margin: 0 0 6px; }
    .pk-lead { font-family: ${MONO}; font-size: 16px; line-height: 1.5; opacity: .72;
               margin: 0 0 16px; }

    /* ── THE SESSIONS ───────────────────────────────────────────────────
       ONE COLUMN ON A PHONE, and a ROW rather than a stack: the time on the
       left, how many places on the right, so a tile is 74px tall instead of
       104 and four of them are on screen at once without scrolling. Two
       columns only once there is genuinely room for two.

       The list is NOT a scroll region of its own. A scrollable box inside a
       scrollable page is the thing a thumb cannot aim at — one flick either
       moves the list or the page and the guest cannot tell which it will be.
       The page scrolls. */
    .pk-grid { display: grid; gap: 10px; grid-template-columns: 1fr; }
    @media (min-width: 560px) { .pk-grid { gap: 12px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); } }
    .pk-slot { position: relative; display: flex; align-items: center; justify-content: space-between;
               gap: 12px; min-height: 74px; padding: 14px 18px; cursor: pointer;
               background: ${PAPER}; color: ${INK}; border: none; border-radius: 10px;
               border-top: 3px solid ${GOLD}; text-align: left; width: 100%;
               box-sizing: border-box; -webkit-tap-highlight-color: transparent;
               box-shadow: 0 1px 2px ${INK}1f, 0 10px 18px -12px ${INK}59; }
    .pk-slot:active { transform: scale(.985); }
    .pk-slot-time { font-family: ${SERIF}; font-size: 36px; line-height: 1; }
    .pk-slot-left { font-family: ${MONO}; font-size: 13px; opacity: .66; text-align: right;
                    line-height: 1.4; }
    /* The soonest time with room. A gold ground rather than a bigger tile:
       size is already doing a job here and two signals fight. */
    .pk-slot.is-next { border-top-width: 3px; box-shadow: 0 1px 2px ${INK}1f,
                       0 12px 22px -12px ${INK}73, inset 0 0 0 2px ${GOLD}; }
    .pk-slot-tag { position: absolute; top: -9px; left: 14px; padding: 2px 8px;
                   background: ${GOLD}; color: ${INK}; border-radius: 3px;
                   font-family: ${SERIF}; font-size: 11px; font-weight: 700;
                   letter-spacing: .16em; text-transform: uppercase; }
    /* A full session is still pressable — it is how a guest asks for the
       waiting list — but it must not look like the others, and it now sits
       below a line instead of in among them. */
    .pk-slot.is-full { background: ${INK}14; border-top-color: ${INK}40;
                       box-shadow: none; min-height: 62px; }
    .pk-slot.is-full .pk-slot-time { opacity: .5; font-size: 30px; }
    .pk-divider { display: flex; align-items: center; gap: 12px; margin: 24px 0 12px;
                  font-family: ${SERIF}; font-size: 12px; font-weight: 600;
                  letter-spacing: .16em; text-transform: uppercase; opacity: .5; }
    .pk-divider::after { content: ''; flex: 1; height: 1px; background: ${INK}38; }

    .pk-chosen { font-family: ${SERIF}; font-size: clamp(46px, 13vw, 68px); line-height: 1;
                 margin: 0 0 18px; }
    .pk-field { display: block; margin: 0 0 18px; }
    .pk-field > span, .pk-label { display: block; font-family: ${SERIF}; font-size: 15px;
                      font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
                      opacity: .66; margin-bottom: 8px; }
    /* ⚠ font-size STAYS AT OR ABOVE 16px ON A PHONE. Mobile Safari zooms the
       whole page in on any focused input smaller than that, and a zoomed
       kiosk page cannot be zoomed back out — userScalable is off. 21px here. */
    .pk-field input { width: 100%; box-sizing: border-box; min-height: 60px;
                      background: #ffffff8c; color: ${INK}; border: 1px solid ${INK}2e;
                      border-radius: 8px; padding: 12px 16px; font-family: ${MONO};
                      font-size: 21px; outline: none; }
    .pk-field input:focus { border-color: ${GOLD}; box-shadow: 0 0 0 3px ${GOLD}59; }
    /* An address is longer than a name and the field is 358px wide at 390.
       18px fits about a third more of it while typing — still above Safari's
       16px zoom threshold, which is the floor, not a preference. The whole
       address is read back large on the next screen; this is for the typing. */
    .pk-field input[name^="e-"] { font-size: 18px; }
    .pk-hint { display: block; font-family: ${MONO}; font-size: 14px; font-style: normal;
               opacity: .62; margin-top: 8px; }

    .pk-party { display: flex; gap: 10px; flex-wrap: wrap; }
    .pk-chip { min-height: 60px; padding: 0 26px; border-radius: 8px; cursor: pointer;
               border: 1px solid ${INK}2e; background: #ffffff5c; color: ${INK};
               font-family: ${MONO}; font-size: 19px; }
    .pk-chip.is-on { background: ${INK}; color: ${SAGE}; border-color: ${INK}; }

    /* THE CHECK. The typo catcher — everything here is large on purpose. */
    .pk-check { background: ${PAPER}; border-radius: 10px; border-top: 3px solid ${GOLD};
                padding: 20px 16px; margin: 0 0 16px; text-align: center; }
    @media (min-width: 560px) { .pk-check { padding: 26px 24px; margin-bottom: 20px; } }
    /* The guest's own name, in the TEXT face: the display face is caps-only
       and a typed name must never be shouted back. */
    .pk-check-name { font-family: ${MONO}; font-size: clamp(21px, 5.4vw, 30px);
                     line-height: 1.25; word-break: break-word; }
    .pk-check-time { font-family: ${SERIF}; font-size: clamp(40px, 11vw, 54px); color: ${INK};
                     line-height: 1.02; margin: 4px 0 12px; }
    .pk-check-email { font-family: ${MONO}; font-size: clamp(18px, 4.6vw, 28px);
                      word-break: break-all; line-height: 1.35; }
    .pk-check-note { font-family: ${MONO}; font-size: 15px; opacity: .62; margin-top: 8px; }

    .pk-consent { display: flex; align-items: center; gap: 14px; min-height: 56px;
                  font-family: ${MONO}; font-size: 16px; line-height: 1.5; cursor: pointer; }
    .pk-consent input { width: 28px; height: 28px; flex: none; accent-color: ${GOLD}; }
    .pk-privacy { font-family: ${MONO}; font-size: 14px; line-height: 1.65; opacity: .68;
                  margin: 10px 0 22px; }
    .pk-privacy a { color: inherit; }

    /* ── THE ACTIONS ───────────────────────────────────────────────────
       STACKED AND FULL WIDTH ON A PHONE, and the primary at the BOTTOM: that
       is where the thumb already is, and it is the furthest point from the
       quiet button nobody means to press. Side by side at 390px gave two
       190px buttons, or a wrap that put Back under Confirm at random.

       NOT position:fixed. A bar pinned to the bottom is what the iOS keyboard
       covers; these stay in the flow directly under the fields, so the scroll
       that brings a field into view brings the button with it. */
    .pk-row { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .pk-row > * { width: 100%; }
    @media (min-width: 560px) {
      .pk-row { flex-direction: row; align-items: center; gap: 14px; flex-wrap: wrap; }
      .pk-row > * { width: auto; }
      .pk-row .pk-big { flex: 1 1 260px; }
    }
    .pk-big { min-height: 64px; padding: 16px 24px; cursor: pointer; box-sizing: border-box;
              background: ${GOLD}; color: ${INK}; border: none; border-radius: 8px;
              font-family: ${SERIF}; font-size: 19px; font-weight: 700;
              letter-spacing: .12em; text-transform: uppercase;
              -webkit-tap-highlight-color: transparent; }
    .pk-big[disabled] { opacity: .45; }
    .pk-big:active:not([disabled]) { transform: scale(.99); }
    .pk-quiet { min-height: 56px; padding: 14px 22px; cursor: pointer; background: none;
                box-sizing: border-box;
                border: 1px solid ${INK}40; border-radius: 8px; color: ${INK};
                font-family: ${SERIF}; font-size: 16px; letter-spacing: .1em;
                text-transform: uppercase; }
    /* The staff menu behind the PIN: one choice per line, nothing beside it. */
    .pk-menu { display: block; width: 100%; margin-top: 12px; }
    .pk-wait { margin-top: 14px; width: 100%; min-height: 64px; cursor: pointer;
               background: none; border: 1px dashed ${INK}59; border-radius: 8px;
               color: ${INK}; font-family: ${MONO}; font-size: 16px; }

    .pk-err { display: flex; flex-direction: column; gap: 4px; margin: 0 0 18px;
              padding: 16px 18px; border-radius: 8px; background: ${INK}; color: ${PAPER};
              font-family: ${MONO}; font-size: 17px; line-height: 1.5; }
    .pk-err span { opacity: .78; font-size: 15px; }
    .pk-offline { padding: 26px 22px; border-radius: 10px; background: ${INK}; color: ${PAPER};
                  font-family: ${MONO}; font-size: 19px; line-height: 1.6;
                  display: flex; flex-direction: column; gap: 8px; }
    .pk-offline span { opacity: .78; font-size: 16px; }

    /* ── THE GUARANTEE ─────────────────────────────────────────────────
       THE SCREEN THAT GETS TURNED ROUND. Two facts, both readable at arm's
       length by somebody who is not holding the phone: the name, and the
       time. Everything else on it is smaller than both on purpose. */
    .pk-done { text-align: center; padding: 14px 0 0; }
    .pk-done-name { font-family: ${MONO}; font-size: clamp(24px, 6.4vw, 34px);
                    line-height: 1.25; letter-spacing: -.01em; margin: 0 0 2px;
                    word-break: break-word; }
    .pk-done-h { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 5.6vw, 44px);
                 line-height: 1.1; margin: 8px 0 0; opacity: .82; }
    .pk-time { font-family: ${SERIF}; font-size: clamp(88px, 27vw, 170px); line-height: .92;
               margin: 8px 0 12px; }
    .pk-done-sub { font-family: ${MONO}; font-size: 17px; line-height: 1.55; margin: 0 0 6px; }
    .pk-done-mail { font-family: ${MONO}; font-size: 15px; opacity: .66; margin: 14px 0 0; }
    .pk-done-warn { font-family: ${MONO}; font-size: 17px; margin: 16px 0 0;
                    padding: 14px 16px; border-radius: 8px; background: ${INK}; color: ${PAPER}; }
    .pk-done .pk-big { margin-top: 26px; max-width: 420px; margin-left: auto; margin-right: auto; }

    .pk-unlock { max-width: 460px; }
    .pk-pin { width: 100%; box-sizing: border-box; min-height: 72px; font-size: 34px;
              letter-spacing: .4em; text-align: center; border-radius: 8px;
              border: 1px solid ${INK}40; background: #ffffff8c; color: ${INK};
              font-family: ${MONO}; margin: 10px 0 16px; outline: none; }

    @keyframes pk-dot { 0%,100% { opacity: .22 } 50% { opacity: 1 } }
    .pk-dots { display: inline-flex; gap: 4px; margin-left: 8px; }
    .pk-dots i { width: 5px; height: 5px; border-radius: 50%; background: currentColor;
                 animation: pk-dot 1.1s ease-in-out infinite; }
    .pk-dots i:nth-child(2) { animation-delay: .18s }
    .pk-dots i:nth-child(3) { animation-delay: .36s }
    @media (prefers-reduced-motion: reduce) { .pk-dots i { animation: none; opacity: .7 } }
  ` }} />
}
