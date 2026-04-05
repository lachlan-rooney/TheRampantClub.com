import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    const green = rgb(0.02, 0.18, 0.125)
    const muted = rgb(0.5, 0.48, 0.42)
    const light = rgb(0.75, 0.72, 0.65)

    // Background tint
    page.drawRectangle({
      x: 0, y: 0, width: 595, height: 842,
      color: rgb(0.98, 0.96, 0.93),
    })

    // Header block
    page.drawRectangle({
      x: 0, y: 790, width: 595, height: 52,
      color: green,
    })
    page.drawText('THE RAMPANT CLUB', {
      x: 50, y: 808, size: 16, font: fontBold, color: rgb(0.9, 0.83, 0.76),
    })
    page.drawText('MEMBERSHIP AGREEMENT', {
      x: 50, y: 795, size: 8, font, color: rgb(0.7, 0.67, 0.6),
    })
    page.drawText('Signed Copy', {
      x: 480, y: 800, size: 9, font: fontItalic, color: rgb(0.7, 0.67, 0.6),
    })

    // Diamond separator
    page.drawLine({ start: { x: 294, y: 773 }, end: { x: 297.5, y: 777 }, thickness: 0.5, color: light })
    page.drawLine({ start: { x: 297.5, y: 777 }, end: { x: 301, y: 773 }, thickness: 0.5, color: light })
    page.drawLine({ start: { x: 301, y: 773 }, end: { x: 297.5, y: 769 }, thickness: 0.5, color: light })
    page.drawLine({ start: { x: 297.5, y: 769 }, end: { x: 294, y: 773 }, thickness: 0.5, color: light })

    // Member details section
    let yPos = 750
    page.drawText('MEMBER DETAILS', {
      x: 50, y: yPos, size: 8, font: fontBold, color: muted,
    })
    page.drawLine({ start: { x: 50, y: yPos - 5 }, end: { x: 545, y: yPos - 5 }, thickness: 0.3, color: light })
    yPos -= 22

    const details = [
      ['Full Name', fullName],
      ['Email', email],
      ['Mobile', mobile],
      ['Date of Birth', dateOfBirth || ''],
      ['Nationality', nationality || ''],
      ['Home Address', homeAddress || ''],
      ['Company', companyName || ''],
      ['Profession', profession || ''],
      ['Referred By', referredBy || ''],
      ['Category', category ? category.charAt(0).toUpperCase() + category.slice(1) + ' Membership' : ''],
    ]

    // Two-column layout
    const col1x = 50, col2x = 310
    for (let i = 0; i < details.length; i += 2) {
      const [l1, v1] = details[i]
      page.drawText(pdfSafe(l1), { x: col1x, y: yPos, size: 7, font, color: muted })
      page.drawText(pdfSafe(String(v1)), { x: col1x, y: yPos - 12, size: 10, font: fontBold, color: green })

      if (i + 1 < details.length) {
        const [l2, v2] = details[i + 1]
        page.drawText(pdfSafe(l2), { x: col2x, y: yPos, size: 7, font, color: muted })
        page.drawText(pdfSafe(String(v2)), { x: col2x, y: yPos - 12, size: 10, font: fontBold, color: green })
      }
      yPos -= 32
    }

    // Declarations section
    yPos -= 10
    page.drawText('DECLARATIONS', {
      x: 50, y: yPos, size: 8, font: fontBold, color: muted,
    })
    page.drawLine({ start: { x: 50, y: yPos - 5 }, end: { x: 545, y: yPos - 5 }, thickness: 0.3, color: light })
    yPos -= 22

    const declTexts = [
      'Read and understood the Club ethos and principles',
      'Accepts annual dues and applicable joining fee',
      'Understands membership is not guaranteed',
    ]
    for (let i = 0; i < declarations.length; i++) {
      page.drawRectangle({ x: 52, y: yPos - 2, width: 10, height: 10, borderColor: green, borderWidth: 0.5, color: rgb(0.94, 0.92, 0.88) })
      page.drawText('x', { x: 54.5, y: yPos, size: 8, font: fontBold, color: green })
      page.drawText(declTexts[i] || `Declaration ${i + 1}`, { x: 70, y: yPos, size: 9, font, color: green })
      yPos -= 18
    }

    // Terms accepted
    yPos -= 8
    page.drawRectangle({ x: 52, y: yPos - 2, width: 10, height: 10, borderColor: green, borderWidth: 0.5, color: rgb(0.94, 0.92, 0.88) })
    page.drawText('x', { x: 54.5, y: yPos, size: 8, font: fontBold, color: green })
    page.drawText('Accepted the Terms and Conditions of Membership', { x: 70, y: yPos, size: 9, font, color: green })

    // Signature section
    yPos -= 40
    page.drawText('SIGNATURE', {
      x: 50, y: yPos, size: 8, font: fontBold, color: muted,
    })
    page.drawLine({ start: { x: 50, y: yPos - 5 }, end: { x: 545, y: yPos - 5 }, thickness: 0.3, color: light })
    yPos -= 20

    if (signatureDataUrl) {
      try {
        const sigBytes = Uint8Array.from(
          atob(signatureDataUrl.split(',')[1]),
          (c) => c.charCodeAt(0)
        )
        const sigImage = await pdfDoc.embedPng(sigBytes)
        const sigDims = sigImage.scale(0.4)
        page.drawImage(sigImage, {
          x: 50, y: yPos - sigDims.height,
          width: sigDims.width, height: sigDims.height,
        })
        yPos -= sigDims.height + 10
      } catch {
        // signature embed failed
      }
    }

    if (signatureMethod === 'type' && typedName) {
      page.drawText(`Typed: ${pdfSafe(typedName)}`, { x: 50, y: yPos, size: 9, font: fontItalic, color: muted })
      yPos -= 16
    }

    // Timestamp
    yPos -= 10
    const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })
    page.drawText(`Signed: ${timestamp} (GMT+7)`, { x: 50, y: yPos, size: 8, font, color: muted })

    // Footer
    page.drawRectangle({
      x: 0, y: 0, width: 595, height: 45,
      color: green,
    })
    page.drawText('THE RAMPANT CLUB', {
      x: 50, y: 22, size: 8, font: fontBold, color: rgb(0.7, 0.67, 0.6),
    })
    page.drawText('74A2 Hai Ba Trung, District 1, Ho Chi Minh City  |  Membership@TheRampantClub.com', {
      x: 50, y: 12, size: 6, font, color: rgb(0.5, 0.48, 0.42),
    })

    const pdfBytes = await pdfDoc.save()

    // 3. Upload PDF to Supabase Storage
    const fileName = `${token}_${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('signed_agreements')
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

    // 6. Send email copies with signed PDF
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const pdfBuffer = Buffer.from(pdfBytes)
        const attachment = {
          filename: `TRC_Membership_Agreement_${pdfSafe(fullName).replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
        }

        // Email to the signee
        await resend.emails.send({
          from: 'The Rampant Club <membership@therampantclub.com>',
          to: email,
          subject: 'Your Signed Membership Agreement - The Rampant Club',
          html: `
            <div style="font-family: Helvetica, Arial, sans-serif; color: #052E20; max-width: 500px;">
              <h2 style="font-size: 18px; font-weight: 500; letter-spacing: 0.04em;">THE RAMPANT CLUB</h2>
              <p style="font-size: 13px; color: #5E6650; line-height: 1.7;">
                Dear ${pdfSafe(fullName)},<br><br>
                Thank you for signing your Membership Agreement. Please find a copy attached for your records.<br><br>
                The Committee will review your application and be in touch shortly.<br><br>
                Warm regards,<br>
                <em>The Rampant Club</em>
              </p>
              <hr style="border: none; border-top: 1px solid #E5D4C2; margin: 24px 0;" />
              <p style="font-size: 10px; color: #B2AA98;">
                74A2 Hai Ba Trung, District 1, Ho Chi Minh City<br>
                Membership@TheRampantClub.com
              </p>
            </div>
          `,
          attachments: [attachment],
        })

        // Email to the club
        await resend.emails.send({
          from: 'The Rampant Club <membership@therampantclub.com>',
          to: 'membership@therampantclub.com',
          subject: `New Signed Agreement: ${pdfSafe(fullName)} (${category})`,
          html: `
            <div style="font-family: Helvetica, Arial, sans-serif; color: #052E20; max-width: 500px;">
              <h2 style="font-size: 18px; font-weight: 500;">New Membership Agreement Signed</h2>
              <p style="font-size: 13px; color: #5E6650; line-height: 1.7;">
                <strong>${pdfSafe(fullName)}</strong> has signed their membership agreement.<br><br>
                <strong>Category:</strong> ${category}<br>
                <strong>Email:</strong> ${email}<br>
                <strong>Mobile:</strong> ${mobile}<br>
                ${dateOfBirth ? `<strong>DOB:</strong> ${dateOfBirth}<br>` : ''}
                ${profession ? `<strong>Profession:</strong> ${pdfSafe(profession)}<br>` : ''}
                ${referredBy ? `<strong>Referred By:</strong> ${pdfSafe(referredBy)}<br>` : ''}
              </p>
              <p style="font-size: 11px; color: #B2AA98;">Signed PDF attached. Full details available in the admin panel.</p>
            </div>
          `,
          attachments: [attachment],
        })
      } catch (emailErr) {
        console.error('Email send error:', emailErr)
        // Don't fail the signing if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Signing error:', err)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
