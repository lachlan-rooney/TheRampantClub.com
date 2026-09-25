import type { AutoData } from './gather'
import type { Financials } from './financials'
import { donut, funnel, hbars, stackedBars, PALETTE } from './charts'

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
      ${/* A currency figure must not break mid-number: "2,200,000" over two lines
            with the ₫ stranded below read as two amounts in the email. */ ''}
      <div style="font-family:${SERIF};font-size:27px;color:${GOLD};line-height:1;font-weight:600;white-space:nowrap">${value}${extra}</div>
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

function momentumSection(items: MomentumItem[] | undefined, span: string): string {
  if (!items || !items.length) return ''
  const rows = items.map(m => `<div style="border-left:3px solid ${GOLD};background:rgba(212,184,90,0.05);padding:11px 14px;margin:0 0 9px;border-radius:0 6px 6px 0">
    <span style="font-family:${SERIF};font-size:14px;color:${GOLD};font-weight:600">${esc(m.source)}</span>
    <span style="font-size:13px;color:${CREAM};margin-left:8px">${m.url ? `<a href="${esc(m.url)}" style="color:${CREAM};text-decoration:underline">${esc(m.note)}</a>` : esc(m.note)}</span>
  </div>`).join('')
  return section('Brand Momentum', `Press & reach ${span}`, rows)
}

function actionsSection(items: ActionItem[] | undefined): string {
  if (!items || !items.length) return ''
  const rows = items.map((a, i) => `<tr>
    <td style="font-family:'Google Sans Code',monospace;font-size:11px;color:${GOLD};text-transform:uppercase;letter-spacing:0.05em;padding:11px 14px 11px 0;white-space:nowrap;vertical-align:top${i ? ';border-top:1px solid rgba(229,212,194,0.08)' : ''}">${esc(a.owner)}</td>
    <td style="padding:11px 0${i ? ';border-top:1px solid rgba(229,212,194,0.08)' : ''}"><div style="font-size:14px;color:${CREAM};font-weight:600">${esc(a.title)}</div><div style="font-size:12.5px;color:${MUTED};margin-top:2px">${renderProse(a.detail)}</div></td>
  </tr>`).join('')
  return section('Actions This Week', 'Owned & moving', `<table role="presentation" style="width:100%;border-collapse:collapse">${rows}</table>`)
}

// ── WHAT THE SYSTEM WROTE ───────────────────────────────────────────────────
// A drafted paragraph sits under the figures it describes, never instead of
// them: the numbers are the report, the sentence is the reading of them.
function prose(body: string | undefined): string {
  if (!body || !body.trim()) return ''
  return `<div style="font-size:13.5px;line-height:1.75;color:${CREAM};margin-top:12px;white-space:pre-wrap">${renderProse(body)}</div>`
}

// THE TEN-SECOND READ (2026-09-17). Three lines, at the top, before anything
// that needs scrolling — the owner's report went out to an investor who had to
// hunt through eight sections for what changed.
function summaryBlock(lines: string[]): string {
  if (!lines.length) return ''
  return `<div style="border-left:3px solid ${GOLD};background:rgba(212,184,90,0.06);padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 26px">
    ${lines.map((l, i) => `<div style="font-family:${SERIF};font-size:15px;color:${CREAM};line-height:1.55;padding:${i ? '7px' : '0'} 0 0 16px;position:relative">
      <span style="position:absolute;left:0;top:${i ? 15 : 8}px;width:5px;height:5px;background:${GOLD};transform:rotate(45deg)"></span>${renderProse(l)}</div>`).join('')}
  </div>`
}

