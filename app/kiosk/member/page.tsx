'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import RadarChart from '@/components/whisky/RadarChart'
import { RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import EmptyState from '@/components/members/EmptyState'
import { SkeletonLines } from '@/components/members/Skeleton'
import { typeLabel } from '@/lib/fixtures'
import { useLang } from '@/lib/lang'
import MemberPour from '@/components/kiosk/MemberPour'
import { DateBlock, dotOf, kindMeta, whatsOnCss, whatsOnNarrowCss } from '@/components/events/whats-on'

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
const GOLD = '#D4B85A'
const GROUND = '#052E20'

const ABANDON_MS = 15_000   // tap-and-walk-away must not leave a name on the bar
const IDLE_MS = 85_000      // just inside the server's 90s, so the exit is graceful

interface Me {
  first_name: string | null; palate: string[]; room: string | null; expires_at: string
  card_credit_vnd?: number | null
  locker?: { no: string; label: string | null } | null
  cats: Cat[] | null; shape: ShapeValues | null
}
interface Entry { id: string; title: string; title_vn: string | null; entry_date: string
                  start_time: string | null; end_time: string | null; space: string | null; kind: string }
interface Fixture { id: string; type: string; title: string; date: string; location: string | null
                    description: string | null; max_signups: number | null
                    signup_deadline: string | null; is_full: boolean | null }
interface Week { from: string; to: string; entries: Entry[]; fixtures: Fixture[]
  // Attachment ids for the rows above, images only, private hires excluded.
  art?: Record<string, { id: string; kind: string }>
  /** The fixtures THIS member is already down for. Their own rows, nobody
   *  else's — a tablet is shoulder height. */
  signed_up?: string[]
  /** How many are in, per fixture. A TOTAL, from the counts-only function —
   *  the names behind it stay unreadable, here as everywhere else. */
  counts?: Record<string, number> }

const VN = 'Asia/Ho_Chi_Minh'
const vnNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: VN }))

// THE CLUB RUNS PAST MIDNIGHT. "Good morning" to someone three drinks into a
// Thursday reads as broken, so the evening runs until 05:00 — the day boundary is
// not where the evening ends. Same lesson as the board's midnight arithmetic.
function greeting(vn: boolean): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: VN }).format(new Date()))
  // THE CLUB RUNS PAST MIDNIGHT. "Good morning" to someone three drinks into a
  // Friday is the tablet admitting it does not know where it is.
  if (h >= 5 && h < 12) return vn ? 'Chào buổi sáng' : 'Good morning'
  if (h >= 12 && h < 18) return vn ? 'Chào buổi chiều' : 'Good afternoon'
  return vn ? 'Chào buổi tối' : 'Good evening'
}

// ── THE LINE, AND THE THREE STRINGS THAT DRESS IT ────────────────────────
// Everything is pinned to Sài Gòn: a tablet on the bar shows the club's day,
// whatever the device's own clock believes.
interface Line {
  key: string; ms: number; dot: string; tag: string
  title: string; title_vn?: string | null
  meta: string; desc?: string | null; art?: string
  fixtureId?: string
  cap?: number | null; count?: number; full?: boolean; closed?: boolean; signed?: boolean
}

const dayStamp = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: VN })
const hhmmOf = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN })
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const entryTime = (e: Entry) =>
  e.start_time ? (e.end_time ? `${hhmm(e.start_time)}–${hhmm(e.end_time)}` : hhmm(e.start_time)) : 'All day'

// TODAY / TOMORROW in gold beside the type, the way the portal says it. Both
// languages, because nobody picks one on a tablet they share.
const rel = (ms: number) => {
  const days = Math.round((ms - Date.now()) / 86400000)
  if (days === 0) return 'today · hôm nay'
  if (days === 1) return 'tomorrow · ngày mai'
  if (days > 0 && days < 7) return `in ${days} days · ${days} ngày nữa`
  return ''
}

