'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { vnDateString, vnEventLabel } from '@/lib/datetime'
import type { Fixture, FixtureSignup } from '@/lib/types'
import { typeLabel, isSport } from '@/lib/fixtures'
import { useLang, pick, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'

// "What's On" — ONE surface for everything happening at the club. Sports
// fixtures (from `fixtures`, with RSVP) and house happenings (from
// calendar_entries — closures, tastings, distiller visits; informational, no
// RSVP) are merged into a single chronological timeline, tagged by type. Past
// fixtures with results show below. This replaces the old separate Events +
// Sports Fixtures pages.

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

// Tints stay local (they are this page's visual language); the LABELS come from
// lib/fixtures.ts so a type added there is never nameless here.
const TYPE_META: Record<string, { tint: string; ring: string }> = {
  golf:    { tint: 'rgba(94,102,80,0.30)',   ring: 'rgba(94,102,80,0.6)' },
  tennis:  { tint: 'rgba(40,72,60,0.34)',    ring: 'rgba(40,72,60,0.7)' },
  padel:   { tint: 'rgba(178,170,152,0.26)', ring: 'rgba(178,170,152,0.55)' },
  hash:    { tint: 'rgba(229,212,194,0.16)', ring: 'rgba(229,212,194,0.45)' },
  dinner:  { tint: 'rgba(110,74,46,0.28)',   ring: 'rgba(199,154,107,0.55)' },
  tasting: { tint: 'rgba(122,92,46,0.26)',   ring: 'rgba(212,184,90,0.55)' },
  social:  { tint: 'rgba(74,58,94,0.28)',    ring: 'rgba(158,143,196,0.55)' },
  other:   { tint: 'rgba(212,184,90,0.18)',  ring: 'rgba(212,184,90,0.45)' },
}
const metaOf = (t: string) => TYPE_META[t] || TYPE_META.other

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
  // tap. contain, not cover — cropping a poster is the wrong operation.
  return (
    <a href={`/api/entries/attachment/${a.id}`} target="_blank" rel="noreferrer"
       className="wo-thumb-link" aria-label={t('Open the full image', 'Mở ảnh đầy đủ')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wo-thumb" src={`/api/entries/attachment/${a.id}`} alt="" loading="lazy" />
    </a>
  )
}
const KIND_META: Record<string, { label: string; vn: string; tint: string; ring: string }> = {
  event:        { label: 'Event',          vn: 'Sự kiện',          tint: 'rgba(212,184,90,0.20)',  ring: 'rgba(212,184,90,0.55)' },
  meeting:      { label: 'Meeting',        vn: 'Cuộc họp',         tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
  interview:    { label: 'Interview',      vn: 'Phỏng vấn',        tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
  reminder:     { label: 'Reminder',       vn: 'Nhắc nhở',         tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
  closure:      { label: 'Club closed',    vn: 'CLB đóng cửa',     tint: 'rgba(194,112,112,0.18)', ring: 'rgba(194,112,112,0.5)' },
  private_hire: { label: 'Private event',  vn: 'Sự kiện riêng',    tint: 'rgba(212,184,90,0.16)',  ring: 'rgba(212,184,90,0.45)' },
  supplier:     { label: 'Distiller visit',vn: 'Nhà chưng cất ghé thăm', tint: 'rgba(122,176,122,0.16)', ring: 'rgba(122,176,122,0.5)' },
  tasting:      { label: 'Tasting',        vn: 'Nếm thử',          tint: 'rgba(212,184,90,0.20)',  ring: 'rgba(212,184,90,0.55)' },
  other:        { label: 'Notice',         vn: 'Thông báo',        tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
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

  const tabs: { key: string; label: string }[] = [
    { key: 'all', label: t('All', 'Tất cả') },
    { key: 'golf', label: typeLabel('golf', lang) }, { key: 'tennis', label: typeLabel('tennis', lang) },
    { key: 'padel', label: typeLabel('padel', lang) }, { key: 'hash', label: typeLabel('hash', lang) },
    { key: 'happenings', label: t('Happenings', 'Hoạt động') },
  ]

  const renderFixture = (f: Fixture) => {
    const meta = metaOf(f.type)
    const signed = isSignedUp(f.id)
    const closed = deadlinePassed(f)
    const count = counts[f.id] || 0
    const cap = f.max_signups
    const full = cap != null && count >= cap
    const rel = relativeDate(new Date(f.date).getTime(), t)
    return (
      <div key={`f-${f.id}`} className="wo-card" style={{ borderLeftColor: meta.ring }}>
        <div className="wo-row">
          <Thumb a={attachments[`fixture:${f.id}`]} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wo-tags">
              <span className="wo-tag" style={{ background: meta.tint }}>{typeLabel(f.type, lang)}</span>
              {rel && <span className="wo-rel">{rel}</span>}
              {signed && <span className="wo-in">{t("You're in", 'Đã đăng ký')}</span>}
            </div>
            <div className="wo-title">{f.title}</div>
            <div className="wo-meta">{fmtFixtureDate(f.date, lang)}{f.location ? ' · ' + f.location : ''}</div>
            {f.description && <p className="wo-desc">{f.description}</p>}
          </div>
          <div className="wo-action">
            <div className="wo-count">{count}{cap != null ? `/${cap}` : ''} {t('in', 'tham gia')}</div>
            {closed ? <span className="wo-closed">{t('Closed', 'Đã đóng')}</span>
              : full && !signed ? <span className="wo-closed">{t('Full', 'Hết chỗ')}</span>
              : <button onClick={() => toggleSignup(f.id)} disabled={busyId === f.id} className={signed ? 'wo-btn wo-btn-on' : 'wo-btn'}>
                  {busyId === f.id ? '…' : signed ? t('Withdraw', 'Rút tên') : t('Sign me up', 'Đăng ký')}
                </button>}
          </div>
        </div>
      </div>
    )
  }

  const renderEntry = (e: Entry) => {
    const meta = KIND_META[e.kind] || KIND_META.other
    return (
      <div key={`e-${e.id}`} className="wo-card" style={{ borderLeftColor: meta.ring }}>
        <div className="wo-row">
          <Thumb a={attachments[`calendar_entry:${e.id}`]} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wo-tags">
              <span className="wo-tag" style={{ background: meta.tint }}>{t(meta.label, meta.vn)}</span>
            </div>
            <div className="wo-title">{pick(lang, e.title, e.title_vn)}</div>
            <div className="wo-meta">{fmtEntryDate(e.entry_date, lang)} · {fmtEntryTime(e, t)}{e.space ? ' · ' + e.space : ''}</div>
            {e.description && <p className="wo-desc">{e.description}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .wo-page { min-height: 100vh; background: #052E20; padding: 96px 24px 100px; }
        .wo-inner { max-width: 760px; margin: 0 auto; }
        .wo-back { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; opacity: 0.8; text-decoration: none; letter-spacing: 0.06em; }
        .wo-back:hover { color: #D4B85A; }
        .wo-h1 { font-family: 'Rampant Sans', serif; font-size: 32px; color: #E5D4C2; margin: 22px 0 2px; }
        .wo-sub { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; opacity: 0.6; letter-spacing: 0.08em; margin-bottom: 22px; }
        .wo-stats { display: flex; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .wo-stat { flex: 1; min-width: 130px; padding: 14px 16px; background: rgba(229,212,194,0.04); border: 1px solid rgba(229,212,194,0.08); border-radius: 12px; }
        .wo-stat-n { font-family: 'Rampant Sans', serif; font-size: 26px; color: #D4B85A; }
        .wo-stat-l { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; letter-spacing: 0.06em; margin-top: 2px; }
        .wo-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
        .wo-tabbtn { font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; cursor: pointer; border: 1px solid rgba(229,212,194,0.14); background: transparent; color: #B2AA98; }
        .wo-tabbtn.on { background: rgba(212,184,90,0.14); border-color: rgba(212,184,90,0.55); color: #E7C766; }
        .wo-sec { font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #D4B85A; opacity: 0.7; margin: 28px 0 12px; }
        .wo-card { border: 1px solid rgba(229,212,194,0.10); border-left-width: 3px; border-radius: 12px; padding: 16px 18px; margin-bottom: 10px; background: rgba(229,212,194,0.03); }
        .wo-row { display: flex; gap: 16px; align-items: flex-start; }
        .wo-tags { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
        .wo-tag { font-family: 'Google Sans Code', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #E5D4C2; padding: 3px 9px; border-radius: 999px; }
        .wo-rel { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #D4B85A; }
        .wo-in { font-family: 'Google Sans Code', monospace; font-size: 9px; letter-spacing: 0.06em; color: #052E20; background: #7AB07A; padding: 2px 8px; border-radius: 999px; }
        .wo-title { font-family: 'Rampant Sans', serif; font-size: 18px; color: #E5D4C2; line-height: 1.2; }
        .wo-meta { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; margin-top: 4px; }
        .wo-thumb-link { flex-shrink: 0; display: block; line-height: 0; }
        .wo-thumb { width: 150px; height: auto; max-height: 210px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(229,212,194,0.12); background: rgba(229,212,194,0.04); }
        .wo-pdf { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; text-decoration: none; border: 1px solid rgba(229,212,194,0.16); border-radius: 8px; padding: 8px 10px; }
        .wo-pdf:hover { color: #D4B85A; border-color: rgba(212,184,90,0.4); }
        .wo-desc { font-family: 'Google Sans Code', monospace; font-size: 11.5px; color: #B2AA98; opacity: 0.85; line-height: 1.6; margin: 10px 0 0; white-space: pre-line; }
        .wo-action { flex-shrink: 0; text-align: right; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .wo-count { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; }
        .wo-btn { font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: 0.04em; padding: 8px 14px; border-radius: 8px; cursor: pointer; background: #D4B85A; color: #052E20; border: none; font-weight: 700; }
        .wo-btn-on { background: transparent; color: #B2AA98; border: 1px solid rgba(229,212,194,0.25); font-weight: 400; }
        .wo-closed { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; opacity: 0.6; }
        .wo-empty { font-family: 'Google Sans Code', monospace; font-size: 12px; color: #B2AA98; opacity: 0.6; font-style: italic; padding: 30px 0; text-align: center; }
        .wo-results { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(229,212,194,0.08); }
        @media (max-width: 560px) {
          .wo-row { flex-direction: column; }
          .wo-action { text-align: left; align-items: flex-start; flex-direction: row; gap: 14px; }
          .wo-thumb-link { width: 100%; }
          .wo-thumb { width: 100%; max-height: 380px; }
        }
      ` }} />
      <div className="wo-page">
        <div className="wo-inner">
          <Link href="/members" className="wo-back">{t('← Back to dashboard', '← Về Trang Chính')}</Link>
          <h1 className="wo-h1">{surfaceName('/members/events', lang)}</h1>
          <div className="wo-sub">{surfaceName('/members/events', lang === 'vn' ? 'en' : 'vn')}</div>

          <div className="wo-stats">
            <div className="wo-stat"><div className="wo-stat-n">{upcoming.length}</div><div className="wo-stat-l">{t('coming up', 'sắp diễn ra')}</div></div>
            <div className="wo-stat"><div className="wo-stat-n">{myUpcoming}</div><div className="wo-stat-l">{t("you're signed up for", 'bạn đã đăng ký')}</div></div>
            <Link href="/members/gallery" className="wo-stat" style={{ textDecoration: 'none' }}><div className="wo-stat-n" style={{ fontSize: 18, paddingTop: 6 }}>{t('Photos →', 'Ảnh →')}</div><div className="wo-stat-l">{t('from past events', 'từ các sự kiện đã qua')}</div></Link>
          </div>

          <div className="wo-tabs">
            {tabs.map(tb => (
              <button key={tb.key} className={'wo-tabbtn' + (filter === tb.key ? ' on' : '')} onClick={() => setFilter(tb.key)}>{tb.label}</button>
            ))}
          </div>

          {errorMsg && <div className="wo-empty" style={{ color: '#C27070' }}>{errorMsg}</div>}

          {loading ? (
            <div className="wo-empty">{t('Loading…', 'Đang tải…')}</div>
          ) : (
            <>
              <div className="wo-sec">{t('Coming up', 'Sắp diễn ra')}</div>
              {shownUpcoming.length === 0 ? (
                <div className="wo-empty">{t('Nothing on the calendar here yet.', 'Chưa có gì trên lịch ở mục này.')}</div>
              ) : shownUpcoming.map(it => it.type === 'fixture' ? renderFixture(it.f) : renderEntry(it.e))}

              {filter !== 'happenings' && pastFixtures.length > 0 && (
                <>
                  <div className="wo-sec">{t('Past results', 'Kết quả đã qua')}</div>
                  {pastFixtures.filter(f => filter === 'all' || f.type === filter).map(f => {
                    const meta = metaOf(f.type)
                    return (
                      <div key={`p-${f.id}`} className="wo-card" style={{ borderLeftColor: meta.ring, opacity: 0.8 }}>
                        <div className="wo-tags"><span className="wo-tag" style={{ background: meta.tint }}>{typeLabel(f.type, lang)}</span></div>
                        <div className="wo-title">{f.title}</div>
                        <div className="wo-meta">{fmtFixtureDate(f.date, lang)}{f.location ? ' · ' + f.location : ''}</div>
                        {f.results && <div className="wo-results">{f.results}</div>}
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
