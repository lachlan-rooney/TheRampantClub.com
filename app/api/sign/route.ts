import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Strip non-WinAnsi characters for PDF standard fonts
function pdfSafe(str: string): string {
  return str.replace(/[^\x00-\xFF]/g, '?')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      token, fullName, email, mobile, profession, referredBy,
      category, dateOfBirth, nationality, homeAddress, companyName,
      signatureDataUrl, signatureMethod, typedName, declarations,
    } = body

    // 1. Validate the token
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('signing_invitations')
      .select('id, status')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
    }

    // 2. Generate signed PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const green = rgb(0.02, 0.18, 0.125)

    // Header
    page.drawText('THE RAMPANT CLUB', {
      x: 50, y: 780, size: 18, font: fontBold, color: green,
    })
    page.drawText('Membership Agreement - Signed Copy', {
      x: 50, y: 760, size: 11, font, color: green,
    })

    // Line
    page.drawLine({
      start: { x: 50, y: 750 },
      end: { x: 545, y: 750 },
      thickness: 0.5,
      color: rgb(0.7, 0.67, 0.6),
    })

    // Member details
    const details = [
      ['Full Name', fullName],
      ['Email', email],
      ['Mobile', mobile],
      ['Date of Birth', dateOfBirth || '—'],
      ['Nationality', nationality || '—'],
      ['Home Address', homeAddress || '—'],
      ['Company', companyName || '—'],
      ['Profession', profession || '—'],
      ['Referred By', referredBy || '—'],
      ['Category', category ? category.charAt(0).toUpperCase() + category.slice(1) : '—'],
      ['Signed At', new Date().toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })],
      ['Method', signatureMethod === 'type' ? `Typed: ${typedName}` : 'Drawn'],
    ]

    let yPos = 720
    for (const [label, value] of details) {
      page.drawText(`${label}:`, { x: 50, y: yPos, size: 10, font: fontBold, color: green })
      page.drawText(pdfSafe(String(value)), { x: 180, y: yPos, size: 10, font, color: green })
      yPos -= 20
    }

    // Declarations
    yPos -= 20
    page.drawText('Declarations:', { x: 50, y: yPos, size: 10, font: fontBold, color: green })
    yPos -= 18
    for (const d of declarations) {
      page.drawText(`[x] Declaration ${d.index + 1}: Accepted`, { x: 70, y: yPos, size: 9, font, color: green })
      yPos -= 16
    }

    // Embed signature
    if (signatureDataUrl) {
      try {
        const sigBytes = Uint8Array.from(
          atob(signatureDataUrl.split(',')[1]),
          (c) => c.charCodeAt(0)
        )
        const sigImage = await pdfDoc.embedPng(sigBytes)
        const sigDims = sigImage.scale(0.35)
        yPos -= 20
        page.drawText('Signature:', { x: 50, y: yPos, size: 10, font: fontBold, color: green })
        yPos -= sigDims.height + 10
        page.drawImage(sigImage, {
          x: 50, y: yPos,
          width: sigDims.width, height: sigDims.height,
        })
      } catch {
        // signature embed failed, continue without
      }
    }

    // Footer
    page.drawLine({
      start: { x: 50, y: 60 },
      end: { x: 545, y: 60 },
      thickness: 0.5,
      color: rgb(0.7, 0.67, 0.6),
    })
    page.drawText('74A2 Hai Ba Trung, District 1, Ho Chi Minh City  |  Membership@TheRampantClub.com', {
      x: 50, y: 45, size: 7, font, color: rgb(0.5, 0.5, 0.5),
    })

    const pdfBytes = await pdfDoc.save()

    // 3. Upload PDF to Supabase Storage
    const fileName = `${token}_${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('signed-agreements')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf' })

    if (uploadError) {
      console.error('PDF upload error:', uploadError)
    }

    // 4. Store the signed record
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'

    await supabaseAdmin.from('signed_agreements').insert({
      invitation_id: invitation.id,
      full_name: fullName,
      email,
      mobile,
      date_of_birth: dateOfBirth,
      nationality,
      home_address: homeAddress,
      company_name: companyName,
      profession,
      referred_by: referredBy,
      category,
      signature_method: signatureMethod,
      typed_name: typedName,
      signature_data_url: signatureDataUrl,
      signed_pdf_url: fileName,
      declarations,
      ip_address: ip,
      user_agent: ua,
    })

    // 5. Mark invitation as signed
    await supabaseAdmin
      .from('signing_invitations')
      .update({ status: 'signed' })
      .eq('id', invitation.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Signing error:', err)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