export default function KioskMember() {
  const router = useRouter()
  const [tap, setTap] = useState<{ member_no: string; first_name: string | null } | null>(null)
  const [num, setNum] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  // The bottom bar's EN/VN switch changed the context and this page ignored it:
  // every string here was English, with a few printed "EN · VN" side by side.
  const { t, lang } = useLang()
  const goRef = useRef<HTMLButtonElement | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [week, setWeek] = useState<Week | null>(null)
  const [joining, setJoining] = useState<string | null>(null)
  const [joinMsg, setJoinMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
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
  // PUT MY NAME DOWN. Runs as the member on the server; the database decides
  // the cap and the deadline and says why if it refuses, so the tablet repeats
  // its answer rather than inventing one.
  const REFUSAL: Record<string, string> = {
    full: 'That one filled up. · Sự kiện đã kín chỗ.',
    closed: 'Sign-ups have closed. · Đã đóng đăng ký.',
    already: 'You are already down for that. · Quý vị đã đăng ký rồi.',
    unknown: 'That event is no longer listed. · Sự kiện không còn trong danh sách.',
    auth: 'Please sign in again. · Vui lòng đăng nhập lại.',
  }
  const putNameDown = useCallback(async (fixtureId: string) => {
    setJoining(fixtureId); setJoinMsg(null)
    try {
      const r = await fetch('/api/kiosk/member/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixture_id: fixtureId }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setJoinMsg({ id: fixtureId, ok: false, text: j.error || 'That did not send.' }); return }
      if (j.ok === false) { setJoinMsg({ id: fixtureId, ok: false, text: REFUSAL[j.reason] || 'Could not sign you up.' }); return }
      // Re-read the week so the row flips to "You're in" from the server's
      // answer rather than from a hopeful guess here.
      const wk = await fetch('/api/kiosk/member/week', { cache: 'no-store' }).then(x => x.ok ? x.json() : null).catch(() => null)
      if (wk?.week) setWeek(wk.week)
      setJoinMsg({ id: fixtureId, ok: true, text: 'You are down for it. · Đã đăng ký.' })
    } finally { setJoining(null) }
  }, [])

  const bumpAbandon = useCallback(() => {
    if (me) return
    if (abandon.current) clearTimeout(abandon.current)
    abandon.current = setTimeout(() => router.replace('/kiosk/board'), ABANDON_MS)
  }, [me, router])
  useEffect(() => { bumpAbandon(); return () => { if (abandon.current) clearTimeout(abandon.current) } }, [bumpAbandon, pin, num])

  // ── THE BUTTON COMES TO THEM ────────────────────────────────────────────
  // Padding the page clear of the bar means Continue can be SCROLLED to; it
  // does not mean anybody sees it. With the Android keyboard up, a landscape
  // tablet has about 280px of room above the bar and this screen needs 468 —
  // so the button starts below the fold every time, and the member is looking
  // at a PIN they have finished typing and no way to send it.
  //
  // The sixth digit is the exact moment the button becomes the only thing that
  // matters, so that is when it is brought into view. Cheaper and far more
  // predictable than trying to track the keyboard with visualViewport, which
  // fires differently on every Android build the club might end up with.
  useEffect(() => {
    if (pin.length === 6) goRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pin])

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

  // Re-read /me after a note is logged: rederiveAndPersist has just rebuilt the
  // taste vector, so the radar beside the button fills in without the member
  // having to do anything. The point of the tap is visible, immediately.
  const refreshMe = useCallback(async () => {
    const m = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
    if (m.ok) setMe((await m.json()).member)
  }, [])

  const submit = async () => {
    if (pin.length !== 6 || busy) return
    setBusy(true); setErr(false)
    // ── BUSY COVERS BOTH REQUESTS ───────────────────────────────────────
    // setBusy(false) used to run between them, so for the whole of the second
    // call — the one that actually fetches the member — the screen showed an
    // idle "Continue" button and no sign anything was happening. On a tablet
    // that is a member pressing it again. (Owner, 2026-10-02: "There should
    // also be a loading wheel or something to show its loading after you enter
    // your code.")
    try {
      const r = await fetch('/api/kiosk/member/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: num.trim(), pin }),
      })
      if (!r.ok) { setErr(true); setPin(''); return }
      const m = await fetch('/api/kiosk/member/me', { cache: 'no-store' })
      if (!m.ok) { setErr(true); setPin(''); return }
      setMe((await m.json()).member)
    } catch { setErr(true); setPin('') }
    finally { setBusy(false) }
  }

  // ── THE MEMBER'S OWN VIEW ───────────────────────────────────────────────
  // Left column FIXED: who they are, and it never scrolls. Right column scrolls,
  // and scrolling resets the idle clock — a member who scrolls is still present.
  if (me) {
    // ── THE WEEK, AS ONE LINE EACH ────────────────────────────────────────
    // The same shape the portal builds: fixtures and house entries merged into
    // one chronological run, each with a date, a type, a title and — where the
    // club is taking names — how many are in and the way to join them. Nothing
    // is grouped under a day heading any more; the date IS the left of the line
    // (owner, 2026-09-25: "It better look like the whats on in the portal").
    const lines: Line[] = []
    for (const e of week?.entries || []) {
      const ms = new Date(`${e.entry_date}T${e.start_time ? e.start_time.slice(0, 5) : '12:00'}:00+07:00`).getTime()
      const meta = kindMeta(e.kind)
      lines.push({
        key: `e-${e.id}`, ms, dot: meta.dot, tag: `${meta.label} · ${meta.vn}`,
        title: e.title, title_vn: e.title_vn,
        meta: [dayStamp(ms), entryTime(e), e.space].filter(Boolean).join(' · '),
        art: week?.art?.[`calendar_entry:${e.id}`]?.id,
      })
    }
    const signedUp = new Set(week?.signed_up || [])
    for (const f of week?.fixtures || []) {
      const ms = new Date(f.date).getTime()
      const cap = f.max_signups
      const signed = signedUp.has(f.id)
      // Staff can mark an event full before every name is in — places taken on
      // Zalo are gone even if the count has not caught up. Exactly the portal's
      // rule, and the reason the number reads the cap when that switch is on.
      const tally = week?.counts?.[f.id] || 0
      const full = !!f.is_full || (cap != null && tally >= cap)
      lines.push({
        key: `f-${f.id}`, ms, dot: dotOf(f.type),
        tag: `${typeLabel(f.type, 'en')} · ${typeLabel(f.type, 'vn')}`,
        title: f.title,
        meta: [dayStamp(ms), hhmmOf(ms), f.location].filter(Boolean).join(' · '),
        desc: f.description,
        art: week?.art?.[`fixture:${f.id}`]?.id,
        // A fixture can be signed up for, right here — the board tells members
        // to sign in to do exactly this (owner, 2026-09-25).
        fixtureId: f.id,
        cap, count: full && cap != null ? Math.max(tally, cap) : tally,
        full, closed: !!f.signup_deadline && Date.now() > +new Date(f.signup_deadline), signed,
      })
    }
    lines.sort((a, b) => a.ms - b.ms)

    return (
      <div style={twoCol}>
        {/* ── FIXED: who they are ─────────────────────────────────────────── */}
        <div style={fixedCol}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)' }}>
            {me.room}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 'clamp(30px,4.4vh,52px)', lineHeight: 1.1, marginTop: 10 }}>
            {greeting(lang === 'vn')}, {me.first_name}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(229,212,194,.55)', marginTop: 10 }}>
            {vnNow().toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: VN })}
          </div>

          {/* ── WHAT IS ACTUALLY YOURS ──────────────────────────────────────
              A member with no taste profile used to get a greeting, a date and
              a Done button — "literally nothing on that page". These two are
              facts the club already holds about THEM, and the two a person
              standing at a bar wants: what is on the card, and where the bottle
              is. Each drawn only when there is something to draw. */}
          {(me.card_credit_vnd != null || me.locker) && (
            <div style={factRow}>
              {me.card_credit_vnd != null && (
                <div>
                  <div style={factLabel}>{t('On your card', 'Số dư thẻ')}</div>
                  <div style={{ ...factValue, color: GOLD }}>
                    {new Intl.NumberFormat('en-US').format(me.card_credit_vnd)} ₫
                  </div>
                </div>
              )}
              {me.locker && (
                <div>
                  <div style={factLabel}>{t('Your locker', 'Tủ khóa')}</div>
                  <div style={factValue}>{me.locker.no}{me.locker.label ? ` · ${me.locker.label}` : ''}</div>
                </div>
              )}
            </div>
          )}

          {/* No palate yet? Say what fills it — and then offer the thing that
              fills it, right here. The club has no tasting notes at all, which
              is why this radar is empty for almost everybody; the fix is not a
              better empty state, it is asking at the bar. */}
          {!(me.cats && me.shape && Object.keys(me.shape).length > 0) && (
            <div style={{ marginTop: 'clamp(14px,3vh,32px)' }}>
              <div style={sectionLabel}>{t('Your palate', 'Khẩu vị của bạn')}</div>
              <p style={inviteText}>
                {t('Nothing recorded yet. Note what is in your glass and it starts here.',
                   'Chưa ghi nhận gì. Hãy ghi lại ly bạn đang uống và khẩu vị bắt đầu từ đây.')}
              </p>
            </div>
          )}

          {/* ── THE ONE THING WORTH DOING ON THIS SCREEN ──────────────────
              Directly under the palate, because it is what moves it. */}
          <MemberPour onLogged={refreshMe} />

          {me.cats && me.shape && Object.keys(me.shape).length > 0 && (
            <div style={{ marginTop: 'clamp(14px,3vh,32px)' }}>
              <div style={sectionLabel}>{t('Your palate', 'Khẩu vị của bạn')}</div>
              {/* The portal's radar, not a second one — so it inherits f5d2c90. */}
              <div style={{ marginLeft: -18 }}>
                <RadarChart cats={me.cats} shapes={[{ values: me.shape, color: RADAR_GOLD, label: '' }]} size={230} />
              </div>
            </div>
          )}

          {/* Sign-out is unmissable but NOT in the top-right, where the eye goes for
              the clock and a wandering thumb would dump a member to the board. */}
          <button onClick={() => toBoard('done')} style={doneBtn}>{t('Done', 'Xong')}</button>
        </div>

        {/* ── SCROLLS: what's on ──────────────────────────────────────────── */}
        <div style={weekCol} className="wo-kiosk">
          {/* The portal's own fixtures card, from components/events/whats-on.tsx —
              the SAME rules, not a copy of them.
              A CONTAINER QUERY, not a media query: the portal falls back to the
              stacked row when the WINDOW is narrow, and here the window is a
              landscape tablet while the column is half of it. Asking the column
              its own width gets the date down the left on the tablets the club
              actually owns, and the stacked row on anything squeezed. */}
          <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .wo-kiosk { container-type: inline-size; }
