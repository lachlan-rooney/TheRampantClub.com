import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────
// Branded membership-receipt PDF. Pure: fields in → PDF bytes out.
// Adapted from app/api/sign/route.ts (the signed-agreement generator), which
// established the club's pdf-lib palette + layout language. pdf-lib can embed
// PNG/JPG only (not SVG), so the crest is the 4KB lion-signature-opt.png.
// ─────────────────────────────────────────────────────────────────────────

export interface ReceiptFields {
  receiptNo: string
  memberName: string
  memberNo: string
  tier?: string | null
  amountVnd: number
  paymentMethod: string
  paymentDate: string      // YYYY-MM-DD
  feeKind: string
  periodStart?: string | null  // YYYY-MM-DD
  periodEnd?: string | null    // YYYY-MM-DD (paid-through, inclusive)
  integrityHash: string
}

const GREEN = rgb(0.02, 0.18, 0.125)   // #052E20
const CREAM = rgb(0.90, 0.83, 0.76)    // #E5D4C2
const CREAM_BG = rgb(0.98, 0.96, 0.93)
const GOLD = rgb(0.83, 0.72, 0.35)     // #D4B85A
const MUTED = rgb(0.5, 0.48, 0.42)
const LIGHT = rgb(0.75, 0.72, 0.65)

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  card_offline: 'Card',
  other: 'Other',
}
const FEE_LABEL: Record<string, string> = {
  membership_fee: 'Annual Membership Fee',
  renewal: 'Membership Renewal',
  joining_fee: 'Joining Fee',
  proration: 'Pro-rata Membership',
  adjustment: 'Adjustment',
}

// Strip non-WinAnsi characters for the PDF standard fonts (same as sign route).
function pdfSafe(str: string): string {
  return (str ?? '').replace(/[^\x00-\xFF]/g, '?')
}

// The PDF standard fonts are WinAnsi only — the ₫ glyph would render as '?',
// so receipts spell the currency as "VND". (Web + email use ₫ freely.)
function fmtVnd(n: number): string {
  return new Intl.NumberFormat('en-US').format(n) + ' VND'
}

