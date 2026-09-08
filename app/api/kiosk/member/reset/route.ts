import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { svc, deviceOk } from '@/lib/kiosk/server'
import { resolveMember } from '@/lib/kiosk/resolve'

// "I've forgotten my code." Device-gated, and deliberately incurious.
//
// TWO THINGS THIS MUST NOT DO:
//  1. Email more than one member. It resolves to EXACTLY ONE member or nobody —
//     never a list — because a reset that fanned out across a shared surname would
//     tell three people that somebody tried to get into their account.
//  2. Confirm whether a member exists. "No account found" versus "reset sent" tells
//     anyone standing at the tablet whether a surname is on the roll. The response
//     is identical either way; only the sending differs, and the send is
//     fire-and-forget so the reply does not take longer when there is someone to
//     send to.

export const dynamic = 'force-dynamic'

const SAME_ANSWER = {
  ok: true,
  message: 'If that matches a member, a link has been sent to the email we hold. It expires in 30 minutes.',
}

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const { who } = await req.json().catch(() => ({}))
  if (typeof who !== 'string' || !who.trim()) return NextResponse.json(SAME_ANSWER)

  const a = svc()
  const member_no = await resolveMember(who, a)
  if (!member_no) return NextResponse.json(SAME_ANSWER)

  const { data: m } = await a.from('members').select('member_no, full_name, email').eq('member_no', member_no).maybeSingle()
  if (!m?.email) return NextResponse.json(SAME_ANSWER)

  const { data: token } = await a.rpc('request_member_pin_reset', { p_member_no: member_no })
  if (!token) return NextResponse.json(SAME_ANSWER)

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const link = `${base}/members/pin/reset?token=${token}`
  const first = (m.full_name || '').trim().split(/\s+/)[0] || 'there'

  if (process.env.RESEND_API_KEY) {
    // Not awaited: a reply that takes longer when there IS a member to email is
    // the same oracle as a different message.
    new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'The Rampant Club <no-reply@therampantclub.com>',
      to: [m.email],
      subject: 'Your kiosk code',
      html: `<div style="font-family:Georgia,serif;color:#052E20;line-height:1.7;max-width:520px">
        <p>${first},</p>
        <p>Someone asked to set a new six-digit kiosk code for your membership. If that was you,
           the link below opens your member portal, where you can choose one.</p>
        <p style="margin:26px 0"><a href="${link}"
           style="background:#052E20;color:#E5D4C2;text-decoration:none;padding:14px 26px;border-radius:4px;
                  font-family:monospace;letter-spacing:.08em;text-transform:uppercase;font-size:13px">Set your code</a></p>
        <p style="font-size:13px;opacity:.75">The link works once and expires in 30 minutes.
           If it wasn't you, nothing has changed and you can ignore this — your existing code still works.</p>
        <p style="font-size:13px;opacity:.75">The Rampant Club</p>
      </div>`,
    }).catch(() => { /* silent: the response must not vary */ })
  }

  return NextResponse.json(SAME_ANSWER)
}