${whatsOnCss()}
        @container (max-width: 620px) {
${whatsOnNarrowCss('          ')}
        }
        /* the tablet's own hand: thumbs, not a mouse, and no page to leave to */
        .wo-kiosk .wo-row:first-of-type { padding-top: 18px; }
        .wo-kiosk .wo-desc { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
                             overflow: hidden; font-size: 12.5px; line-height: 1.8; }
        .wo-kiosk .wo-btn { min-height: 48px; padding: 0 0 8px; font-size: 13.5px; }
        .wo-kiosk .wo-thumb { max-height: 200px; border-radius: 10px; }
        .wo-kiosk .wo-msg { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; margin-top: 12px; }
          ` }} />
          <div style={sectionLabel}>{t('This week', 'Tuần này')}</div>

          {!week ? (
            <div style={{ marginTop: 22 }}><SkeletonLines lines={6} gap={16} /></div>
          ) : lines.length === 0 ? (
            <div style={{ marginTop: 30, maxWidth: 420 }}>
              {/* It read "Nothing in the diary THIS WEEK" directly under a
                  heading that already said "This week" — the owner read the
                  words twice and said so. And its Vietnamese was an empty
                  comment waiting for a translation that never came, so half
                  the membership got nothing at all. */}
              <EmptyState
                title={t('Nothing in the diary.', 'Chưa có gì trong lịch.')}
                body={t('The bar is the event. Ask whoever is pouring what is open tonight.',
                        'Quầy bar chính là sự kiện. Hãy hỏi người đang phục vụ xem tối nay có gì đang mở.')}
              />
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {lines.map(it => (
                <article key={it.key} className={'wo-row' + (it.signed ? ' is-in' : '')}>
                  <DateBlock ms={it.ms} lang="en" />
                  <div className="wo-main">
                    <div className="wo-tags">
                      <span className="wo-type"><i style={{ background: it.dot }} />{it.tag}</span>
                      {rel(it.ms) && <span className="wo-rel">{rel(it.ms)}</span>}
                      {it.signed && <span className="wo-in">✓ {t('You\u2019re in', 'Đã đăng ký')}</span>}
                    </div>
                    <h3 className="wo-title">{it.title}</h3>
                    {it.title_vn && <h3 className="wo-title" style={{ fontSize: 22, opacity: .5, marginTop: 4 }}>{it.title_vn}</h3>}
                    <div className="wo-meta">{it.meta}</div>
                    {it.desc && <p className="wo-desc">{it.desc}</p>}

                    {/* PUT MY NAME DOWN. The board promised this and the tablet
                        could not do it: a member signed in with their PIN, found
                        the event, and had no way to join it. Their own action,
                        run as them — and the count beside it is a total, never
                        a list of who else is coming. */}
                    {it.fixtureId && (
                      <div className="wo-action">
                        <div className="wo-count">
                          <span className="wo-count-n">{it.count}{it.cap != null ? `/${it.cap}` : ''}</span> in · tham gia
                          {it.cap != null && it.cap > 0 && (
                            <span className="wo-bar" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, Math.round(((it.count || 0) / it.cap) * 100))}%` }} />
                            </span>
                          )}
                        </div>
                        {it.signed ? null
                          : it.closed ? <span className="wo-closed">Closed · Đã đóng</span>
                          : it.full ? <span className="wo-closed">Full · Hết chỗ</span>
                          : <button onClick={() => putNameDown(it.fixtureId!)}
                                    disabled={joining === it.fixtureId} className="wo-btn">
                              {joining === it.fixtureId ? '…' : <>Put my name down <span className="pk-go">→</span></>}
                            </button>}
                      </div>
                    )}
                    {joinMsg && joinMsg.id === it.fixtureId && (
                      <div className="wo-msg" style={{ color: joinMsg.ok ? '#7AB07A' : '#C49555' }}>{joinMsg.text}</div>
                    )}
                  </div>
                  {/* The event's picture, whole and uncropped — the portal shows an
                      invitation to be READ, and so does the tablet. Nothing here is
                      member data, and the fetch is excluded from the service worker
                      twice over: /api/* and the supabase.co host both short-circuit
                      before the static-asset rule that would otherwise cache a .jpg.
                      Verified against real Cache Storage, not assumed. No link off
                      it: there is nowhere for a kiosk to open a new tab to. */}
                  {it.art && (
                    <div className="wo-thumb-link">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="wo-thumb" src={`/api/entries/attachment/${it.art}`} alt="" />
                    </div>
                  )}
                </article>
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
      {/* A WHEEL, not just a word. "One moment" on its own is a label that
          might have been there all along; a turning thing is the only part a
          member reads as "it is working". Reduced motion gets the word alone,
          because a spinner that does not spin is furniture. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .km-spin { display: inline-block; width: 13px; height: 13px; vertical-align: -1px;
                   border: 2px solid rgba(229,212,194,.28); border-top-color: #D4B85A;
                   border-radius: 50%; animation: km-turn .75s linear infinite; }
        @keyframes km-turn { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .km-spin { display: none; } }
      ` }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 460 }}>
        {tap?.first_name
          /* It said "Good evening" at every hour of the day, beside a
             greeting() that has known better since it was written. */
          ? <div style={{ fontFamily: SERIF, fontSize: 'clamp(28px,4.2vw,46px)' }}>{greeting(lang === 'vn')}, {tap.first_name}</div>
          : <div style={{ fontFamily: SERIF, fontSize: 'clamp(24px,3.4vw,38px)' }}>{t('Your surname', 'Họ của bạn')}</div>}

        {!tap && (
          <input
            value={num} onChange={e => { setNum(e.target.value); bumpAbandon() }}
            placeholder={t('Your surname', 'Họ của bạn')} autoCapitalize="words" autoComplete="off" spellCheck={false}
            style={{ ...field, marginTop: 18 }}
          />
        )}

        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(229,212,194,.5)', marginTop: 26 }}>
          {t('Enter your six-digit PIN', 'Nhập mã PIN sáu chữ số')}
        </div>
        <input
          value={pin} inputMode="numeric" autoFocus={!!tap}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setErr(false); bumpAbandon() }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          style={{ ...field, marginTop: 12, fontSize: 34, letterSpacing: '.5em' }}
        />

        <button ref={goRef} onClick={submit} disabled={pin.length !== 6 || !num.trim() || busy}
          style={{ ...ghost, marginTop: 20, opacity: pin.length === 6 && num.trim() && !busy ? 1 : .35 }}>
          {busy
            ? <><span className="km-spin" aria-hidden /> {t('One moment', 'Xin chờ một chút')}</>
            : t('Continue', 'Tiếp tục')}
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
  // Less the bottom bar, or it would sit over the Done button (--kiosk-bar, KioskBar).
  height: 'calc(100dvh - var(--kiosk-bar, 0px))', background: GROUND, color: INK, display: 'flex',
  gap: 'clamp(20px,4vw,64px)', padding: 'clamp(16px,4vh,44px) clamp(20px,5vw,64px)', overflow: 'hidden',
}
const factRow: React.CSSProperties = {
  display: 'flex', gap: 'clamp(18px,3vw,40px)', flexWrap: 'wrap',
  marginTop: 'clamp(14px,3vh,30px)', paddingTop: 'clamp(12px,2.4vh,22px)',
  borderTop: '1px solid rgba(229,212,194,.12)',
}
const factLabel: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
  color: 'rgba(229,212,194,.45)',
}
const factValue: React.CSSProperties = { fontFamily: SERIF, fontSize: 'clamp(20px,2.6vh,28px)', marginTop: 7 }
const inviteText: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85, color: 'rgba(229,212,194,.62)',
  margin: '10px 0 0', maxWidth: '34ch',
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
const doneBtn: React.CSSProperties = {
  marginTop: 'auto', alignSelf: 'flex-start',
  background: 'none', border: '1px solid rgba(229,212,194,.35)', borderRadius: 8, color: INK,
  fontFamily: MONO, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
  padding: '16px 34px', minHeight: 56, cursor: 'pointer',
}

// ── THE KEYPAD SCREEN ──────────────────────────────────────────────────────
// minHeight KEEPS A SHORT SCREEN CLEAR OF THE BAR AND NOTHING ELSE. The moment
// the content is taller than the viewport it overflows, and KioskBar is
// position: fixed — so the last things on the page end up underneath it.
//
// Which is every time somebody signs in: focusing the PIN field opens the
// Android keyboard, 100dvh collapses to about 45% of the screen, and at
// 1280x360 the CONTINUE button lands at 286-329 with the bar at 277.
// elementFromPoint over its own centre returns the bar. The member is looking
// at the button they cannot press. (Owner, 2026-10-02: "The member log in
// button on the tbalet is hidden behind the bottom nav".)
//
// Same fault and same fix as the staff screen's Scroll: pad the bottom by the
// bar's own published height so overflowing content clears it.
const wrap: React.CSSProperties = {
  minHeight: 'calc(100dvh - var(--kiosk-bar, 0px))', background: GROUND, color: INK,
  display: 'flex', flexDirection: 'column',
  padding: '5vh 6vw', paddingBottom: 'calc(5vh + var(--kiosk-bar, 0px))',
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
