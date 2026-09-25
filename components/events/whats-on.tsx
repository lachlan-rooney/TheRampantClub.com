import type { Lang } from '@/lib/lang'

// WHAT'S ON — the club's one way of setting out an event, in one file.
//
// Owner, 2026-09-25, of the kiosk's week list: "It better look like the whats
// on in the portal when i look at it." It didn't: the portal ran a fixtures
// card — the date large down the left, the type in mono, a display-face title,
// the count and the sign-up at the foot of the line, hairlines between — and
// the tablet ran a little 56px thumbnail beside 17px of text.
//
// Copying the CSS across would have made them look alike for a fortnight. So
// the row LIVES HERE and both surfaces render it: /members/events and the
// member view of the room tablet. Change the line once and it changes in the
// member's hand and on the bar top together, which is the only way they stay
// the same thing.
//
// WHAT IS NOT HERE: the fetching, the sign-up call, and the language. The
// portal reads client-side under the member's own Supabase session and switches
// on the chosen language; the kiosk reads server-side through a 60-second JWT
// and prints both languages at once, because nobody sets a preference on a
// tablet they share. Those differ for good reasons and always will.

const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const INK = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

// The dot beside each type. Every colour here is one that reads on the bottle
// green. The LABELS come from lib/fixtures.ts, so a type added there is never
// nameless; only its colour is decided here.
export const TYPE_DOT: Record<string, string> = {
  golf: '#A9BB84', tennis: '#7FB3A0', padel: '#B2AA98', hash: '#E5D4C2',
  dinner: '#C79A6B', tasting: '#D4B85A', social: '#9E8FC4', other: '#D4B85A',
}
export const dotOf = (t: string) => TYPE_DOT[t] || TYPE_DOT.other

// House happenings — calendar entries, which have kinds rather than types.
export const KIND_META: Record<string, { label: string; vn: string; dot: string }> = {
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
export const kindMeta = (k: string) => KIND_META[k] || KIND_META.other

export const relativeDate = (ms: number, t: (en: string, vn: string) => string) => {
  const days = Math.round((ms - Date.now()) / 86400000)
  if (days === 0) return t('today', 'hôm nay')
  if (days === 1) return t('tomorrow', 'ngày mai')
  if (days > 0 && days < 7) return t(`in ${days} days`, `${days} ngày nữa`)
  return ''
}

// ── The date, set large down the left of each line ───────────────────────
// Sài Gòn's calendar day, in the reader's language (vi-VN in Vietnamese) — a
// member reading from Scotland or a reciprocal club must see the day the event
// actually falls on here.
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
export function DateBlock({ ms, lang }: { ms: number; lang: Lang }) {
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

/** A line of the fixtures card. Returned as a string so each surface can drop it
 *  into its own <style>: the portal is a member page, the kiosk is a bare
 *  full-screen route, and neither imports the other's shell. */
export const whatsOnCss = () => `
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
`

/** The same line where the width runs out: the date lies across the top so the
 *  words get what is left. The portal reaches this on a phone; the kiosk reaches
 *  it ALWAYS, because its week column is a third of a landscape tablet — which
 *  is narrower than the phone this was drawn for. Hence the prefix: the kiosk
 *  scopes these under its own column rather than to a viewport it never meets. */
export const whatsOnNarrowCss = (p = '') => `
        ${p}.wo-row { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 30px 0; }
        ${p}.wo-row.is-in::before { left: -12px; top: 30px; bottom: 30px; }
        ${p}.wo-date { display: flex; align-items: baseline; gap: 12px; }
        ${p}.wo-day { font-size: 54px; }
        ${p}.wo-row.is-past .wo-day { font-size: 44px; }
        ${p}.wo-mon, ${p}.wo-wd { margin-top: 0; font-size: 12.5px; }
        ${p}.wo-title { font-size: 28px; margin-top: 12px; }
        ${p}.wo-thumb-link, ${p}.wo-pdf { justify-self: start; }
        ${p}.wo-thumb { max-width: 100%; max-height: 380px; }
        ${p}.wo-action { gap: 20px; }
`
