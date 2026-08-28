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

// Weekly P&L — revenue & operating-cost lines from the editable narrative.pl
// block ({revenue:[{label,amount}], costs:[{label,amount}], note}). Totals and
// net computed here. Email-safe (table + inline styles); no data source for the
// cost side by design, so staff enter the week's lines.
interface PLLine { label: string; amount: number }
interface PLBlock { revenue?: PLLine[]; costs?: PLLine[]; note?: string }
function plTable(pl: PLBlock | undefined): string {
  if (!pl || (!(pl.revenue && pl.revenue.length) && !(pl.costs && pl.costs.length))) return ''
  const rev = pl.revenue || [], cost = pl.costs || []
  const totRev = rev.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totCost = cost.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const net = totRev - totCost
  const bd = 'border-bottom:1px solid rgba(229,212,194,0.08)'
  const line = (label: string, amount: number, o: { color?: string; amt?: string; bold?: boolean; neg?: boolean } = {}) =>
    `<tr><td style="font-size:13px;color:${o.color || CREAM};padding:7px 0;${bd};${o.bold ? 'font-weight:700' : ''}">${esc(label)}</td>
     <td style="font-family:'Google Sans Code',monospace;font-size:13px;color:${o.amt || CREAM};text-align:right;padding:7px 0;${bd};${o.bold ? 'font-weight:700' : ''};white-space:nowrap">${o.neg ? '−' : ''}${vnd(Math.abs(amount))}</td></tr>`
  const grp = (t: string) => `<tr><td colspan="2" style="font-family:${SERIF};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};padding:16px 0 6px;border-bottom:1px solid rgba(212,184,90,0.28)">${esc(t)}</td></tr>`
  const inner = `<table role="presentation" style="width:100%;border-collapse:collapse">
    ${grp('Revenue')}
    ${rev.map(r => line(r.label, Number(r.amount) || 0)).join('')}
    ${line('Total revenue', totRev, { bold: true, amt: GOLD })}
    ${grp('Operating costs')}
    ${cost.map(r => line(r.label, Number(r.amount) || 0, { color: MUTED, amt: RED, neg: true })).join('')}
    ${line('Total operating cost', totCost, { bold: true, amt: RED, neg: true })}
    <tr><td style="font-family:${SERIF};font-size:16px;color:${CREAM};padding:15px 0 0;border-top:2px solid ${GOLD};font-weight:600">Net position</td>
        <td style="font-family:${SERIF};font-size:21px;color:${net >= 0 ? SAGE : RED};text-align:right;padding:15px 0 0;border-top:2px solid ${GOLD};font-weight:600;white-space:nowrap">${net < 0 ? '−' : ''}${vnd(Math.abs(net))}</td></tr>
  </table>
  ${pl.note ? `<div style="font-size:12px;color:${MUTED};font-style:italic;margin-top:12px">${renderProse(pl.note)}</div>` : ''}`
  return section('Revenue & Weekly Costs', 'Profit & loss for the trading week', inner)
}

// Structured extras carried on narrative jsonb (edited via seed / future editor
// fields; the string-keyed editor leaves them untouched).
interface ColBlock { heading: string; items: string[] }
interface MomentumItem { source: string; note: string; url?: string }
interface ActionItem { owner: string; title: string; detail: string }
interface NarrativeX {
  pl?: PLBlock; ops?: ColBlock[]; retail?: ColBlock[];
  momentum?: MomentumItem[]; actions?: ActionItem[]; events_note?: string
}

// Two-column (or single) card block — used for the ops reset & whisky retail plan.
function cardsSection(title: string, sub: string, blocks: ColBlock[] | undefined): string {
  if (!blocks || !blocks.length) return ''
  const w = blocks.length > 1 ? '50%' : '100%'
  const card = (c: ColBlock) => `<td style="width:${w};vertical-align:top;padding:5px">
    <div style="background:${CARD};border:1px solid rgba(212,184,90,0.16);border-radius:10px;padding:16px 18px">
      <div style="font-family:${SERIF};font-size:15px;color:${CREAM};font-weight:600;margin-bottom:6px">${esc(c.heading)}</div>
      ${c.items.map((it, i) => `<div style="font-size:13px;color:${MUTED};line-height:1.55;padding:6px 0 6px 15px;position:relative${i ? ';border-top:1px solid rgba(229,212,194,0.07)' : ''}"><span style="position:absolute;left:1px;top:12px;width:5px;height:5px;background:${GOLD};transform:rotate(45deg)"></span>${renderProse(it)}</div>`).join('')}
    </div></td>`
  return section(title, sub, `<table role="presentation" style="width:100%;border-collapse:collapse"><tr>${blocks.map(card).join('')}</tr></table>`)
}

function momentumSection(items: MomentumItem[] | undefined): string {
  if (!items || !items.length) return ''
  const rows = items.map(m => `<div style="border-left:3px solid ${GOLD};background:rgba(212,184,90,0.05);padding:11px 14px;margin:0 0 9px;border-radius:0 6px 6px 0">
    <span style="font-family:${SERIF};font-size:14px;color:${GOLD};font-weight:600">${esc(m.source)}</span>
    <span style="font-size:13px;color:${CREAM};margin-left:8px">${m.url ? `<a href="${esc(m.url)}" style="color:${CREAM};text-decoration:underline">${esc(m.note)}</a>` : esc(m.note)}</span>
  </div>`).join('')
  return section('Brand Momentum', 'Press & reach this week', rows)
}

