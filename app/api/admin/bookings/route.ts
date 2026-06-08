import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { checkBookingAvailability } from '@/lib/booking-availability'

// GET  /api/admin/bookings[?from=YYYY-MM-DD&to=YYYY-MM-DD&space=…&status=…]
// POST /api/admin/bookings   — create a booking

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['pending', 'confirmed', 'arrived', 'cancelled', 'no_show']
const ALLOWED_SESSIONS = ['early', 'evening', 'late']

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  const space = searchParams.get('space')
  const status = searchParams.get('status')

  const sb = svc()
  let q = sb.from('bookings_with_member').select('*').order('booking_date').order('start_time', { ascending: true, nullsFirst: false })
  if (from)   q = q.gte('booking_date', from)
  if (to)     q = q.lte('booking_date', to)
  if (space)  q = q.eq('space', space)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data || [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const member_no = String(body.member_no || '').trim()
  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })

  const booking_date = String(body.booking_date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return NextResponse.json({ error: 'booking_date must be YYYY-MM-DD' }, { status: 400 })

  const space = String(body.space || '').trim()
  if (!space) return NextResponse.json({ error: 'space required' }, { status: 400 })

  const session_label = typeof body.session_label === 'string' && ALLOWED_SESSIONS.includes(body.session_label)
    ? body.session_label : null
  const start_time = typeof body.start_time === 'string' && /^\d{2}:\d{2}/.test(body.start_time)
    ? body.start_time : null
  const end_time = typeof body.end_time === 'string' && /^\d{2}:\d{2}/.test(body.end_time)
    ? body.end_time : null

  if (!session_label && !start_time) {
    return NextResponse.json({ error: 'either start_time or session_label is required' }, { status: 400 })
  }

  const partyRaw = Number(body.party_size)
  const party_size = Number.isInteger(partyRaw) && partyRaw >= 1 && partyRaw <= 50 ? partyRaw : 1

  const status = typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status) ? body.status : 'confirmed'

  // Specific table units (Phase 2). Optional: when present the availability
  // guard runs (party≤seats, either-or, per-unit conflicts) and the holds are
  // recorded in booking_tables. When absent, behaves as before (room-closure
  // check only) so the legacy space-only form keeps working until Phase 3.
  const unit_ids = Array.isArray(body.unit_ids) ? (body.unit_ids.filter(x => typeof x === 'string') as string[]) : []

  const sb = svc()
  // Pull more than just member_no — the confirmation email needs name + address.
  const { data: member } = await sb.from('members')
    .select('member_no, full_name, nickname, email, tier')
    .eq('member_no', member_no).maybeSingle()
  if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })

  // Availability guard (shared with PATCH): either-or table conflicts, per-unit
  // overlap, party≤seats, and the room-closure block — one function, no drift.
  const avail = await checkBookingAvailability({
    sb, unit_ids, space, booking_date, start_time, end_time, session_label, party_size,
  })
  if (!avail.ok) return NextResponse.json({ error: avail.error }, { status: avail.status || 409 })
  const finalSpace = avail.resolvedSpace || space   // when units chosen, the room is derived from them

  const sendEmail = !!body.send_confirmation
  if (sendEmail && !member.email) {
    return NextResponse.json({ error: `Cannot send confirmation — ${member.full_name} has no email on file. Add one to the member record or untick send confirmation.` }, { status: 400 })
  }

  const { data, error } = await sb.from('bookings').insert({
    member_no, booking_date, space: finalSpace, party_size, status,
    session_label,
    start_time,
    end_time,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    created_by: actor,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Record the unit holds. If this fails, roll the booking back (compensating
  // delete) so we never leave a booking without its table holds.
  if (unit_ids.length > 0) {
    const rows = [...new Set(unit_ids)].map(unit_id => ({ booking_id: data.booking_id, unit_id }))
    const { error: btErr } = await sb.from('booking_tables').insert(rows)
    if (btErr) {
      await sb.from('bookings').delete().eq('booking_id', data.booking_id)
      return NextResponse.json({ error: `Could not record table holds: ${btErr.message}` }, { status: 500 })
    }
  }

  // Best-effort confirmation email. Failure logs a warning but does not
  // roll back the booking — the staff can resend from the calendar later.
  let email_sent = false
  let email_error: string | null = null
  if (sendEmail && member.email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const html = renderBookingEmail({
        name: member.full_name,
        booking_date,
        start_time,
        end_time,
        session_label,
        space: finalSpace,
        party_size,
        notes: body.notes ? String(body.notes) : null,
      })
      await resend.emails.send({
        from: 'The Rampant Club <bookings@therampantclub.com>',
        to: member.email,
        subject: `Booking confirmed — ${formatBookingDateForSubject(booking_date)}`,
        html,
      })
      email_sent = true
    } catch (e) {
      email_error = (e as Error).message
      console.error('Booking confirmation email failed:', e)
    }
  } else if (sendEmail && !process.env.RESEND_API_KEY) {
    email_error = 'RESEND_API_KEY not configured'
  }

  return NextResponse.json({ booking: data, email_sent, email_error })
}

function formatBookingDateForSubject(iso: string): string {
  const d = new Date(`${iso}T12:00:00+07:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' })
}

interface BookingEmailFields {
  name: string
  booking_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string
  party_size: number
  notes: string | null
}

function renderBookingEmail(f: BookingEmailFields): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const lionUrl = `${siteUrl}/images/lion-signature-opt.png`
  const dPretty = new Date(`${f.booking_date}T12:00:00+07:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  })
  const timeStr = f.start_time
    ? f.end_time ? `${f.start_time.slice(0, 5)} – ${f.end_time.slice(0, 5)}` : f.start_time.slice(0, 5)
    : null
  const sessionStr = f.session_label ? f.session_label.charAt(0).toUpperCase() + f.session_label.slice(1) : null
  const timeLine = [timeStr, sessionStr].filter(Boolean).join(' · ') || '—'

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Georgia, 'Times New Roman', serif; background-color: #E5D4C2;">
      <div style="background-color: #E5D4C2; padding: 48px 40px 24px; text-align: center;">
        <img src="${lionUrl}" alt="" width="80" style="display: block; margin: 0 auto 24px;" />
        <h1 style="color: #052E20; font-size: 22px; font-weight: 400; letter-spacing: 0.08em; margin: 0;">THE RAMPANT CLUB</h1>
        <p style="color: #5E6650; font-size: 10px; letter-spacing: 0.12em; margin: 10px 0 0; text-transform: uppercase;">Booking confirmation</p>
      </div>
      <div style="background-color: #E5D4C2; padding: 24px 48px 40px;">
        <p style="color: #052E20; font-size: 15px; line-height: 1.8; margin: 0 0 20px;">Dear ${f.name},</p>
        <p style="color: #5E6650; font-size: 13px; line-height: 1.85; margin: 0 0 20px;">
          Your visit to The Rampant Club is confirmed. We look forward to receiving you.
        </p>

        <div style="background-color: rgba(5,46,32,0.06); border-radius: 6px; padding: 22px 26px; margin-bottom: 28px;">
          <p style="color: #052E20; font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase; margin: 0 0 14px;">Reservation details</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="color: #5E6650; font-size: 10px; padding: 6px 0; letter-spacing: 0.04em; text-transform: uppercase; width: 110px;">Date</td><td style="color: #052E20; font-size: 13px; padding: 6px 0;">${dPretty}</td></tr>
            <tr><td style="color: #5E6650; font-size: 10px; padding: 6px 0; letter-spacing: 0.04em; text-transform: uppercase;">Time</td><td style="color: #052E20; font-size: 13px; padding: 6px 0;">${timeLine}</td></tr>
            <tr><td style="color: #5E6650; font-size: 10px; padding: 6px 0; letter-spacing: 0.04em; text-transform: uppercase;">Space</td><td style="color: #052E20; font-size: 13px; padding: 6px 0;">${f.space}</td></tr>
            <tr><td style="color: #5E6650; font-size: 10px; padding: 6px 0; letter-spacing: 0.04em; text-transform: uppercase;">Party</td><td style="color: #052E20; font-size: 13px; padding: 6px 0;">${f.party_size} ${f.party_size === 1 ? 'guest' : 'guests'}</td></tr>
            ${f.notes ? `<tr><td style="color: #5E6650; font-size: 10px; padding: 6px 0; letter-spacing: 0.04em; text-transform: uppercase;">Note</td><td style="color: #052E20; font-size: 13px; padding: 6px 0; line-height: 1.55;">${f.notes}</td></tr>` : ''}
          </table>
        </div>

        <p style="color: #5E6650; font-size: 13px; line-height: 1.85; margin: 0 0 14px;">
          Should anything change, please reply to this message and we will adjust the reservation directly.
        </p>
        <p style="color: #052E20; font-size: 13px; line-height: 1.85; margin: 6px 0 0;">— The Concierge</p>
      </div>
      <div style="background-color: #052E20; padding: 28px 40px; text-align: center;">
        <p style="color: #B2AA98; font-size: 10px; line-height: 1.7; margin: 0;">
          74A2 Hai Ba Trung, District 1, Ho Chi Minh City<br>
          Concierge@TheRampantClub.com &nbsp;|&nbsp; (+84) 817 888 768
        </p>
      </div>
    </div>
  `
}
