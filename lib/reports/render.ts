import type { AutoData } from './gather'
import type { Financials } from './financials'
import { lineChart, donut, funnel, hbars, stackedBars, PALETTE } from './charts'

// Shared report renderer. Two surfaces from one section builder:
//  • hosted page  → inline SVG charts (crisp, from charts.ts)
//  • email        → HTML/CSS bar charts (tables + coloured divs) — 100% email-
//    safe (Gmail strips inline SVG, and native SVG→PNG isn't reliable on the
//    host). No image dependency, no sharp.
// Dark club theme (green ground, cream text, gold accents).

export interface ReportRow {
  id: string
  period_start: string
  period_end: string
  headline: string | null
  auto_data: AutoData
  narrative: Record<string, string>
  include_financials: boolean
  financials: Financials | Record<string, never>
  chart_urls: Record<string, string>
  share_token: string
  status: string
}

type Mode = 'svg' | 'email'
const GREEN = '#052E20', CARD = '#0A3526', CREAM = '#E5D4C2', GOLD = '#D4B85A', MUTED = '#B2AA98', SAGE = '#7AB07A', RED = '#C27070'
const SERIF = "Georgia, 'Times New Roman', serif"
// Escapes " and ' too — renderProse interpolates the captured URL into an
// href="…" attribute, so an unescaped quote would let staff-authored narrative
// break out of the attribute and inject an event handler (stored XSS on the
// public /reports/[token] page + the emailed report).
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
// Staff can add clickable links in any narrative section with markdown syntax:
// [label](https://…). Everything else is escaped; only http(s) links become <a>.
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const renderProse = (s: unknown) => esc(s).replace(LINK_RE, (_m, label, url) => `<a href="${url}" style="color:#D4B85A;text-decoration:underline">${label}</a>`)
const vnd = (n: number) => `${new Intl.NumberFormat('en-US').format(Math.round(n))} ₫`
const site = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'

function delta(n: number | null | undefined): string {
  if (n == null) return ''
  if (n > 0) return `<span style="color:${SAGE};font-size:12px"> ▲ ${n}</span>`
  if (n < 0) return `<span style="color:${RED};font-size:12px"> ▼ ${Math.abs(n)}</span>`
  return `<span style="color:${MUTED};font-size:12px"> — </span>`
}

