import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/mis/prospects/[id]/send-invitation
//
// Closes the signing loop: turns an approved prospect into a Pending Signature
// member, creates a signing_invitations row linked back to both the prospect
// and the member, and emails the signing link. /api/sign will then flip the
// member to Active and the prospect to Onboarded when the link is completed.
//
// Body: { tier, email, mobile?, resend? }
//   resend=true reuses any existing pending invitation for this prospect
//   instead of creating a new one (still sends the email).

export const dynamic = 'force-dynamic'

const ALLOWED_TIERS = ['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: { tier?: unknown; email?: unknown; mobile?: unknown; resend?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const tier = String(body.tier || '').trim()
  if (!ALLOWED_TIERS.includes(tier)) {
    return NextResponse.json({ error: `tier must be one of ${ALLOWED_TIERS.join(', ')}` }, { status: 400 })
  }
  const email = String(body.email || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }
  const mobile = body.mobile ? String(body.mobile).trim() : null
  const isResend = !!body.resend

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: prospect } = await sb.from('prospects').select('*').eq('prospect_id', id).maybeSingle()
  if (!prospect) return NextResponse.json({ error: 'prospect not found' }, { status: 404 })

  // 1. Ensure we have a member_no — reuse provisional, or mint fresh.
  let member_no: string
  if (prospect.converted_member_no) {
    member_no = prospect.converted_member_no
    const { error } = await sb.from('members').update({
      status: 'Pending Signature',
      tier,
    }).eq('member_no', member_no)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { data: minted, error: mintErr } = await sb.rpc('mint_member_no')
    if (mintErr || !minted) return NextResponse.json({ error: mintErr?.message || 'mint failed' }, { status: 500 })
    member_no = String(minted)

    const { error: insErr } = await sb.from('members').insert({
      member_no,
      full_name: prospect.full_name,
      nickname:  prospect.nickname,
      tier,
      status:    'Pending Signature',
      join_date: null,
      referred_by: prospect.referred_by_name,
    })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // 2. Find or create signing invitation.
  let token: string
  if (isResend) {
    const { data: existing } = await sb
      .from('signing_invitations')
      .select('token, status')
      .eq('prospect_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing?.token) {
      token = existing.token
    } else {
      token = randomUUID()
      const { error: invErr } = await sb.from('signing_invitations').insert({
        token,
        full_name:   prospect.full_name,
        email,
        mobile,
        referred_by: prospect.referred_by_name,
        profession:  prospect.profession,
        category:    tier.toLowerCase(),
        member_no,
        prospect_id: id,
      })
      if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })
    }
  } else {
    token = randomUUID()
    const { error: invErr } = await sb.from('signing_invitations').insert({
      token,
      full_name:   prospect.full_name,
      email,
      mobile,
      referred_by: prospect.referred_by_name,
      profession:  prospect.profession,
      category:    tier.toLowerCase(),
      member_no,
      prospect_id: id,
    })
    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const link = `${baseUrl}/sign/${token}`

  // 3. Send the email.
  let emailSent = false
  let emailError: string | null = null
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const lionUrl = `${baseUrl}/images/lion-signature-opt.png`
      const html = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Georgia, 'Times New Roman', serif; background-color: #E5D4C2;">
          <div style="background-color: #E5D4C2; padding: 48px 40px 24px; text-align: center;">
            <img src="${lionUrl}" alt="" width="80" style="display: block; margin: 0 auto 24px;" />
            <h1 style="color: #052E20; font-size: 22px; font-weight: 400; letter-spacing: 0.08em; margin: 0;">THE RAMPANT CLUB</h1>
            <p style="color: #5E6650; font-size: 10px; letter-spacing: 0.12em; margin: 10px 0 0; text-transform: uppercase;">An invitation to sign</p>
          </div>
          <div style="background-color: #E5D4C2; padding: 24px 48px 40px;">
            <p style="color: #052E20; font-size: 15px; line-height: 1.8; margin: 0 0 20px;">Dear ${prospect.full_name},</p>
            <p style="color: #5E6650; font-size: 13px; line-height: 1.85; margin: 0 0 16px;">
              Following our recent conversations, the Membership Committee is pleased to extend an invitation for you to join The Rampant Club as a <strong>${tier} Member</strong>.
            </p>
            <p style="color: #5E6650; font-size: 13px; line-height: 1.85; margin: 0 0 16px;">
              To complete your application, please review and sign the Membership Agreement at the secure link below. The form takes a few minutes and asks for the details we still need on file.
            </p>
            <p style="margin: 32px 0; text-align: center;">
              <a href="${link}" style="background: #052E20; color: #E5D4C2; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-family: 'Helvetica Neue', sans-serif; font-size: 13px; letter-spacing: 0.10em;">SIGN THE AGREEMENT</a>
            </p>
            <p style="color: #5E6650; font-size: 11px; line-height: 1.7; margin: 0 0 8px;">If the button doesn't work, paste this link into your browser:</p>
            <p style="color: #5E6650; font-size: 11px; line-height: 1.7; word-break: break-all; margin: 0 0 28px;">
              <a href="${link}" style="color: #5E6650;">${link}</a>
            </p>
            <p style="color: #5E6650; font-size: 13px; line-height: 1.85; margin: 0;">With warmest regards,</p>
            <p style="color: #052E20; font-size: 13px; line-height: 1.85; margin: 6px 0 0;">The Membership Committee</p>
          </div>
          <div style="background-color: #052E20; padding: 28px 40px; text-align: center;">
            <p style="color: #B2AA98; font-size: 10px; line-height: 1.7; margin: 0;">
              74A2 Hai Ba Trung, District 1, Ho Chi Minh City<br>
              Membership@TheRampantClub.com &nbsp;|&nbsp; (+84) 817 888 768
            </p>
          </div>
        </div>
      `
      await resend.emails.send({
        from: 'The Rampant Club <membership@therampantclub.com>',
        to: email,
        subject: 'Your invitation to sign — The Rampant Club',
        html,
      })
      emailSent = true
    } catch (e) {
      emailError = (e as Error).message
      console.error('Invitation email failed:', e)
    }
  } else {
    emailError = 'RESEND_API_KEY not configured'
  }

  // 4. Update prospect stage + log activity.
  await sb.from('prospects').update({
    stage: 'Application Received',
    converted_member_no: member_no,
    updated_at: new Date().toISOString(),
  }).eq('prospect_id', id)

  await sb.from('prospect_activity').insert({
    prospect_id: id,
    actor,
    event_type: isResend ? 'invitation_resent' : 'invitation_sent',
    to_value: email,
    note: `${isResend ? 'Resent' : 'Sent'} signing invitation to ${email} for ${tier} membership (${member_no}).${emailSent ? '' : ' Email delivery failed: ' + emailError}`,
  })

  return NextResponse.json({
    ok: true,
    member_no,
    token,
    link,
    email_sent: emailSent,
    email_error: emailError,
  })
}
