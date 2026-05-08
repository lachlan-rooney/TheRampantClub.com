import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { invitation_id } = await req.json().catch(() => ({}))
  if (!invitation_id) {
    return NextResponse.json({ error: 'invitation_id required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: inv, error } = await supabase
    .from('signing_invitations')
    .select('id, token, full_name, email, status, expires_at, reminder_count')
    .eq('id', invitation_id)
    .single()

  if (error || !inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (inv.status !== 'pending') {
    return NextResponse.json({ error: `Invitation is ${inv.status}` }, { status: 400 })
  }
  if (!inv.email) {
    return NextResponse.json({ error: 'No email on file' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const link = `${baseUrl}/sign/${inv.token}`

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Email not configured (RESEND_API_KEY missing)' }, { status: 500 })
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'The Rampant Club <membership@therampantclub.com>',
      to: inv.email,
      subject: 'A reminder — your Rampant Club membership agreement',
      html: `
        <div style="font-family: Georgia, serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; color: #052E20;">
          <p style="font-size: 15px; line-height: 1.7;">Dear ${inv.full_name || 'there'},</p>
          <p style="font-size: 15px; line-height: 1.7;">A gentle nudge — your membership agreement for The Rampant Club is still open.
            When you have a quiet moment, please complete and sign it at the link below.</p>
          <p style="margin: 28px 0;">
            <a href="${link}" style="background: #052E20; color: #E5D4C2; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-family: 'Helvetica Neue', sans-serif; font-size: 13px; letter-spacing: 0.08em;">Complete the agreement</a>
          </p>
          <p style="font-size: 11px; color: #5E6650; line-height: 1.7;">If the button doesn't work, paste this link into your browser:<br/>
            <a href="${link}" style="color: #5E6650;">${link}</a></p>
          <p style="font-size: 11px; color: #5E6650; margin-top: 36px;">— The Rampant Club</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Reminder email failed:', err)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }

  await supabase
    .from('signing_invitations')
    .update({
      last_reminded_at: new Date().toISOString(),
      reminder_count: (inv.reminder_count ?? 0) + 1,
    })
    .eq('id', invitation_id)

  return NextResponse.json({ ok: true })
}