// Email-safe horizontal bar chart (table + coloured divs).
function barsHtml(rows: { label: string; value: number; max?: number | null; suffix?: string }[]): string {
  if (!rows.length) return ''
  const max = Math.max(...rows.map(r => r.max || r.value), 1)
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0">${rows.map((r, i) => {
    const pct = Math.max(2, Math.round(((r.value) / max) * 100))
    return `<tr>
      <td style="font-family:${SERIF};font-size:12px;color:${CREAM};padding:4px 8px 4px 0;white-space:nowrap;width:34%">${esc(r.label)}</td>
      <td style="padding:4px 0;width:50%"><div style="background:rgba(229,212,194,0.10);border-radius:6px;height:12px"><div style="background:${PALETTE[i % PALETTE.length]};width:${pct}%;height:12px;border-radius:6px;font-size:0;line-height:12px">&nbsp;</div></div></td>
      <td style="font-family:'Google Sans Code',monospace;font-size:11px;color:${MUTED};padding:4px 0 4px 8px;text-align:right;white-space:nowrap">${r.value}${r.suffix || (r.max ? ' / ' + r.max : '')}</td>
    </tr>`
  }).join('')}</table>`
}

function chartBlock(mode: Mode, svg: string, bars: string): string {
  return mode === 'email' ? bars : `<div style="margin:8px 0;overflow-x:auto">${svg}</div>`
}
function section(title: string, sub: string, inner: string): string {
  return `<div style="margin:0 0 38px">
    <div style="border-bottom:1px solid rgba(212,184,90,0.22);padding-bottom:7px;margin-bottom:16px">
      <span style="font-family:'Google Sans Code',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD}">${esc(title)}</span>
      ${sub ? `<div style="font-size:12px;color:${MUTED};font-style:italic;margin-top:4px">${esc(sub)}</div>` : ''}
    </div>
    ${inner}
  </div>`
}
// Stat card — gold figure in a bordered tile.
function stat(value: string, label: string, extra = ''): string {
  return `<td style="padding:5px;width:25%;vertical-align:top">
    <div style="background:${CARD};border:1px solid rgba(212,184,90,0.16);border-radius:10px;padding:15px 10px;text-align:center">
      <div style="font-family:${SERIF};font-size:27px;color:${GOLD};line-height:1;font-weight:600">${value}${extra}</div>
      <div style="font-family:'Google Sans Code',monospace;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};margin-top:7px">${esc(label)}</div>
    </div>
  </td>`
}
function narrative(title: string, body: string | undefined): string {
  if (!body || !body.trim()) return ''
  return section(title, '', `<div style="font-size:14px;line-height:1.75;color:${CREAM};white-space:pre-wrap">${renderProse(body)}</div>`)
}
function callout(title: string, body: string): string {
  return `<div style="border-left:3px solid ${GOLD};background:rgba(212,184,90,0.06);padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 24px"><div style="font-family:'Google Sans Code',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};margin-bottom:6px">${esc(title)}</div><div style="font-size:14px;color:${CREAM};line-height:1.7">${body}</div></div>`
}

export function renderReportBody(r: ReportRow, mode: Mode): string {
  const d = r.auto_data
  const n = r.narrative || {}
  const u = d.usage

  let html = `<div style="margin:0 0 34px">
    <img src="${site()}/images/library-bar-opt.png" alt="" width="100%" style="display:block;width:100%;border-radius:14px;border:1px solid rgba(212,184,90,0.20)"/>
    <div style="text-align:center;margin-top:22px">
      <div style="font-family:'Google Sans Code',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD}">The Rampant Club · Weekly Report</div>
      <h1 style="font-family:${SERIF};font-size:33px;color:${CREAM};font-weight:600;margin:12px 0 4px;letter-spacing:0.01em">${esc(r.headline || n.headline || 'The Week at the Club')}</h1>
      <div style="font-size:12px;color:${MUTED};letter-spacing:0.04em">${esc(d.period.label)}</div>
      <div style="width:40px;height:2px;background:${GOLD};margin:16px auto 0;opacity:0.6"></div>
    </div>
  </div>`

  if (n.moment_of_week?.trim()) html += callout('Moment of the week', renderProse(n.moment_of_week))

  // Usage
  html += section('Club Usage', 'Members through the doors this week', `
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      ${stat(String(u.visits), 'visits', delta(d.deltas.visits))}
      ${stat(String(u.unique_members), 'unique members', delta(d.deltas.unique_members))}
      ${stat(String(u.footfall_unique), 'footfall (taps)', delta(d.deltas.footfall_unique))}
      ${stat(`${u.avg_minutes}m`, 'avg stay')}
    </tr></table>
    ${chartBlock(mode, lineChart(u.visits_by_day.map(x => ({ label: x.label, count: x.count })), 'dark'), barsHtml(u.visits_by_day.map(x => ({ label: x.label, value: x.count }))))}
    ${d.member_of_week ? `<div style="font-size:13px;color:${MUTED};margin-top:6px">Member of the week: <span style="color:${CREAM}">${esc(d.member_of_week.name)}</span> — ${d.member_of_week.visits} visits.</div>` : ''}
    ${u.guest_proxy > 0 ? `<div style="font-size:12px;color:${MUTED};margin-top:4px;font-style:italic">~${u.guest_proxy} guests (estimated from party sizes)${n.guests_note ? ' · ' + esc(n.guests_note) : ''}</div>` : (n.guests_note ? `<div style="font-size:12px;color:${MUTED};margin-top:4px;font-style:italic">${esc(n.guests_note)}</div>` : '')}
  `)

  // Events
  const evF = d.events.fixtures || []
  const calKinds = Object.entries(d.events.calendar_by_kind || {})
  if (evF.length || calKinds.length) {
    html += section('Events', 'Fixtures, tastings & house events', `
      ${evF.length ? chartBlock(mode, hbars(evF.map(f => ({ label: f.title, value: f.signups, max: f.max })), 'dark'), barsHtml(evF.map(f => ({ label: f.title, value: f.signups, max: f.max })))) : ''}
      ${calKinds.length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">${calKinds.map(([k, v]) => `${v}× ${esc(k.replace(/_/g, ' '))}`).join(' · ')}</div>` : ''}
      ${!evF.length && !calKinds.length ? `<div style="font-size:13px;color:${MUTED}">A quieter week on the events calendar.</div>` : ''}
    `)
  }

  // Membership & pipeline
  const tierSegs = Object.entries(d.members.by_tier || {}).map(([label, value]) => ({ label, value: value as number }))
  html += section('Membership & Pipeline', 'New members, interviews & applications', `
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      ${stat(String(d.members.new_total), 'new members', delta(d.deltas.new_members))}
      ${stat(String(d.pipeline.signed), 'agreements signed', delta(d.deltas.signed))}
      ${stat(String(d.pipeline.movements.stage_changed || 0), 'pipeline moves')}
      ${stat(`${d.pipeline.conversion_pct}%`, 'lead→member')}
    </tr></table>
    ${tierSegs.length ? chartBlock(mode, donut(tierSegs, 'dark'), barsHtml(tierSegs.map(t => ({ label: t.label, value: t.value })))) : ''}
    ${chartBlock(mode, funnel(d.pipeline.funnel, 'dark'), barsHtml(d.pipeline.funnel.map(f => ({ label: f.stage, value: f.count }))))}
    ${(d.pipeline.interviews || []).length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">Interviews this week: ${d.pipeline.interviews.map(i => `${esc(i.name)}${i.interviewer ? ` (with ${esc(i.interviewer)})` : ''}`).join(' · ')}</div>` : ''}
    ${n.interviews_commentary?.trim() ? `<div style="font-size:14px;line-height:1.7;color:${CREAM};margin-top:10px;white-space:pre-wrap">${renderProse(n.interviews_commentary)}</div>` : ''}
  `)

  html += narrative('Marketing Initiatives', n.marketing)
  html += narrative('Cost-Cutting', n.cost_cutting)
  html += narrative('Successes', n.successes)

  // Financials
  if (r.include_financials && r.financials && 'total_revenue' in r.financials) {
    const f = r.financials as Financials
    const momGroups = f.mom.map(m => ({ label: m.label, parts: { Membership: m.membership, 'Card top-ups': m.card_topups, Gifting: m.gifting } }))
    const momBars = f.mom.map(m => ({ label: m.label, value: Math.round((m.membership + m.card_topups) / 1_000_000), suffix: 'M' }))
    html += section(`Financials · ${esc(f.month_label)}`, 'Revenue this month, and the trend', `
      <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
        ${stat(vnd(f.total_revenue), 'total revenue', f.delta_pct != null ? delta(f.delta_pct) : '')}
        ${stat(vnd(f.membership.total), `membership · ${f.membership.count}`)}
        ${stat(vnd(f.card.topups), 'card top-ups')}
        ${stat(vnd(f.gifting.total), 'gifting spend')}
      </tr></table>
      ${chartBlock(mode, stackedBars(momGroups, ['Membership', 'Card top-ups', 'Gifting'], 'dark'), barsHtml(momBars))}
    `)
  }

  if (n.closing_note?.trim()) html += `<div style="font-size:14px;line-height:1.75;color:${CREAM};font-style:italic;margin-top:8px;white-space:pre-wrap">${renderProse(n.closing_note)}</div>`
  return html
}

export function renderReportEmail(r: ReportRow): string {
  const body = renderReportBody(r, 'email')
  const url = `${site()}/reports/${r.share_token}`
  return `<div style="max-width:680px;margin:0 auto;background:${GREEN};font-family:${SERIF}">
    <div style="padding:36px 40px 8px;text-align:center">
      <img src="${site()}/images/logo-mark-cream.svg" alt="The Rampant Club" width="46" style="display:block;margin:0 auto;opacity:0.9"/>
    </div>
    <div style="padding:16px 40px 8px">${body}</div>
    <div style="text-align:center;padding:8px 40px 32px">
      <a href="${url}" style="display:inline-block;background:${GOLD};color:${GREEN};text-decoration:none;border-radius:24px;padding:13px 30px;font-family:'Google Sans Code',monospace;font-size:13px;font-weight:700;letter-spacing:0.04em">View the full report →</a>
    </div>
    <div style="background:${CARD};padding:24px 40px;text-align:center">
      <div style="font-size:10px;color:${MUTED};line-height:1.7">74A2 Hai Ba Trung, District 1, Ho Chi Minh City<br>The Rampant Club · Weekly Executive Report</div>
    </div>
  </div>`
}