// The crest must load at runtime on Vercel, where public/ files are NOT
// reliably readable via fs. Prefer an HTTP fetch of the deployed asset; fall
// back to the local filesystem (works in dev). Optional — skipped on failure.
async function loadCrest(crestUrl?: string): Promise<Uint8Array | null> {
  if (crestUrl) {
    try {
      const r = await fetch(crestUrl)
      if (r.ok) return new Uint8Array(await r.arrayBuffer())
    } catch { /* fall through */ }
  }
  try {
    return new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'public/images/lion-signature-opt.png')))
  } catch { return null }
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function generateReceiptPdf(f: ReceiptFields, opts?: { crestUrl?: string }): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Background
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: CREAM_BG })

  // Header bar
  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: GREEN })
  page.drawText('THE RAMPANT CLUB', { x: 50, y: 812, size: 17, font: fontBold, color: CREAM })
  page.drawText('OFFICIAL RECEIPT', { x: 50, y: 796, size: 8, font, color: rgb(0.7, 0.67, 0.6) })

  // Crest, right side of header
  try {
    const lionBytes = await loadCrest(opts?.crestUrl)
    if (lionBytes) {
      const lion = await pdfDoc.embedPng(lionBytes)
      const scaled = lion.scaleToFit(46, 46)
      page.drawImage(lion, { x: 545 - scaled.width, y: 790, width: scaled.width, height: scaled.height })
    }
  } catch { /* crest optional */ }

  // Gold rule under header
  page.drawRectangle({ x: 0, y: 779, width: 595, height: 2, color: GOLD })

  // Receipt meta (no. + issued date)
  let y = 748
  page.drawText('RECEIPT NO.', { x: 50, y, size: 7, font, color: MUTED })
  page.drawText(pdfSafe(f.receiptNo), { x: 50, y: y - 13, size: 13, font: fontBold, color: GREEN })
  page.drawText('DATE ISSUED', { x: 400, y, size: 7, font, color: MUTED })
  page.drawText(pdfSafe(fmtDate(f.paymentDate)), { x: 400, y: y - 13, size: 13, font: fontBold, color: GREEN })

  // Received-from block
  y -= 48
  page.drawText('RECEIVED WITH THANKS FROM', { x: 50, y, size: 8, font: fontBold, color: MUTED })
  page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 0.3, color: LIGHT })
  y -= 24
  page.drawText(pdfSafe(f.memberName), { x: 50, y, size: 16, font: fontBold, color: GREEN })
  y -= 16
  const noLabel = `Member No. ${f.memberNo.replace(/^TRC-M/i, '')}` + (f.tier ? `   ·   ${f.tier} Member` : '')
  page.drawText(pdfSafe(noLabel), { x: 50, y, size: 9, font, color: MUTED })

  // Amount box (prominent)
  y -= 42
  page.drawRectangle({ x: 50, y: y - 30, width: 495, height: 58, color: GREEN })
  page.drawText('AMOUNT PAID', { x: 68, y: y + 8, size: 8, font, color: rgb(0.7, 0.67, 0.6) })
  page.drawText(pdfSafe(fmtVnd(f.amountVnd)), { x: 68, y: y - 18, size: 24, font: fontBold, color: CREAM })
  page.drawText(pdfSafe(FEE_LABEL[f.feeKind] || f.feeKind), { x: 545 - 18 - fontItalic.widthOfTextAtSize(pdfSafe(FEE_LABEL[f.feeKind] || f.feeKind), 10), y: y - 6, size: 10, font: fontItalic, color: GOLD })

  // Details
  y -= 62
  page.drawText('PAYMENT DETAILS', { x: 50, y, size: 8, font: fontBold, color: MUTED })
  page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 0.3, color: LIGHT })
  y -= 22
  const rows: [string, string][] = [
    ['Payment Method', METHOD_LABEL[f.paymentMethod] || f.paymentMethod],
    ['Payment Date', fmtDate(f.paymentDate)],
  ]
  const col1 = 50, col2 = 310
  for (let i = 0; i < rows.length; i += 2) {
    page.drawText(pdfSafe(rows[i][0]), { x: col1, y, size: 7, font, color: MUTED })
    page.drawText(pdfSafe(rows[i][1]), { x: col1, y: y - 12, size: 10, font: fontBold, color: GREEN })
    if (i + 1 < rows.length) {
      page.drawText(pdfSafe(rows[i + 1][0]), { x: col2, y, size: 7, font, color: MUTED })
      page.drawText(pdfSafe(rows[i + 1][1]), { x: col2, y: y - 12, size: 10, font: fontBold, color: GREEN })
    }
    y -= 32
  }

  // Membership period covered
  if (f.periodStart && f.periodEnd) {
    y -= 6
    page.drawText('MEMBERSHIP PERIOD COVERED', { x: 50, y, size: 8, font: fontBold, color: MUTED })
    page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 0.3, color: LIGHT })
    y -= 24
    page.drawText(pdfSafe(`${fmtDate(f.periodStart)}  —  ${fmtDate(f.periodEnd)}`), { x: 50, y, size: 12, font: fontBold, color: GREEN })
    y -= 14
    page.drawText(pdfSafe(`Membership is active and paid through ${fmtDate(f.periodEnd)}.`), { x: 50, y, size: 8, font: fontItalic, color: MUTED })
    y -= 8
  }

  // Verification stamp
  y -= 26
  page.drawText('VERIFICATION', { x: 50, y, size: 7, font, color: MUTED })
  page.drawText(pdfSafe(`${f.receiptNo} · ${f.integrityHash.slice(0, 16).toUpperCase()}`), {
    x: 50, y: y - 12, size: 8, font, color: LIGHT,
  })
  page.drawText('Verify this receipt at therampantclub.com/verify', { x: 50, y: y - 24, size: 7, font: fontItalic, color: LIGHT })

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 46, color: GREEN })
  page.drawText('THE RAMPANT CLUB', { x: 50, y: 24, size: 8, font: fontBold, color: rgb(0.7, 0.67, 0.6) })
  page.drawText('74A2 Hai Ba Trung, District 1, Ho Chi Minh City  |  Membership@TheRampantClub.com', {
    x: 50, y: 13, size: 6, font, color: rgb(0.5, 0.48, 0.42),
  })

  return await pdfDoc.save()
}
