import type { NewsletterAutoData } from './gather'

// Self-contained newsletter renderer — email (Gmail-safe HTML) + hosted page
// share ONE body builder. Mirrors the weekly-report render primitives (theme,
// escaping, [label](url) prose links, gold stat cards) without importing the
// report module (kept independent so a report change can't break the newsletter).

const GREEN = '#052E20', CARD = '#0A3526', CREAM = '#E5D4C2', GOLD = '#D4B85A', MUTED = '#B2AA98'
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "'Google Sans Code', ui-monospace, monospace"

export const site = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// [label](https://…) → link; everything else escaped. Only http(s) passes (XSS guard).
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
function renderProse(body: string): string {
  const parts: string[] = []
  let last = 0, m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(body))) {
    parts.push(esc(body.slice(last, m.index)))
    parts.push(`<a href="${esc(m[2])}" style="color:${GOLD};text-decoration:underline">${esc(m[1])}</a>`)
    last = m.index + m[0].length
  }
  parts.push(esc(body.slice(last)))
  return parts.join('').replace(/\n/g, '<br>')
}

export interface NewsletterRow {
  subject: string
  sections: Record<string, string>
  auto_data: NewsletterAutoData | Record<string, never>
  hero_image?: string | null
  share_token?: string
}

// Editable editorial blocks (the whitelist; must match the admin editor + PATCH).
export const NEWSLETTER_SECTIONS: { key: string; label: string; labelVi: string; hint: string }[] = [
  { key: 'intro',    label: 'Opening note',     labelVi: 'Lời mở đầu',   hint: 'A warm welcome / what this issue covers.' },
  { key: 'feature',  label: 'Feature',          labelVi: 'Bài chính',    hint: 'The main story — a recap, an announcement.' },
  { key: 'spotlight',label: 'Spotlight',        labelVi: 'Điểm nhấn',    hint: 'A member spotlight, a dram of the month, a moment.' },
  { key: 'closing',  label: 'Closing',          labelVi: 'Lời kết',      hint: 'A sign-off. Links welcome: [label](https://…).' },
]

const fmtDate = (d: string) => new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })

function section(title: string, inner: string): string {
  return `<div style="margin:28px 0 0">
    <div style="font-family:${MONO};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};margin-bottom:6px">${esc(title)}</div>
    <div style="border-top:1px solid rgba(212,184,90,0.3);padding-top:14px">${inner}</div>
  </div>`
}
function prose(body: string): string {
  return `<div style="font-family:${SERIF};font-size:15px;line-height:1.7;color:${CREAM}">${renderProse(body)}</div>`
}
function statCell(value: string | number, label: string): string {
  return `<td width="20%" style="text-align:center;padding:6px">
    <div style="font-family:${SERIF};font-size:26px;color:${GOLD}">${esc(String(value))}</div>
    <div style="font-family:${MONO};font-size:9px;letter-spacing:0.06em;color:${MUTED};margin-top:2px">${esc(label)}</div>
  </td>`
}

// The ONE body builder — used by both the email and the hosted page.
export function renderNewsletterBody(row: NewsletterRow): string {
  const s = row.sections || {}
  const a = (row.auto_data && 'stats' in row.auto_data) ? row.auto_data as NewsletterAutoData : null
  const hero = row.hero_image ? `${site()}/images/${row.hero_image}` : `${site()}/images/social/whisky-lounge.webp`
  const out: string[] = []

  out.push(`<img src="${esc(hero)}" width="100%" alt="" style="display:block;border-radius:8px;max-height:220px;object-fit:cover">`)
  out.push(`<div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};margin:22px 0 4px">The Rampant Club · Newsletter${a ? ` · ${esc(a.period.label)}` : ''}</div>`)
  out.push(`<h1 style="font-family:${SERIF};font-size:28px;color:${CREAM};margin:0 0 6px;line-height:1.15">${esc(row.subject)}</h1>`)

  if (s.intro?.trim()) out.push(`<div style="margin-top:14px">${prose(s.intro)}</div>`)

  if (a) {
    out.push(section('This month at the club', `<table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${statCell(a.stats.visits, 'visits')}
      ${statCell(a.stats.unique_members, 'members in')}
      ${statCell(a.stats.footfall_unique, 'footfall')}
      ${statCell(a.stats.events_count, 'events')}
      ${statCell(a.stats.new_member_count, 'joined')}
    </tr></table>`))
  }

  if (a && a.new_members.length) {
    const names = a.new_members.map(m => `<span style="display:inline-block;font-family:${SERIF};font-size:14px;color:${CREAM};background:rgba(212,184,90,0.1);border:1px solid rgba(212,184,90,0.3);border-radius:999px;padding:4px 12px;margin:3px 4px 0 0">${esc(m.name)}${m.tier ? ` <span style="color:${MUTED};font-size:11px">· ${esc(m.tier)}</span>` : ''}</span>`).join('')
    out.push(section('Say hello to', `<div style="font-family:${MONO};font-size:12px;color:${MUTED};margin-bottom:8px">New faces around the club this month — do say hello.</div>${names}`))
  }

  if (s.feature?.trim()) out.push(section('Feature', prose(s.feature)))
  if (s.spotlight?.trim()) out.push(section('Spotlight', prose(s.spotlight)))

  if (a && a.upcoming.length) {
    const rows = a.upcoming.map(u => `<tr>
      <td style="font-family:${MONO};font-size:11px;color:${GOLD};padding:5px 12px 5px 0;white-space:nowrap;vertical-align:top">${esc(fmtDate(u.date))}</td>
      <td style="font-family:${SERIF};font-size:14px;color:${CREAM};padding:5px 0">${esc(u.title)}</td>
    </tr>`).join('')
    out.push(section("What's coming up", `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`))
  }

  if (s.closing?.trim()) out.push(section('—', prose(s.closing)))

  return out.join('\n')
}

// Full email shell (680px green frame + logo + gold CTA to the hosted page).
export function renderNewsletterEmail(row: NewsletterRow): string {
  const body = renderNewsletterBody(row)
  const cta = row.share_token
    ? `<div style="text-align:center;margin:30px 0 8px"><a href="${site()}/newsletter/${row.share_token}" style="display:inline-block;background:${GOLD};color:${GREEN};font-family:${MONO};font-size:12px;letter-spacing:0.06em;font-weight:700;text-decoration:none;padding:12px 26px;border-radius:8px">Read it on the web →</a></div>`
    : ''
  return `<div style="background:${GREEN};padding:28px 0;font-family:${SERIF}">
    <div style="max-width:680px;margin:0 auto;background:${CARD};border:1px solid rgba(229,212,194,0.12);border-radius:12px;padding:28px 30px">
      <div style="text-align:center;margin-bottom:8px"><img src="${site()}/images/logo-mark-cream.svg" width="46" alt="The Rampant Club"></div>
      ${body}
      ${cta}
      <div style="margin-top:30px;border-top:1px solid rgba(229,212,194,0.12);padding-top:14px;text-align:center;font-family:${MONO};font-size:10px;color:${MUTED};line-height:1.6">
        The Rampant Club · 74A/2 Hai Bà Trưng, Phường Sài Gòn<br>You're receiving this as a member of The Rampant Club.
      </div>
    </div>
  </div>`
}
