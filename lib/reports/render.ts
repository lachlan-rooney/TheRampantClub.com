import type { AutoData } from './gather'
import type { Financials } from './financials'
import { lineChart, sparkline, donut, hbars, funnel, stackedBars } from './charts'

// Shared report renderer. One section builder drives all three surfaces: the
// hosted page (inline SVG), the email (PNG charts by URL — Gmail strips SVG),
// and the PDF export. Dark club theme (green ground, cream text, gold accents)
// so the chart palette is consistent everywhere.

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

const GREEN = '#052E20', CARD = '#0A3526', CREAM = '#E5D4C2', GOLD = '#D4B85A', MUTED = '#B2AA98', SAGE = '#7AB07A', RED = '#C27070'
const SERIF = "Georgia, 'Times New Roman', serif"
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const vnd = (n: number) => `${new Intl.NumberFormat('en-US').format(Math.round(n))} ₫`
const site = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'

function delta(n: number | null | undefined): string {
  if (n == null) return ''
  if (n > 0) return `<span style="color:${SAGE};font-size:12px"> ▲ ${n}</span>`
  if (n < 0) return `<span style="color:${RED};font-size:12px"> ▼ ${Math.abs(n)}</span>`
  return `<span style="color:${MUTED};font-size:12px"> — </span>`
}

// mode: 'svg' inlines the chart; 'png' references the pre-rendered chart_urls image
function chart(key: string, svg: string, mode: 'svg' | 'png', urls: Record<string, string>): string {
  if (mode === 'png') {
    const url = urls[key]
    return url ? `<img src="${url}" alt="" style="display:block;max-width:100%;height:auto;margin:8px 0"/>` : ''
  }
  return `<div style="margin:8px 0;overflow-x:auto">${svg}</div>`
}

function section(title: string, sub: string, inner: string): string {
  return `<div style="margin:0 0 34px">
    <div style="font-family:'Google Sans Code',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};margin-bottom:3px">${esc(title)}</div>
    ${sub ? `<div style="font-size:12px;color:${MUTED};font-style:italic;margin-bottom:14px">${esc(sub)}</div>` : ''}
    ${inner}
  </div>`
}
function stat(value: string, label: string, extra = ''): string {
  return `<td style="padding:10px 14px;vertical-align:top"><div style="font-family:${SERIF};font-size:30px;color:${CREAM};line-height:1">${value}${extra}</div><div style="font-family:'Google Sans Code',monospace;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};margin-top:6px">${esc(label)}</div></td>`
}
function narrative(title: string, body: string | undefined): string {
  if (!body || !body.trim()) return ''
  return section(title, '', `<div style="font-size:14px;line-height:1.75;color:${CREAM};white-space:pre-wrap">${esc(body)}</div>`)
}
function callout(title: string, body: string): string {
  return `<div style="border-left:3px solid ${GOLD};background:rgba(212,184,90,0.06);padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 24px"><div style="font-family:'Google Sans Code',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};margin-bottom:6px">${esc(title)}</div><div style="font-size:14px;color:${CREAM};line-height:1.7">${body}</div></div>`
}

