'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { vnDateString, vnEventLabel } from '@/lib/datetime'
import type { Fixture, FixtureSignup } from '@/lib/types'
import { typeLabel, isSport } from '@/lib/fixtures'
import { useLang, pick, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'
import MemberPage from '@/components/MemberPage'
import { CreamInk } from '@/components/public/CreamInk'

// "What's On" — ONE surface for everything happening at the club. Sports
// fixtures (from `fixtures`, with RSVP) and house happenings (from
// calendar_entries — closures, tastings, distiller visits; informational, no
// RSVP) are merged into a single chronological timeline, tagged by type. Past
// fixtures with results show below. This replaces the old separate Events +
// Sports Fixtures pages.
//
// Set as a club fixtures card: the date large in the display face down the
// left, the type in mono, the title large, and the RSVP plainly stated at the
// foot of each line — hairlines between, no boxes.

interface Entry {
  id: string
  title: string
  title_vn: string | null
  description: string | null
  entry_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string | null
  kind: string
}

const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const INK = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

// The dot beside each type stays local (it is this page's visual language); the
// LABELS come from lib/fixtures.ts so a type added there is never nameless here.
// Every colour here is one that reads on the bottle green.
const TYPE_DOT: Record<string, string> = {
  golf: '#A9BB84', tennis: '#7FB3A0', padel: '#B2AA98', hash: '#E5D4C2',
  dinner: '#C79A6B', tasting: '#D4B85A', social: '#9E8FC4', other: '#D4B85A',
}
const dotOf = (t: string) => TYPE_DOT[t] || TYPE_DOT.other

// The event's picture, where one was supplied. An image renders; a PDF gets a
// LINK CARD and never an embed — the CSP sets object-src 'none', so an inline
// PDF fires nowhere on this site, and a broken frame is worse than an honest
// label. Named a link card here so nobody rebuilds the embed later.
function Thumb({ a }: { a?: { id: string; kind: string; filename: string } }) {
  const { t } = useLang()
  if (!a) return null
  if (a.kind === 'pdf') {
    return (
      <a href={`/api/entries/attachment/${a.id}`} target="_blank" rel="noreferrer" className="wo-pdf">
        <span aria-hidden>📄</span> {a.filename}
      </a>
    )
  }
  // An invitation is meant to be READ. A 76px square crop showed a corner of one
  // and nothing else, so: show the whole image, bigger, and open it full size on
  // tap. Never cropped — the picture keeps its own proportions inside the frame.
  return (
    <a href={`/api/entries/attachment/${a.id}`} target="_blank" rel="noreferrer"
       className="wo-thumb-link" aria-label={t('Open the full image', 'Mở ảnh đầy đủ')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wo-thumb" src={`/api/entries/attachment/${a.id}`} alt="" loading="lazy" />
    </a>
  )
}
const KIND_META: Record<string, { label: string; vn: string; dot: string }> = {
  event:        { label: 'Event',          vn: 'Sự kiện',          dot: '#D4B85A' },
  meeting:      { label: 'Meeting',        vn: 'Cuộc họp',         dot: '#B2AA98' },
  interview:    { label: 'Interview',      vn: 'Phỏng vấn',        dot: '#B2AA98' },
  reminder:     { label: 'Reminder',       vn: 'Nhắc nhở',         dot: '#B2AA98' },
  closure:      { label: 'Club closed',    vn: 'CLB đóng cửa',     dot: '#E08A7E' },
  private_hire: { label: 'Private event',  vn: 'Sự kiện riêng',    dot: '#D4B85A' },
  supplier:     { label: 'Distiller visit',vn: 'Nhà chưng cất ghé thăm', dot: '#8FC48F' },
  tasting:      { label: 'Tasting',        vn: 'Nếm thử',          dot: '#D4B85A' },
  other:        { label: 'Notice',         vn: 'Thông báo',        dot: '#B2AA98' },
}

// Pinned to Vietnam, NOT the viewer's browser. A member reading from Scotland or
// a reciprocal club must see the time the event actually starts here.
// Vietnamese mirrors vnEventLabel's two formatters, same options, vi-VN locale.
const VI_EVENT_DATE = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: 'numeric', month: 'short' })
const VI_EVENT_TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })  // Vietnamese reads 19:00, not 7:00 CH
const fmtFixtureDate = (d: string, lang: Lang) => {
  if (lang !== 'vn') return vnEventLabel(d)
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? '' : `${VI_EVENT_DATE.format(date)} · ${VI_EVENT_TIME.format(date)}`
}
const fmtEntryDate = (iso: string, lang: Lang) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
// Display-only Vietnamese for the stored session labels; a custom label stays as typed.
const SESSION_VN: Record<string, string> = { early: 'Buổi chiều', evening: 'Buổi tối', late: 'Khuya' }
const fmtEntryTime = (e: Entry, t: (en: string, vn: string) => string) => {
  if (e.start_time) { const st = e.start_time.slice(0, 5); return e.end_time ? `${st}–${e.end_time.slice(0, 5)}` : st }
  if (e.session_label) { const en = e.session_label.charAt(0).toUpperCase() + e.session_label.slice(1); return t(en, SESSION_VN[e.session_label.toLowerCase()] || en) }
  return t('All day', 'Cả ngày')
}
const relativeDate = (ms: number, t: (en: string, vn: string) => string) => {
  const days = Math.round((ms - Date.now()) / 86400000)
  if (days === 0) return t('today', 'hôm nay')
  if (days === 1) return t('tomorrow', 'ngày mai')
  if (days > 0 && days < 7) return t(`in ${days} days`, `${days} ngày nữa`)
  return ''
}

