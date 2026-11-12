import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { readTicket } from '@/lib/popup/ticket'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// THE QR, AS A REAL IMAGE.
// ───────────────────────────────────────────────────────────────────────────
// ⚠ IT WAS A data: URI AND GMAIL SHOWED NOTHING. Tested in a real Gmail
// inbox on 13 Nov: the email arrived with "Show this at the door" and no
// picture at all, because Gmail strips inline data-URI images entirely. A
// guest would have turned up with no QR and the door would have slowed to the
// name list.
//
// So the QR is served from our own domain, as a PNG, at an unguessable URL —
// which is what every mail client, and Gmail's image proxy in particular, can
// actually fetch and cache.
//
// ══ WHY SERVING IT IS NOT A LEAK ═════════════════════════════════════════
// The URL carries the SIGNED ticket token and nothing else: no name, no email,
// no session. Somebody who has the token already has the ticket, so a picture
// of it tells them nothing new. An invented token is refused by the signature
// before any image is drawn — readTicket() checks the HMAC, and a bare code
// with no signature is refused HERE even though the door accepts one typed by
// staff, because a guessed URL must not become a scannable pass.
//
// Cached hard: the image for a given token never changes, and Gmail's proxy
// will ask for it once and serve it to that reader forever.
// ═══════════════════════════════════════════════════════════════════════════

const SIZE = 600

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const raw = decodeURIComponent(token || '').replace(/\.png$/i, '')

  // The slug the token was signed against. Both evenings' tickets are served,
  // and a token signed for one cannot be read as the other.
  const slugs = [process.env.POPUP_SLUG || 'palace-2026-11-13', 'palace-practice']
  let ok: { code: string; signed: boolean } | null = null
  let forSlug = ''
  for (const s of slugs) {
    const t = readTicket(s, raw)
    if (t?.signed) { ok = t; forSlug = s; break }
  }

  // ⚠ A BARE CODE IS REFUSED HERE. Staff may type eight characters at the
  // door; nobody may turn eight characters into a working QR by guessing a URL.
  if (!ok) return new NextResponse('Not found', { status: 404 })

  const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'}/popup/t/${raw}`
  const png = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    margin: 2,                 // a quiet zone, or a scanner will not lock on
    width: SIZE,
    color: { dark: '#052E20', light: '#FFFFFF' },   // the club's green on white
  })

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      // Immutable: this token's picture is the same picture forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  })
}