// A bar with a target behind it. Used for the month against its target and for
// the shift board — both are "how far through are we", and a percentage alone
// hides whether the denominator is real.
function progress(label: string, value: number, max: number, valueText: string, tone = GOLD): string {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return `<div style="margin:10px 0 0">
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      <td style="font-size:12.5px;color:${MUTED};padding:0 0 5px">${esc(label)}</td>
      <td style="font-family:'Google Sans Code',monospace;font-size:12.5px;color:${CREAM};text-align:right;padding:0 0 5px;white-space:nowrap">${esc(valueText)}</td>
    </tr></table>
    <div style="background:rgba(229,212,194,0.10);border-radius:6px;height:10px">
      <div style="background:${tone};width:${Math.max(pct, 1)}%;height:10px;border-radius:6px;font-size:0;line-height:10px">&nbsp;</div>
    </div>
  </div>`
}

// ── MONEY ───────────────────────────────────────────────────────────────────
// Membership fees and member card top-ups are the only money the club records.
// The section says so in plain words, every week: a figure an investor might
// read as turnover has to carry what it does not include.
function moneySection(d: AutoData, note?: string): string {
  const m = d.money
  if (!m) return ''
  const w = m.week, t = m.mtd
  const stats = `<table role="presentation" style="width:100%;border-collapse:collapse"><tr>
    ${/* EVERY TILE SAYS ITS WINDOW. "Card top-ups" appeared here for the week and
          again under Financials for the month, and "of month target" appeared in
          the summary row above — the same words twice, meaning different things
          (2026-09-17). The percentage lives in the bar below, not in a tile. */ ''}
    ${/* Short labels: at email width a four-tile row gave "FEES THIS WEEK" three
          lines of its own. The section's subtitle already says these are weekly. */ ''}
    ${stat(vnd(w.membership_total), w.membership_count ? `fees · ${w.membership_count} paid` : 'fees · week')}
    ${stat(vnd(w.card_topups), 'top-ups · week')}
    ${stat(vnd(w.card_charges), 'card spend · week')}
    ${stat(vnd(t.total), 'month to date')}
  </tr></table>`
  // TWO MONTH TOTALS IN ONE REPORT IS A QUESTION, NOT A FIGURE. This one runs to
  // the week's end; the Financials section below covers the whole month, so a
  // top-up banked on the 14th appears there and not here. Both are labelled with
  // the window they cover rather than both saying "this month" (2026-09-17).
  const to = new Date(d.period.end + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const target = t.target_vnd
    ? progress(`${t.month_label} to ${to}`, t.total, t.target_vnd, `${vnd(t.total)} of ${vnd(t.target_vnd)}`)
    : ''
  const cost = t.cost_base_vnd
    ? `<div style="font-size:12px;color:${MUTED};margin-top:8px">Monthly cost base, as configured: ${vnd(t.cost_base_vnd)}.</div>` : ''
  const paid = w.payments.length
    ? `<div style="font-size:13px;color:${CREAM};margin-top:10px">${w.payments.map(p => `${esc(p.name)} <span style="color:${MUTED}">${esc(p.tier)} · ${vnd(p.amount)} · ${esc(p.method)}</span>`).join('<br>')}</div>` : ''
  // MONEY ENTERED THIS WEEK FOR AN EARLIER PERIOD. Revenue stays in the period
  // it was paid for — that is what the tiles above count — but the week of
  // 14–20 Sept reported "0 ₫ fees" while three payments worth 388,375,000₫ were
  // typed in, two of them dated in August and already past August's reports.
  // They showed up in no report at all. This says so, in the week the work
  // happened, without moving a dong of revenue (owner asked, 2026-09-25).
  // NAME THE MONTH IT BELONGS TO. "An earlier period" is not something anybody
  // can act on; "August 2026" is — and when two payments taken in August are
  // keyed in on 17 September, August's report has already gone out without
  // them (owner, 2026-09-25: "revenue from August should have been in august
  // report. I will get chau to record payments timely.").
  const months = w.backdated?.by_month?.length
    ? w.backdated.by_month.map(m => `${vnd(m.total)} to ${esc(m.label)}`).join(' · ')
    : ''
  const back = w.backdated && w.backdated.count
    ? `<div style="font-size:12.5px;color:${GOLD};margin-top:10px">${w.backdated.count} payment${w.backdated.count === 1 ? '' : 's'} recorded this week, taken earlier: ${months || vnd(w.backdated.total)}. Counted in that month's revenue, not this week's — and where that month has already been reported, its report went out without them.</div>`
    : ''
  return section('Money', 'Membership fees & member card activity', `${stats}${target}${cost}${paid}${back}${prose(note)}
    <div style="font-size:11.5px;color:${MUTED};font-style:italic;margin-top:10px">Recorded revenue only — membership fees and card top-ups. The club keeps no till feed or expense ledger, so this is not profit.</div>`)
}

// ── THE TEAM'S WEEK ─────────────────────────────────────────────────────────
function opsSection(d: AutoData, span: string, note?: string): string {
  const o = d.ops
  if (!o) return ''
  const t = o.tasks
  const board = t.total
    ? progress('Shift tasks marked done', t.done, t.total, `${t.done} of ${t.total}`, t.done ? SAGE : RED)
    : `<div style="font-size:13px;color:${MUTED}">No shift tasks were set for ${span}.</div>`
  const blocked = t.blocked ? `<div style="font-size:12.5px;color:${RED};margin-top:6px">${t.blocked} blocked.</div>` : ''
  const actions = o.top_actions.length
    ? `<div style="font-size:12.5px;color:${MUTED};margin-top:10px">${o.staff_actions} staff actions recorded · ${o.top_actions.map(a => `${esc(a.what)} ×${a.count}`).join(' · ')}</div>` : ''
  const comp = `<div style="font-size:12.5px;color:${MUTED};margin-top:6px">Complaints: ${o.complaints.opened} opened, ${o.complaints.resolved} resolved, <span style="color:${o.complaints.open_now ? CREAM : MUTED}">${o.complaints.open_now} still open</span>.</div>`
  const away = o.away.length
    ? `<div style="font-size:12.5px;color:${MUTED};margin-top:6px">Away: ${o.away.map(a => `${esc(a.name)} (${esc(a.kind.replace(/_/g, ' '))})`).join(' · ')}</div>` : ''
  return section('The Team’s Week', 'Shift board, actions & complaints', `${board}${blocked}${actions}${comp}${away}${prose(note)}`)
}

function pressSection(d: AutoData, span: string): string {
  const p = d.press || []
  if (!p.length) return ''
  return section('In the Press', `Published ${span}`, p.map(i => `<div style="font-size:13.5px;color:${CREAM};padding:7px 0;border-top:1px solid rgba(229,212,194,0.08)">
    ${i.link ? `<a href="${esc(i.link)}" style="color:${CREAM};text-decoration:underline">${esc(i.title)}</a>` : esc(i.title)}
    ${i.outlet ? `<span style="color:${MUTED}"> · ${esc(i.outlet)}</span>` : ''}</div>`).join(''))
}

// HOW LONG IS "THIS"? A report is usually a week and says so everywhere. The
// owner sent a fortnight on 2026-09-25 — two weeks in one report — and every
// label still read "this week", which is the one thing a reader checks a
// figure against. The span decides the words; seven days reads exactly as it
// always did.
function spanWords(r: ReportRow): { it: string; prior: string; days: number } {
  const start = new Date(r.period_start + 'T00:00:00Z').getTime()
  const end = new Date(r.period_end + 'T00:00:00Z').getTime()
  const days = Math.round((end - start) / 86400000) + 1
  if (days <= 8) return { it: 'this week', prior: 'last week', days }
  if (days <= 15) return { it: 'this fortnight', prior: 'the fortnight before', days }
  return { it: 'this period', prior: 'the period before', days }
}

export function renderReportBody(r: ReportRow, mode: Mode): string {
  const d = r.auto_data
  const n = r.narrative || {}
  // One span for the whole render: "this week" on seven days, "this fortnight"
  // on fourteen. Every label below takes it rather than assuming.
  const span = spanWords(r).it
  const u = d.usage

  let html = `<div style="margin:0 0 34px">
    <img src="${site()}/images/${mode === 'email' ? 'DC500693-opt.jpg' : 'DC500693.jpg'}" alt="" width="100%" style="display:block;width:100%;border-radius:14px;border:1px solid rgba(212,184,90,0.20)"/>
    <div style="text-align:center;margin-top:22px">
      <div style="font-family:'Google Sans Code',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD}">The Rampant Club · Weekly Report</div>
      <h1 style="font-family:${SERIF};font-size:33px;color:${CREAM};font-weight:600;margin:12px 0 4px;letter-spacing:0.01em">${esc(r.headline || n.headline || 'The Week at the Club')}</h1>
      <div style="font-size:12px;color:${MUTED};letter-spacing:0.04em">${esc(d.period.label)}</div>
      <div style="width:40px;height:2px;background:${GOLD};margin:16px auto 0;opacity:0.6"></div>
    </div>
  </div>`

  // The week in three lines, then the four figures it turns on — both drafted
  // and gathered by the system, so they are there whether or not anyone typed.
  html += summaryBlock((n.summary || '').split('\n').map(s => s.trim()).filter(Boolean))
  html += `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 30px"><tr>
    ${stat(String(u.attendance ?? u.visits), 'people in', delta(d.deltas.attendance ?? d.deltas.visits))}
    ${stat(String(u.bookings), u.booked_people ? `bookings · ${u.booked_people} booked` : 'bookings')}
    ${stat(String(d.members.new_total), 'joined', delta(d.deltas.new_members))}
    ${d.money?.mtd.pct_of_target != null
      ? stat(`${d.money.mtd.pct_of_target}%`, 'of month target')
      : stat(String(d.pipeline.funnel.reduce((s, f) => s + f.count, 0)), 'in the pipeline')}
  </tr></table>`

  if (n.moment_of_week?.trim()) html += callout('Moment of the week', renderProse(n.moment_of_week))

  // Structured extras carried on the narrative jsonb.
  const nx = n as unknown as NarrativeX
  // Revenue & weekly costs P&L (leads the report — the number Shawn wants first)
  html += plTable(nx.pl)

  // Who's been in & how long — attendance + time in the club
  const memberHours = Math.round(u.total_member_minutes / 60)
  const guestHours = Math.round(u.guest_minutes / 60)
  // ── MEMBERS AND GUESTS, ON THEIR OWN LINES (2026-09-17, owner's ask) ───────
  // They are counted by different means and one line hid that. Member hours come
  // only from visits with a recorded duration — ~5h from ONE logged visit in a
  // week seven people came in — so the line carries what it is built from rather
  // than implying it is the week's total. Guests are the door log where there is
  // one, and the booking party-size estimate where there is not; the estimate
  // says so in the sentence, never dressed as a count.
  const row = (label: string, body: string) => `<div style="font-size:12.5px;color:${MUTED};margin-top:7px">
    <span style="font-family:'Google Sans Code',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};margin-right:9px">${esc(label)}</span>${body}</div>`
  const membersLine = row('Members', u.timed_visits
    ? `<span style="color:${CREAM}">~${memberHours}h</span> in the club, from ${u.timed_visits} visit${u.timed_visits === 1 ? '' : 's'} with a recorded time`
    : memberHours > 0
      ? `<span style="color:${CREAM}">~${memberHours}h</span> in the club`
      : `no visit lengths were recorded ${span}`)
  const guestsLine = (() => {
    const note = n.guests_note ? ` · ${esc(n.guests_note)}` : ''
    if (u.guest_heads > 0) return row('Guests', `<span style="color:${CREAM}">${u.guest_heads}</span> signed in${guestHours > 0 ? `, <span style="color:${CREAM}">~${guestHours}h</span> in the club` : ', no time recorded'}${note}`)
    if (u.guest_proxy > 0) return row('Guests', `none signed in at the door · <span style="color:${CREAM}">~${u.guest_proxy}</span> estimated from booking party sizes${note}`)
    return note ? row('Guests', note.slice(3)) : ''
  })()
  const attendanceLine = membersLine + guestsLine
  html += section('Who’s Been In', `Attendance & time in the club ${span}`, `
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      ${/* 2026-09-15: people who came in (taps, visits, arrived bookings, guests)
            and bookings made — the same count as the calendar's live strip. A report
            frozen before then has no attendance field and shows its visits as it did. */ ''}
      ${/* NOT THE SAME FOUR FIGURES AGAIN. People in and bookings lead the report
            in the summary row above; repeating them here two centimetres later
            made the page read as a stutter (2026-09-17). This row carries what
            that one cannot: who, how long, and how many turned up of those booked. */ ''}
      ${stat(String(u.unique_members), u.attendance != null ? 'members in' : 'unique members', delta(d.deltas.unique_members))}
      ${u.attendance != null
        ? stat(String(u.arrived), u.bookings ? `arrived of ${u.bookings}` : 'arrived')
        : stat(`${u.avg_minutes}m`, 'avg stay')}
      ${memberHours > 0
        ? stat(`${memberHours}h`, 'in the club')
        : stat(String(u.footfall_unique), 'card taps', delta(d.deltas.footfall_unique))}
      ${u.guest_heads > 0
        ? stat(String(u.guest_heads), 'guests in')
        : u.attendance != null
          ? stat(u.guest_proxy > 0 ? `~${u.guest_proxy}` : '0', u.guest_proxy > 0 ? 'guests (est.)' : 'guests')
          : stat(String(u.footfall_unique), 'footfall (taps)', delta(d.deltas.footfall_unique))}
    </tr></table>
    ${/* A WEEK IS SEVEN BARS, NOT A GRAPH. With one member in on Thursday the line
          chart drew a single dot climbing off a flat floor and read as a fault.
          The same day bars now serve both the page and the email (2026-09-17). */ ''}
    ${barsHtml(u.visits_by_day.map(x => ({ label: x.label, value: x.count })))}
    ${attendanceLine}
    ${prose(n.people)}
    ${d.member_of_week && d.member_of_week.visits >= 2 ? `<div style="font-size:13px;color:${MUTED};margin-top:6px">Member of the week: <span style="color:${CREAM}">${esc(d.member_of_week.name)}</span> — ${d.member_of_week.visits} visits.</div>` : ''}
  `)

  // MONEY SECOND, behind only who came in — the owner ranked it first of the
  // four sections, and it sat fourth behind Events (2026-09-17). Each of these
  // renders only when the week's gather found something, so an older frozen
  // report is unchanged.
  html += moneySection(d, n.money)

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
      ${/* IT SAID "0 pipeline moves" ON A WEEK THAT TOOK 8 NEW LEADS (owner,
            2026-09-25). Both were true — the 8 were creations, the moves
            counter counts stage changes only — and together they read as a
            contradiction. The tile now says what it counts. */''}
      ${stat(String(d.pipeline.movements.stage_changed || 0), 'moved a stage')}
      ${stat(`${d.pipeline.conversion_pct}%`, 'lead→member')}
    </tr></table>
    ${/* TWO CHARTS, TWO HEADINGS. Rendered as bars they ran into each other,
          so a tier ("Legacy 1") sat in the list of pipeline stages and read
          like one. */''}
    ${tierSegs.length ? `<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${MUTED};margin:14px 0 6px">Who joined, by tier</div>` : ''}
    ${tierSegs.length ? chartBlock(mode, donut(tierSegs, 'dark'), barsHtml(tierSegs.map(t => ({ label: t.label, value: t.value })))) : ''}
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${MUTED};margin:14px 0 6px">The pipeline</div>
    ${chartBlock(mode, funnel(d.pipeline.funnel, 'dark'), barsHtml(d.pipeline.funnel.map(f => ({ label: f.stage, value: f.count }))))}
    ${(d.pipeline.off_funnel || []).length ? `<div style="font-size:12.5px;color:${MUTED};margin-top:6px">Also on file, off the funnel: ${d.pipeline.off_funnel!.map(o => `${o.count} ${esc(o.stage.toLowerCase())}`).join(' · ')}.</div>` : ''}
    ${(d.pipeline.interviews || []).length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">Interviews this week: ${d.pipeline.interviews.map(i => `${esc(i.name)}${i.interviewer ? ` (with ${esc(i.interviewer)})` : ''}`).join(' · ')}</div>` : ''}
    ${(d.pipeline.onboarded || []).length ? `<div style="font-size:13px;color:${CREAM};margin-top:8px">Joined this week: ${d.pipeline.onboarded!.map(o => `${esc(o.name)} <span style="color:${MUTED}">(${esc(o.tier)})</span>`).join(' · ')}</div>` : ''}
    ${d.pipeline.new_leads ? `<div style="font-size:13px;color:${MUTED};margin-top:6px">${d.pipeline.new_leads} new lead${d.pipeline.new_leads === 1 ? '' : 's'} entered the pipeline.</div>` : ''}
    ${prose(n.members)}
    ${n.interviews_commentary?.trim() ? `<div style="font-size:14px;line-height:1.7;color:${CREAM};margin-top:10px;white-space:pre-wrap">${renderProse(n.interviews_commentary)}</div>` : ''}
  `)

  // The team's week sits with the people sections, not adrift after the press.
  html += opsSection(d, span, n.operations)
  html += pressSection(d, span)

  html += narrative('Marketing Initiatives', n.marketing)
  html += narrative('Cost-Cutting', n.cost_cutting)
  html += cardsSection('Team & Operations', 'The changes in place now', nx.ops)
  html += cardsSection('Whisky Retail · Quy & Tai', 'Low-cost, high-visibility improvements', nx.retail)
  html += narrative('Successes', n.successes)
  html += momentumSection(nx.momentum, span)
  html += actionsSection(nx.actions)

  // Financials
  if (r.include_financials && r.financials && 'total_revenue' in r.financials) {
    const f = r.financials as Financials
    const momGroups = f.mom.map(m => ({ label: m.label, parts: { Membership: m.membership, 'Card top-ups': m.card_topups, Gifting: m.gifting } }))
    const momBars = f.mom.map(m => ({ label: m.label, value: Math.round((m.membership + m.card_topups) / 1_000_000), suffix: 'M' }))
    html += section(`Financials · ${esc(f.month_label)}`, 'The whole month to date, and the six-month trend', `
      <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
        ${stat(vnd(f.total_revenue), 'total revenue', f.delta_pct != null ? delta(f.delta_pct) : '')}
        ${stat(vnd(f.membership.total), `membership · ${f.membership.count}`)}
        ${stat(vnd(f.card.topups), 'top-ups · month')}
        ${stat(vnd(f.gifting.total), 'gifting spend')}
      </tr></table>
      ${chartBlock(mode, stackedBars(momGroups, ['Membership', 'Card top-ups', 'Gifting'], 'dark'), barsHtml(momBars))}
    `)
  }

  // IT HAD NO HEADING (owner, 2026-09-25: "Closing note on the preview doesnt
  // have a title above it"). Every other block on the page announces itself
  // and this one simply began — a paragraph in italics after the financials,
  // which reads as a stray note rather than the owner's own last word. It gets
  // the same rule, eyebrow and subtitle as the rest.
  //
  // AND IT CARRIES NO BYLINE (owner, 2026-09-25: "Closing note is from me, not
  // the GM", then "It shouldnt say from the owner at all. Just say closing
  // note"). It went out saying From the General Manager, which put someone
  // else's name to the one paragraph on the page written in the first person.
  // The heading alone is the whole label: the report is the owner's, so saying
  // so under the last section only raises the question.
  if (n.closing_note?.trim()) {
    html += section('Closing Note', '',
      `<div style="font-size:14px;line-height:1.75;color:${CREAM};font-style:italic;white-space:pre-wrap">${renderProse(n.closing_note)}</div>`)
  }
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