// ── The date, set large down the left of each line ───────────────────────
// Sài Gòn's calendar day, in the reader's language (vi-VN in Vietnamese).
const TZ = 'Asia/Ho_Chi_Minh'
const PARTS: Record<Lang, { day: Intl.DateTimeFormat; month: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat }> = {
  en: {
    day: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric' }),
    month: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'short' }),
    weekday: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }),
  },
  vn: {
    day: new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: 'numeric' }),
    month: new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, month: 'short' }),
    weekday: new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'short' }),
  },
}
function DateBlock({ ms, lang }: { ms: number; lang: Lang }) {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return <div className="wo-date" />
  const p = PARTS[lang]
  return (
    <div className="wo-date" aria-hidden="true">
      <div className="wo-day">{p.day.format(d)}</div>
      <div className="wo-mon">{p.month.format(d)}</div>
      <div className="wo-wd">{p.weekday.format(d)}</div>
    </div>
  )
}

type Item =
  | { type: 'fixture'; ms: number; f: Fixture }
  | { type: 'entry'; ms: number; e: Entry }

export default function WhatsOnPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { t, lang } = useLang()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [signups, setSignups] = useState<FixtureSignup[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Which entries have a file. IDS ONLY — the file itself is fetched through
  // /api/entries/attachment/[id], which re-checks visibility. A staff-only
  // entry is never listed, so this page never learns one exists.
  const [attachments, setAttachments] = useState<Record<string, { id: string; kind: string; filename: string }>>({})
  const [filter, setFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => { const id = setInterval(() => setNowTs(Date.now()), 60_000); return () => clearInterval(id) }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Separate from the Promise.all below on purpose: that array is
      // DESTRUCTURED POSITIONALLY, so slipping a differently-shaped call into it
      // silently re-binds every result after it.
      fetch('/api/members/entries/attachments', { cache: 'no-store' })
        .then(r => r.json()).then(d => { if (!cancelled) setAttachments(d.attachments || {}) })
        .catch(() => {})
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) setUserId(user.id)
      const [{ data: f }, { data: s }, { data: c }, { data: en }] = await Promise.all([
        supabase.from('fixtures').select('*').order('date', { ascending: false }),
        supabase.from('fixture_signups').select('*'),
        supabase.rpc('fixture_signup_counts'),
        supabase.from('calendar_entries')
          .select('id, title, title_vn, description, entry_date, start_time, end_time, session_label, space, kind')
          .eq('visibility', 'member').gte('entry_date', vnDateString())
          .order('entry_date').order('start_time', { ascending: true, nullsFirst: true }),
      ])
      if (cancelled) return
      if (f) setFixtures(f)
      if (s) setSignups(s)
      if (c) setCounts(Object.fromEntries((c as { fixture_id: string; signups: number }[]).map(r => [r.fixture_id, Number(r.signups)])))
      if (en) setEntries(en as Entry[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const isSignedUp = (id: string) => signups.some(s => s.fixture_id === id && s.user_id === userId)
  const deadlinePassed = (f: Fixture) => f.signup_deadline ? new Date(f.signup_deadline).getTime() < nowTs : false
  const REFUSAL: Record<string, string> = {
    full: t('That one filled up while you were looking.', 'Sự kiện này vừa kín chỗ trong lúc bạn đang xem.'),
    closed: t('Sign-ups for that one have closed.', 'Sự kiện này đã đóng đăng ký.'),
    already: t('You’re already down for that one.', 'Bạn đã có tên trong sự kiện này rồi.'),
    unknown: t('That fixture is no longer listed.', 'Sự kiện này không còn trong danh sách.'),
    auth: t('Please sign in again.', 'Vui lòng đăng nhập lại.'),
  }

  const toggleSignup = async (fixtureId: string) => {
    if (!userId) return
    setBusyId(fixtureId); setErrorMsg(null)
    const signingUp = !isSignedUp(fixtureId)
    // The cap and the deadline are decided in the DATABASE now, in one transaction:
    // a direct insert could overfill on two simultaneous taps, and a stale tab could
    // sign up after close. The function returns WHY it refused so we can say it.
    const op = signingUp
      ? supabase.rpc('fixture_signup', { p_fixture_id: fixtureId })
      : supabase.from('fixture_signups').delete().eq('fixture_id', fixtureId).eq('user_id', userId)
    const { data: reason, error } = await op
    if (error) { setErrorMsg(error.message || t('Could not update signup.', 'Không thể cập nhật đăng ký.')); setBusyId(null); return }
    if (signingUp && reason) {
      setErrorMsg(REFUSAL[reason as string] || t('Could not sign you up.', 'Không thể đăng ký cho bạn.'))
      // Still refresh: 'full' means somebody else took the seat, and the count on
      // screen is now wrong in a way the member can see.
    }
    const [{ data }, { data: c }] = await Promise.all([
      supabase.from('fixture_signups').select('*'),
      supabase.rpc('fixture_signup_counts'),
    ])
    if (data) setSignups(data)
    if (c) setCounts(Object.fromEntries((c as { fixture_id: string; signups: number }[]).map(r => [r.fixture_id, Number(r.signups)])))
    setBusyId(null)
  }

  // Merge upcoming fixtures + happenings into one chronological timeline.
  const upcoming: Item[] = useMemo(() => {
    const fx: Item[] = fixtures.filter(f => new Date(f.date).getTime() >= nowTs).map(f => ({ type: 'fixture', ms: new Date(f.date).getTime(), f }))
    // start_time is a Postgres `time` → "HH:MM:SS"; slice to HH:MM or the extra
    // seconds group makes an invalid Date (NaN) that never sorts into place.
    const ev: Item[] = entries.map(e => ({ type: 'entry', ms: new Date(`${e.entry_date}T${(e.start_time ? e.start_time.slice(0, 5) : '12:00')}:00+07:00`).getTime(), e }))
    return [...fx, ...ev].sort((a, b) => a.ms - b.ms)
  }, [fixtures, entries, nowTs])
  const pastFixtures = useMemo(() => fixtures.filter(f => new Date(f.date).getTime() < nowTs), [fixtures, nowTs])

  const shownUpcoming = upcoming.filter(it =>
    filter === 'all' ? true
    // A house event (dinner/tasting/social) is a happening, not a sport — without
    // this it would match no tab at all and be reachable only from All.
    : filter === 'happenings' ? it.type === 'entry' || (it.type === 'fixture' && !isSport(it.f.type))
    : it.type === 'fixture' && it.f.type === filter)
  const myUpcoming = upcoming.filter(it => it.type === 'fixture' && isSignedUp(it.f.id)).length
  const shownPast = pastFixtures.filter(f => filter === 'all' || f.type === filter)

  const tabs: { key: string; label: string }[] = [
    { key: 'all', label: t('All', 'Tất cả') },
    { key: 'golf', label: typeLabel('golf', lang) }, { key: 'tennis', label: typeLabel('tennis', lang) },
    { key: 'padel', label: typeLabel('padel', lang) }, { key: 'hash', label: typeLabel('hash', lang) },
    { key: 'happenings', label: t('Happenings', 'Hoạt động') },
  ]

  // "Photos →" is one translated string; the arrow is set apart so it can slide.
  const photosWord = t('Photos →', 'Ảnh →').replace(/\s*→\s*$/, '')

  const renderFixture = (f: Fixture) => {
    const signed = isSignedUp(f.id)
    const closed = deadlinePassed(f)
    const count = counts[f.id] || 0
    const cap = f.max_signups
    const full = cap != null && count >= cap
    const rel = relativeDate(new Date(f.date).getTime(), t)
    const fill = cap != null && cap > 0 ? Math.min(100, Math.round((count / cap) * 100)) : 0
    return (
      <article key={`f-${f.id}`} className={'wo-row' + (signed ? ' is-in' : '')}>
        <DateBlock ms={new Date(f.date).getTime()} lang={lang} />
        <div className="wo-main">
          <div className="wo-tags">
            <span className="wo-type"><i style={{ background: dotOf(f.type) }} />{typeLabel(f.type, lang)}</span>
            {rel && <span className="wo-rel">{rel}</span>}
            {signed && <span className="wo-in">✓ {t("You're in", 'Đã đăng ký')}</span>}
          </div>
          <h3 className="wo-title">{f.title}</h3>
          <div className="wo-meta">{fmtFixtureDate(f.date, lang)}{f.location ? ' · ' + f.location : ''}</div>
          {f.description && <p className="wo-desc">{f.description}</p>}
          <div className="wo-action">
            <div className="wo-count">
              <span className="wo-count-n">{count}{cap != null ? `/${cap}` : ''}</span> {t('in', 'tham gia')}
              {cap != null && <span className="wo-bar" aria-hidden="true"><span style={{ width: `${fill}%` }} /></span>}
            </div>
            {closed ? <span className="wo-closed">{t('Closed', 'Đã đóng')}</span>
              : full && !signed ? <span className="wo-closed">{t('Full', 'Hết chỗ')}</span>
              : <button onClick={() => toggleSignup(f.id)} disabled={busyId === f.id} className={signed ? 'wo-btn wo-btn-on' : 'wo-btn'}>
                  {busyId === f.id ? '…' : signed ? t('Withdraw', 'Rút tên') : <>{t('Sign me up', 'Đăng ký')} <span className="pk-go">→</span></>}
                </button>}
          </div>
        </div>
        <Thumb a={attachments[`fixture:${f.id}`]} />
      </article>
    )
  }

  const renderEntry = (e: Entry, ms: number) => {
    const meta = KIND_META[e.kind] || KIND_META.other
    return (
      <article key={`e-${e.id}`} className="wo-row">
        <DateBlock ms={ms} lang={lang} />
        <div className="wo-main">
          <div className="wo-tags">
            <span className="wo-type"><i style={{ background: meta.dot }} />{t(meta.label, meta.vn)}</span>
          </div>
          <h3 className="wo-title">{pick(lang, e.title, e.title_vn)}</h3>
          <div className="wo-meta">{fmtEntryDate(e.entry_date, lang)} · {fmtEntryTime(e, t)}{e.space ? ' · ' + e.space : ''}</div>
          {e.description && <p className="wo-desc">{e.description}</p>}
        </div>
        <Thumb a={attachments[`calendar_entry:${e.id}`]} />
      </article>
    )
  }

  // The masthead's drawing: the flag on the green, a dram on its tee beside it.
  const art = (
    <div className="wo-art">
      <CreamInk name="golf-flag" width="100%" rot={6} dur={9} className="wo-art-flag" />
      <CreamInk name="tee-glass" width="100%" rot={-8} dur={7} className="wo-art-tee" />
    </div>
  )

  return (
    <MemberPage title={surfaceName('/members/events', 'en')} subtitle={surfaceName('/members/events', 'vn')} art={art}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        /* the drawing: the flag fills the shell's frame, the tee stands in front */
        .wo-art { position: relative; width: 100%; height: clamp(170px, 20vw, 270px); }
        .mp-art .wo-art .wo-art-flag { position: absolute; inset: 0; height: 100%; }
        .mp-art .wo-art .wo-art-tee { position: absolute; left: -46%; bottom: 0; width: 62%; height: 62%; }

        .wo-stats { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0; }
        .wo-stat { display: block; padding: 2px 34px 0 0; margin-right: 34px; border-right: 1px solid rgba(229,212,194,.16);
                   color: ${CREAM}; text-decoration: none; }
        .wo-stat:last-child { border-right: none; margin-right: 0; padding-right: 0; }
        .wo-stat-n { display: block; font-family: ${SERIF}; font-size: clamp(44px, 5vw, 64px); line-height: .95; color: ${GOLD}; }
        .wo-stat-l { display: block; margin-top: 10px; font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; opacity: .8; }
        .wo-photos .wo-stat-n { color: ${CREAM}; font-size: clamp(30px, 3.2vw, 42px); }
        .wo-photos:hover .wo-stat-n { color: ${GOLD}; }

        /* ── the tabs: words, underlined when chosen ── */
        .wo-tabs { display: flex; gap: 28px; margin-top: 64px; overflow-x: auto; scrollbar-width: none;
                   border-bottom: 1px solid rgba(229,212,194,.16); }
        .wo-tabs::-webkit-scrollbar { display: none; }
        .wo-tab { position: relative; flex-shrink: 0; background: none; border: none; cursor: pointer; color: ${CREAM};
                  padding: 0 0 14px; font-family: ${MONO}; font-size: 12px; letter-spacing: .16em; text-transform: uppercase;
                  opacity: .55; transition: opacity .3s ease; }
        .wo-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: ${GOLD};
                         transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,.84,.44,1); }
        .wo-tab:hover { opacity: .85; }
        .wo-tab.on { opacity: 1; }
        .wo-tab.on::after { transform: scaleX(1); }

        .wo-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(34px, 4.6vw, 58px); line-height: 1; margin: 0; }
        .wo-sec { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin: 64px 0 8px; }

        /* ── a line of the fixtures card ── */
        .wo-row { display: grid; grid-template-columns: 124px minmax(0, 1fr) auto; gap: 36px; align-items: start;
                  padding: 34px 0; border-bottom: 1px solid rgba(229,212,194,.14); position: relative; }
        .wo-row.is-in::before { content: ''; position: absolute; left: -18px; top: 34px; bottom: 34px; width: 2px; background: ${GOLD}; }
        .wo-date { color: ${CREAM}; }
        .wo-day { font-family: ${SERIF}; font-size: clamp(64px, 6.4vw, 88px); line-height: .86; }
        .wo-mon { font-family: ${MONO}; font-size: 13px; letter-spacing: .18em; text-transform: uppercase; margin-top: 10px; color: ${GOLD}; }
        .wo-wd  { font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-top: 4px; opacity: .7; }

        .wo-tags { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        .wo-type { display: inline-flex; align-items: center; gap: 8px; font-family: ${MONO}; font-size: 11.5px; letter-spacing: .18em; text-transform: uppercase; }
        .wo-type i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
        .wo-rel { font-family: ${MONO}; font-size: 12px; color: ${GOLD}; }
        .wo-in { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: ${INK};
                 background: ${GOLD}; padding: 3px 9px 2px; border-radius: 3px; }
        .wo-title { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.2vw, 42px); line-height: 1.02; margin: 14px 0 0; color: ${CREAM}; }
        .wo-meta { font-family: ${MONO}; font-size: 13px; line-height: 1.7; margin-top: 10px; opacity: .85; }
        .wo-desc { font-family: ${MONO}; font-size: 13px; line-height: 1.95; margin: 16px 0 0; max-width: 640px; opacity: .86; white-space: pre-line; }

        .wo-action { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; margin-top: 22px; }
        .wo-count { display: inline-flex; align-items: center; gap: 8px; font-family: ${MONO}; font-size: 12px; opacity: .9; }
        .wo-count-n { font-family: ${SERIF}; font-size: 24px; line-height: 1; }
        .wo-bar { position: relative; display: inline-block; width: 84px; height: 2px; margin-left: 6px; background: rgba(229,212,194,.18); }
        .wo-bar > span { position: absolute; left: 0; top: 0; bottom: 0; background: ${GOLD}; }
        .wo-btn { background: none; border: none; border-bottom: 1px solid ${GOLD}; border-radius: 0; padding: 0 0 6px; cursor: pointer;
                  color: ${GOLD}; font-family: ${MONO}; font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; }
        .wo-btn:hover .pk-go { transform: translateX(7px); }
        .wo-btn:disabled { opacity: .5; cursor: default; }
        .wo-btn-on { color: ${CREAM}; border-bottom-color: rgba(229,212,194,.5); opacity: .8; }
        .wo-btn-on:hover { opacity: 1; }
        .wo-closed { font-family: ${MONO}; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; opacity: .65; }

        /* the invitation, whole — never cropped */
        .wo-thumb-link { display: block; line-height: 0; border-radius: 10px; overflow: hidden;
                         box-shadow: 0 16px 34px rgba(0,0,0,.34); }
        .wo-thumb { display: block; width: auto; height: auto; max-width: 200px; max-height: 270px;
                    transition: transform .7s cubic-bezier(.16,.84,.44,1); }
        .wo-thumb-link:hover .wo-thumb { transform: scale(1.04); }
        .wo-pdf { display: inline-flex; align-items: center; gap: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                  font-family: ${MONO}; font-size: 12px; color: ${CREAM}; text-decoration: none; padding: 0 0 6px;
                  border-bottom: 1px solid rgba(229,212,194,.4); }
        .wo-pdf:hover { color: ${GOLD}; border-bottom-color: ${GOLD}; }

        .wo-row.is-past .wo-day { font-size: clamp(48px, 4.6vw, 64px); opacity: .7; }
        .wo-row.is-past .wo-title { font-size: clamp(24px, 2.6vw, 34px); opacity: .9; }
        .wo-results { font-family: ${MONO}; font-size: 13px; line-height: 1.9; margin-top: 16px; white-space: pre-line;
                      padding-left: 16px; border-left: 2px solid rgba(212,184,90,.6); }

        .wo-empty { font-family: ${MONO}; font-size: 13px; line-height: 1.9; opacity: .8; padding: 34px 0; }
        .wo-error { font-family: ${MONO}; font-size: 12.5px; line-height: 1.8; color: #E89B9B; margin-top: 22px; }

        @media (max-width: 860px) {
          .wo-art { height: 88px; }
          .mp-art .wo-art .wo-art-tee { display: none; }
          .wo-stat { padding-right: 22px; margin-right: 22px; }
          .wo-tabs { margin-top: 48px; gap: 22px; margin-right: -20px; padding-right: 20px; }
        }
        @media (max-width: 600px) {
          /* the date goes across the top of the line, so the words get the width */
          .wo-row { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 30px 0; }
          .wo-row.is-in::before { left: -12px; top: 30px; bottom: 30px; }
          .wo-date { display: flex; align-items: baseline; gap: 12px; }
          .wo-day { font-size: 54px; }
          .wo-row.is-past .wo-day { font-size: 44px; }
          .wo-mon, .wo-wd { margin-top: 0; font-size: 12.5px; }
          .wo-title { font-size: 28px; margin-top: 12px; }
          .wo-thumb-link, .wo-pdf { justify-self: start; }
          .wo-thumb { max-width: 100%; max-height: 380px; }
          .wo-action { gap: 20px; }
          .wo-stats { display: grid; grid-template-columns: auto auto; justify-content: start; align-items: end; row-gap: 26px; }
          .wo-stat:nth-child(2) { border-right: none; margin-right: 0; padding-right: 0; }
          .wo-sec { margin-top: 52px; }
          .wo-stat-n { font-size: 46px; }
          .wo-stat-l { font-size: 11.5px; }
          .wo-photos { grid-column: 1 / -1; }
          .wo-photos .wo-stat-n { font-size: 30px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wo-tab, .wo-tab::after, .wo-thumb { transition: none; }
        }
      ` }} />
      <div className="wo-stats">
        <div className="wo-stat"><span className="wo-stat-n">{upcoming.length}</span><span className="wo-stat-l">{t('coming up', 'sắp diễn ra')}</span></div>
        <div className="wo-stat"><span className="wo-stat-n">{myUpcoming}</span><span className="wo-stat-l">{t("you're signed up for", 'bạn đã đăng ký')}</span></div>
        <Link href="/members/gallery" className="wo-stat wo-photos pk-hover">
          <span className="wo-stat-n">{photosWord} <span className="pk-go">→</span></span>
          <span className="wo-stat-l">{t('from past events', 'từ các sự kiện đã qua')}</span>
        </Link>
      </div>

        <div className="wo-tabs" role="tablist">
          {tabs.map(tb => (
            <button key={tb.key} role="tab" aria-selected={filter === tb.key} className={'wo-tab' + (filter === tb.key ? ' on' : '')} onClick={() => setFilter(tb.key)}>{tb.label}</button>
          ))}
        </div>

        {errorMsg && <div className="wo-error" role="alert">{errorMsg}</div>}

        {loading ? (
          <div className="wo-empty">{t('Loading…', 'Đang tải…')}</div>
        ) : (
          <>
            <div className="wo-sec"><h2 className="wo-h2">{t('Coming up', 'Sắp diễn ra')}</h2></div>
            {shownUpcoming.length === 0 ? (
              <div className="wo-empty">{t('Nothing on the calendar here yet.', 'Chưa có gì trên lịch ở mục này.')}</div>
            ) : shownUpcoming.map(it => it.type === 'fixture' ? renderFixture(it.f) : renderEntry(it.e, it.ms))}

            {filter !== 'happenings' && pastFixtures.length > 0 && (
              <>
                <div className="wo-sec" style={{ marginTop: 110 }}>
                  <h2 className="wo-h2">{t('Past results', 'Kết quả đã qua')}</h2>
                  <CreamInk name="newspaper" width="clamp(84px, 10vw, 130px)" rot={-7} dur={10} />
                </div>
                {shownPast.map(f => (
                  <article key={`p-${f.id}`} className="wo-row is-past">
                    <DateBlock ms={new Date(f.date).getTime()} lang={lang} />
                    <div className="wo-main">
                      <div className="wo-tags"><span className="wo-type"><i style={{ background: dotOf(f.type) }} />{typeLabel(f.type, lang)}</span></div>
                      <h3 className="wo-title">{f.title}</h3>
                      <div className="wo-meta">{fmtFixtureDate(f.date, lang)}{f.location ? ' · ' + f.location : ''}</div>
                      {f.results && <div className="wo-results">{f.results}</div>}
                    </div>
                  </article>
                ))}
              </>
            )}
          </>
        )}
    </MemberPage>
  )
}
