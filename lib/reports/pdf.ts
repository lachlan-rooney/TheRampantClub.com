import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from 'pdf-lib'
import type { ReportRow } from './render'
import type { Financials } from './financials'

// Branded report PDF (dark, matches the email + hosted page). Embeds the
// already-rendered dark chart PNGs from chart_urls. Attached to the Shawn email.

const GREEN = rgb(0.02, 0.18, 0.125)
const CREAM = rgb(0.90, 0.83, 0.76)
const GOLD = rgb(0.83, 0.72, 0.35)
const MUTED = rgb(0.70, 0.67, 0.60)
const W = 595, H = 842, M = 50
const pdfSafe = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, '?')
const vnd = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n)) + ' VND'

async function embedChart(doc: PDFDocument, url?: string): Promise<{ png: import('pdf-lib').PDFImage; w: number; h: number } | null> {
  if (!url) return null
  try {
    const r = await fetch(url); if (!r.ok) return null
    const png = await doc.embedPng(new Uint8Array(await r.arrayBuffer()))
    return { png, w: png.width, h: png.height }
  } catch { return null }
}

export async function generateReportPdf(r: ReportRow, chartUrls: Record<string, string>): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const d = r.auto_data
  const n = r.narrative || {}

  let page = doc.addPage([W, H])
  let y = H
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

  // Stats row
  const stats: [string, string][] = [
    [String(d.usage.visits), 'VISITS'],
    [String(d.usage.unique_members), 'MEMBERS'],
    [String(d.members.new_total), 'NEW'],
    [String(d.pipeline.signed), 'SIGNED'],
  ]
  stats.forEach(([v, l], i) => {
    const x = M + i * 128
    page.drawText(v, { x, y: y - 20, size: 26, font: bold, color: GOLD })
    page.drawText(l, { x, y: y - 32, size: 8, font, color: MUTED })
  })
  y -= 56

  const drawChart = async (key: string, maxH = 150) => {
    const c = await embedChart(doc, chartUrls[key])
    if (!c) return
    const cw = W - 2 * M
    const ch = Math.min(maxH, (c.h / c.w) * cw)
    if (y - ch < M + 20) newPage()
    page.drawImage(c.png, { x: M, y: y - ch, width: cw, height: ch }); y -= ch + 16
  }

  const heading = (t: string) => { if (y < M + 60) newPage(); page.drawText(pdfSafe(t.toUpperCase()), { x: M, y, size: 9, font: bold, color: GOLD }); y -= 4; page.drawRectangle({ x: M, y, width: W - 2 * M, height: 0.5, color: rgb(0.4, 0.45, 0.4) }); y -= 14 }

  const wrapText = (text: string, size = 10, color = CREAM, f: PDFFont = font) => {
    const maxW = W - 2 * M
    for (const para of pdfSafe(text).split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/)) {
        const test = line ? line + ' ' + word : word
        if (f.widthOfTextAtSize(test, size) > maxW && line) {
          if (y < M + 16) newPage()
          page.drawText(line, { x: M, y, size, font: f, color }); y -= size + 4
          line = word
        } else line = test
      }
      if (line) { if (y < M + 16) newPage(); page.drawText(line, { x: M, y, size, font: f, color }); y -= size + 4 }
      y -= 4
    }
  }

  heading('Club Usage'); await drawChart('visits', 150)
  heading('Pipeline'); await drawChart('funnel', 160)
  if (r.include_financials && r.financials && 'total_revenue' in r.financials) {
    const f = r.financials as Financials
    heading(`Financials — ${f.month_label}`)
    wrapText(`Total revenue ${vnd(f.total_revenue)}  ·  Membership ${vnd(f.membership.total)}  ·  Card top-ups ${vnd(f.card.topups)}  ·  Gifting ${vnd(f.gifting.total)}`, 10, MUTED)
    await drawChart('financials', 170)
  }

  for (const [key, title] of [['marketing', 'Marketing Initiatives'], ['cost_cutting', 'Cost-Cutting'], ['successes', 'Successes']] as const) {
    if (n[key]?.trim()) { heading(title); wrapText(n[key]) }
  }

  // Footer on the last page
  page.drawRectangle({ x: 0, y: 0, width: W, height: 30, color: rgb(0.04, 0.21, 0.15) })
  page.drawText('The Rampant Club  ·  74A2 Hai Ba Trung, District 1, Ho Chi Minh City', { x: M, y: 11, size: 7, font, color: MUTED })

  return await doc.save()
}