export function renderReportBody(r: ReportRow, mode: 'svg' | 'png'): string {
  const d = r.auto_data
  const n = r.narrative || {}
  const u = d.usage
  const urls = r.chart_urls || {}

  // Cover
  let html = `<div style="text-align:center;margin:0 0 30px">
    <div style="font-family:'Google Sans Code',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD}">The Rampant Club · Weekly Report</div>
    <h1 style="font-family:${SERIF};font-size:30px;color:${CREAM};font-weight:600;margin:10px 0 4px">${esc(r.headline || n.headline || 'The Week at the Club')}</h1>
    <div style="font-size:12px;color:${MUTED}">${esc(d.period.label)}</div>
  </div>`

  // Moment of the week
  if (n.moment_of_week?.trim()) html += callout('Moment of the week', esc(n.moment_of_week))

  // Usage
  html += section('Club Usage', 'Members through the doors this week', `
    <table style="width:100%;border-collapse:collapse"><tr>
      ${stat(String(u.visits), 'visits', delta(d.deltas.visits))}
      ${stat(String(u.unique_members), 'unique members', delta(d.deltas.unique_members))}
      ${stat(String(u.footfall_unique), 'footfall (taps)', delta(d.deltas.footfall_unique))}
      ${stat(`${u.avg_minutes}m`, 'avg stay')}
    </tr></table>
    ${chart('visits', lineChart(u.visits_by_day.map(x => ({ label: x.label, count: x.count })), 'dark'), mode, urls)}
    ${d.member_of_week ? `<div style="font-size:13px;color:${MUTED};margin-top:6px">Member of the week: <span style="color:${CREAM}">${esc(d.member_of_week.name)}</span> — ${d.member_of_week.visits} visits.</div>` : ''}
    ${u.guest_proxy > 0 ? `<div style="font-size:12px;color:${MUTED};margin-top:4px;font-style:italic">~${u.guest_proxy} guests (estimated from party sizes)${n.guests_note ? ' · ' + esc(n.guests_note) : ''}</div>` : (n.guests_note ? `<div style="font-size:12px;color:${MUTED};margin-top:4px;font-style:italic">${esc(n.guests_note)}</div>` : '')}
  `)

  // Events
  const evF = d.events.fixtures || []
  const calKinds = Object.entries(d.events.calendar_by_kind || {})
  if (evF.length || calKinds.length) {
    html += section('Events', 'Fixtures, tastings & house events', `
      ${evF.length ? chart('events', hbars(evF.map(f => ({ label: `${f.title}`, value: f.signups, max: f.max })), 'dark'), mode, urls) : ''}
      ${calKinds.length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">${calKinds.map(([k, v]) => `${v}× ${esc(k.replace(/_/g, ' '))}`).join(' · ')}</div>` : ''}
      ${!evF.length && !calKinds.length ? `<div style="font-size:13px;color:${MUTED}">A quieter week on the events calendar.</div>` : ''}
    `)
  }

  // Membership & pipeline
  const tierSegs = Object.entries(d.members.by_tier || {}).map(([label, value]) => ({ label, value }))
  html += section('Membership & Pipeline', 'New members, interviews & applications', `
    <table style="width:100%;border-collapse:collapse"><tr>
      ${stat(String(d.members.new_total), 'new members', delta(d.deltas.new_members))}
      ${stat(String(d.pipeline.signed), 'agreements signed', delta(d.deltas.signed))}
      ${stat(String(d.pipeline.movements.stage_changed || 0), 'pipeline moves')}
      ${stat(`${d.pipeline.conversion_pct}%`, 'lead→member')}
    </tr></table>
    ${tierSegs.length ? chart('members', donut(tierSegs, 'dark'), mode, urls) : ''}
    ${chart('funnel', funnel(d.pipeline.funnel, 'dark'), mode, urls)}
    ${(d.pipeline.interviews || []).length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">Interviews this week: ${d.pipeline.interviews.map(i => `${esc(i.name)}${i.interviewer ? ` (with ${esc(i.interviewer)})` : ''}`).join(' · ')}</div>` : ''}
    ${n.interviews_commentary?.trim() ? `<div style="font-size:14px;line-height:1.7;color:${CREAM};margin-top:10px;white-space:pre-wrap">${esc(n.interviews_commentary)}</div>` : ''}
  `)

  // Narrative sections
  html += narrative('Marketing Initiatives', n.marketing)
  html += narrative('Cost-Cutting', n.cost_cutting)
  html += narrative('Successes', n.successes)

  // Financials (monthly)
  if (r.include_financials && r.financials && 'total_revenue' in r.financials) {
    const f = r.financials as Financials
    const momGroups = f.mom.map(m => ({ label: m.label, parts: { Membership: m.membership, 'Card top-ups': m.card_topups, Gifting: m.gifting } }))
    html += section(`Financials · ${esc(f.month_label)}`, 'Revenue this month, and the trend', `
      <table style="width:100%;border-collapse:collapse"><tr>
        ${stat(vnd(f.total_revenue), 'total revenue', f.delta_pct != null ? delta(f.delta_pct) : '')}
        ${stat(vnd(f.membership.total), `membership · ${f.membership.count}`)}
        ${stat(vnd(f.card.topups), 'card top-ups')}
        ${stat(vnd(f.gifting.total), 'gifting spend')}
      </tr></table>
      ${chart('financials', stackedBars(momGroups, ['Membership', 'Card top-ups', 'Gifting'], 'dark'), mode, urls)}
    `)
  }

  // Closing
  if (n.closing_note?.trim()) html += `<div style="font-size:14px;line-height:1.75;color:${CREAM};font-style:italic;margin-top:8px;white-space:pre-wrap">${esc(n.closing_note)}</div>`

  return html
}

// Full branded email (dark). Wraps the body + a button to the hosted report.
export function renderReportEmail(r: ReportRow): string {
  const body = renderReportBody(r, 'png')
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