function actionsSection(items: ActionItem[] | undefined): string {
  if (!items || !items.length) return ''
  const rows = items.map((a, i) => `<tr>
    <td style="font-family:'Google Sans Code',monospace;font-size:11px;color:${GOLD};text-transform:uppercase;letter-spacing:0.05em;padding:11px 14px 11px 0;white-space:nowrap;vertical-align:top${i ? ';border-top:1px solid rgba(229,212,194,0.08)' : ''}">${esc(a.owner)}</td>
    <td style="padding:11px 0${i ? ';border-top:1px solid rgba(229,212,194,0.08)' : ''}"><div style="font-size:14px;color:${CREAM};font-weight:600">${esc(a.title)}</div><div style="font-size:12.5px;color:${MUTED};margin-top:2px">${renderProse(a.detail)}</div></td>
  </tr>`).join('')
  return section('Actions This Week', 'Owned & moving', `<table role="presentation" style="width:100%;border-collapse:collapse">${rows}</table>`)
}

export function renderReportBody(r: ReportRow, mode: Mode): string {
  const d = r.auto_data
  const n = r.narrative || {}
  const u = d.usage

  let html = `<div style="margin:0 0 34px">
    <img src="${site()}/images/DC500693.jpg" alt="" width="100%" style="display:block;width:100%;border-radius:14px;border:1px solid rgba(212,184,90,0.20)"/>
    <div style="text-align:center;margin-top:22px">
      <div style="font-family:'Google Sans Code',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD}">The Rampant Club · Weekly Report</div>
      <h1 style="font-family:${SERIF};font-size:33px;color:${CREAM};font-weight:600;margin:12px 0 4px;letter-spacing:0.01em">${esc(r.headline || n.headline || 'The Week at the Club')}</h1>
      <div style="font-size:12px;color:${MUTED};letter-spacing:0.04em">${esc(d.period.label)}</div>
      <div style="width:40px;height:2px;background:${GOLD};margin:16px auto 0;opacity:0.6"></div>
    </div>
  </div>`

  if (n.moment_of_week?.trim()) html += callout('Moment of the week', renderProse(n.moment_of_week))

  // Structured extras carried on the narrative jsonb.
  const nx = n as unknown as NarrativeX
  // Revenue & weekly costs P&L (leads the report — the number Shawn wants first)
  html += plTable(nx.pl)

  // Who's been in & how long — attendance + time in the club
  const memberHours = Math.round(u.total_member_minutes / 60)
  const guestHours = Math.round(u.guest_minutes / 60)
  const attendanceLine = (() => {
    const parts: string[] = []
    if (memberHours > 0) parts.push(`Members spent <span style="color:${CREAM}">~${memberHours}h</span> in the club`)
    if (u.guest_heads > 0) parts.push(`<span style="color:${CREAM}">${u.guest_heads}</span> guest${u.guest_heads === 1 ? '' : 's'} logged${guestHours > 0 ? ` (~${guestHours}h)` : ''}`)
    else if (u.guest_proxy > 0) parts.push(`~${u.guest_proxy} guests (estimated from party sizes)`)
    const line = parts.join(' · ')
    const note = n.guests_note ? (line ? ' · ' : '') + esc(n.guests_note) : ''
    return (line || note) ? `<div style="font-size:12.5px;color:${MUTED};margin-top:8px">${line}${note}</div>` : ''
  })()
  html += section('Who’s Been In', 'Attendance & time in the club this week', `
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      ${stat(String(u.visits), 'member visits', delta(d.deltas.visits))}
      ${stat(String(u.unique_members), 'unique members', delta(d.deltas.unique_members))}
      ${stat(`${u.avg_minutes}m`, 'avg stay')}
      ${stat(u.guest_heads > 0 ? String(u.guest_heads) : String(u.footfall_unique), u.guest_heads > 0 ? 'guests in' : 'footfall (taps)', u.guest_heads > 0 ? undefined : delta(d.deltas.footfall_unique))}
    </tr></table>
    ${chartBlock(mode, lineChart(u.visits_by_day.map(x => ({ label: x.label, count: x.count })), 'dark'), barsHtml(u.visits_by_day.map(x => ({ label: x.label, value: x.count }))))}
    ${attendanceLine}
    ${d.member_of_week ? `<div style="font-size:13px;color:${MUTED};margin-top:6px">Member of the week: <span style="color:${CREAM}">${esc(d.member_of_week.name)}</span> — ${d.member_of_week.visits} visits.</div>` : ''}
  `)

  // Events
  const evF = d.events.fixtures || []
  const calKinds = Object.entries(d.events.calendar_by_kind || {})
  const eventsNote = nx.events_note
  if (evF.length || calKinds.length || (eventsNote && eventsNote.trim())) {
    html += section('Events', 'Fixtures, tastings & house events', `
      ${eventsNote && eventsNote.trim() ? `<div style="font-size:14px;color:${CREAM};line-height:1.7;white-space:pre-wrap;margin-bottom:${(evF.length || calKinds.length) ? '12px' : '0'}">${renderProse(eventsNote)}</div>` : ''}
      ${evF.length ? chartBlock(mode, hbars(evF.map(f => ({ label: f.title, value: f.signups, max: f.max })), 'dark'), barsHtml(evF.map(f => ({ label: f.title, value: f.signups, max: f.max })))) : ''}
      ${calKinds.length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">${calKinds.map(([k, v]) => `${v}× ${esc(k.replace(/_/g, ' '))}`).join(' · ')}</div>` : ''}
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
  html += cardsSection('Team & Operations', 'The changes in place now', nx.ops)
  html += cardsSection('Whisky Retail · Quy & Tai', 'Low-cost, high-visibility improvements', nx.retail)
  html += narrative('Successes', n.successes)
  html += momentumSection(nx.momentum)
  html += actionsSection(nx.actions)

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
