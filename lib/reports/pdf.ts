import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import type { ReportRow } from './render'
import type { Financials } from './financials'

// Branded report PDF (dark, matches the email + hosted page). Charts are drawn
// as native pdf-lib vector bars — no image rasterisation (no sharp), so it works
// anywhere. Attached to the report email.

const GREEN = rgb(0.02, 0.18, 0.125)
const CREAM = rgb(0.90, 0.83, 0.76)
const GOLD = rgb(0.83, 0.72, 0.35)
const MUTED = rgb(0.70, 0.67, 0.60)
const SERIES = [rgb(0.83, 0.72, 0.35), rgb(0.48, 0.69, 0.48), rgb(0.37, 0.40, 0.31), rgb(0.76, 0.44, 0.44), rgb(0.90, 0.56, 0.29)]
const W = 595, H = 842, M = 50
const pdfSafe = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, '?')
const vnd = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n)) + ' VND'

export async function generateReportPdf(r: ReportRow): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const d = r.auto_data
  const n = r.narrative || {}

  let page: PDFPage = doc.addPage([W, H])
  let y = 0
  const bg = (p: PDFPage) => p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: GREEN })
  bg(page)
  const newPage = () => { page = doc.addPage([W, H]); bg(page); y = H - M }

  // Header
  page.drawRectangle({ x: 0, y: H - 66, width: W, height: 66, color: rgb(0.04, 0.21, 0.15) })
  page.drawText('THE RAMPANT CLUB', { x: M, y: H - 34, size: 15, font: bold, color: CREAM })
  page.drawText('WEEKLY EXECUTIVE REPORT', { x: M, y: H - 50, size: 8, font, color: MUTED })
  page.drawRectangle({ x: 0, y: H - 68, width: W, height: 2, color: GOLD })
  y = H - 92

  page.drawText(pdfSafe(r.headline || 'The Week at the Club'), { x: M, y, size: 20, font: bold, color: CREAM }); y -= 18
  page.drawText(pdfSafe(d.period.label), { x: M, y, size: 10, font: italic, color: MUTED }); y -= 26

  const stats: [string, string][] = [
    [String(d.usage.visits), 'VISITS'], [String(d.usage.unique_members), 'MEMBERS'],
    [String(d.members.new_total), 'NEW'], [String(d.pipeline.signed), 'SIGNED'],
  ]
  stats.forEach(([v, l], i) => {
    const x = M + i * 128
    page.drawText(v, { x, y: y - 20, size: 26, font: bold, color: GOLD })
    page.drawText(l, { x, y: y - 32, size: 8, font, color: MUTED })
  })
  y -= 58

  const ensure = (need: number) => { if (y - need < M + 24) newPage() }
  const heading = (t: string) => { ensure(40); page.drawText(pdfSafe(t.toUpperCase()), { x: M, y, size: 9, font: bold, color: GOLD }); y -= 4; page.drawRectangle({ x: M, y, width: W - 2 * M, height: 0.5, color: rgb(0.4, 0.45, 0.4) }); y -= 16 }

  const drawBars = (rows: { label: string; value: number; max?: number | null; suffix?: string }[]) => {
    if (!rows.length) return
    const max = Math.max(...rows.map(x => x.max || x.value), 1)
    const labelW = 130, barX = M + labelW, barW = W - 2 * M - labelW - 44
    for (let i = 0; i < rows.length; i++) {
      ensure(18)
      const row = rows[i]
      page.drawText(pdfSafe(row.label).slice(0, 24), { x: M, y: y - 9, size: 9, font, color: CREAM })
      page.drawRectangle({ x: barX, y: y - 11, width: barW, height: 9, color: rgb(0.1, 0.24, 0.18) })
      page.drawRectangle({ x: barX, y: y - 11, width: Math.max(2, (row.value / max) * barW), height: 9, color: SERIES[i % SERIES.length] })
      page.drawText(`${row.value}${row.suffix || (row.max ? '/' + row.max : '')}`, { x: barX + barW + 6, y: y - 9, size: 8, font, color: MUTED })
      y -= 16
    }
    y -= 8
  }

  const wrapText = (text: string, size = 10, color: RGB = CREAM, f: PDFFont = font) => {
    const maxW = W - 2 * M
    // Markdown links → "label (url)" (a PDF can't carry a live link inline here).
    const flat = pdfSafe(text).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    for (const para of flat.split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/)) {
        const test = line ? line + ' ' + word : word
        if (f.widthOfTextAtSize(test, size) > maxW && line) {
          ensure(size + 4); page.drawText(line, { x: M, y, size, font: f, color }); y -= size + 4; line = word
        } else line = test
      }
      if (line) { ensure(size + 4); page.drawText(line, { x: M, y, size, font: f, color }); y -= size + 4 }
      y -= 4
    }
  }

  heading('Club Usage — visits by day')
  drawBars(d.usage.visits_by_day.map(x => ({ label: x.label, value: x.count })))

  heading('Pipeline')
  drawBars(d.pipeline.funnel.map(f => ({ label: f.stage, value: f.count })))

  if (r.include_financials && r.financials && 'total_revenue' in r.financials) {
    const f = r.financials as Financials
    heading(`Financials — ${f.month_label}`)
    wrapText(`Total revenue ${vnd(f.total_revenue)}  ·  Membership ${vnd(f.membership.total)}  ·  Card top-ups ${vnd(f.card.topups)}  ·  Gifting ${vnd(f.gifting.total)}`, 10, MUTED)
    drawBars(f.mom.map(m => ({ label: m.label, value: Math.round((m.membership + m.card_topups) / 1_000_000), suffix: 'M' })))
  }

  for (const [key, title] of [['marketing', 'Marketing Initiatives'], ['cost_cutting', 'Cost-Cutting'], ['successes', 'Successes']] as const) {
    if (n[key]?.trim()) { heading(title); wrapText(n[key]) }
  }

  page.drawRectangle({ x: 0, y: 0, width: W, height: 30, color: rgb(0.04, 0.21, 0.15) })
  page.drawText('The Rampant Club  ·  74A2 Hai Ba Trung, District 1, Ho Chi Minh City', { x: M, y: 11, size: 7, font, color: MUTED })

  return await doc.save()
}
