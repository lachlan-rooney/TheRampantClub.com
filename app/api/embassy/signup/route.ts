import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'
import { deviceOk, DEVICE_COOKIE, svc as kioskSvc } from '@/lib/kiosk/server'

// THE SPIRITS EMBASSY MAILING LIST — the only way a row reaches the table.
//
// Built 2026-10-27 for the launch event. A kiosk stands unattended in a room
// full of guests, so the browser gets no write access to a table of email
// addresses and no read access at all: db/embassy_signups.sql gives anon
// nothing, and this route holds the service role. It is also therefore the
// only place that can rate-limit, which a page cannot do for itself.
//
// ── IT IS BEHIND THE SAME DOOR AS THE PAGE ────────────────────────────────
// The Tết pass. Not because an email address is a secret, but because an open
// POST endpoint that writes rows is a thing people find, and the tablet
// already has the cookie.
//
// ── CONSENT IS RECORDED, NOT ASSUMED ──────────────────────────────────────
// The row stores the exact sentence the person agreed to and when. A consent
// record that cannot say which words were on the screen is not evidence of
// anything, which is why consent_text is NOT NULL on the table whenever
// marketing_consent is true. The client sends the wording it displayed; the
// server does not invent it.

export const dynamic = 'force-dynamic'

const INTERESTS = ['shop_discount', 'events', 'whisky_club', 'tastings', 'b2b'] as const
type Interest = typeof INTERESTS[number]

/** Per tablet, per hour. A real queue at a launch is busy; a script is busier. */
const HOURLY = 120

// Deliberately permissive — the job is to catch a typo, not to adjudicate what
// a valid address is. Over-strict patterns reject real addresses, and at an
// event a rejected guest is a lost guest.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const jar = await cookies()
  // Same two doors as the page: an enrolled kiosk, or the Tết pass.
  const onKiosk = await deviceOk()
  if (!tetPassValid(jar.get(TET_COOKIE)?.value) && !onKiosk) {
    return NextResponse.json({ error: 'This page is not open.' }, { status: 403 })
  }

  // WHICH TABLET TOOK IT. Worth knowing which floor a sign-up came from, and
  // the device is the only thing that can say so truthfully — a label posted
  // by the browser would be whatever the browser felt like claiming. Read
  // server-side from the enrolled token, never from the request body.
  let deviceLabel: string | null = null
  if (onKiosk) {
    const token = jar.get(DEVICE_COOKIE)?.value
    if (token) {
      const { createHash } = await import('node:crypto')
      const hash = createHash('sha256').update(token).digest('hex')
      const { data } = await kioskSvc().from('kiosk_devices')
        .select('label, room').eq('token_hash', hash).maybeSingle()
      deviceLabel = data ? [data.label, data.room].filter(Boolean).join(' · ').slice(0, 80) : null
    }
  }

  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })

  const full_name = typeof b.full_name === 'string' ? b.full_name.replace(/\s+/g, ' ').trim() : ''
  const emailRaw = typeof b.email === 'string' ? b.email.trim() : ''
  const consent = b.marketing_consent === true
  const consentText = typeof b.consent_text === 'string' ? b.consent_text.trim().slice(0, 500) : ''
  const locale = b.locale === 'vn' ? 'vn' : 'en'
  const interests: Interest[] = Array.isArray(b.interests)
    ? Array.from(new Set<Interest>(
        b.interests.filter((i: unknown): i is Interest => INTERESTS.includes(i as Interest)),
      ))
    : []

  if (!full_name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  if (full_name.length > 120) return NextResponse.json({ error: 'name_too_long' }, { status: 400 })
  if (!LOOKS_LIKE_EMAIL.test(emailRaw) || emailRaw.length > 254) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 400 })
  }
  // NO CONSENT, NO ROW. The whole point of the form is the permission; a
  // signup without it is a contact detail the club may not use, which is worse
  // than no signup because it looks like a list.
  if (!consent) return NextResponse.json({ error: 'consent_required' }, { status: 400 })
  if (!consentText) return NextResponse.json({ error: 'consent_text_missing' }, { status: 400 })

  const email_key = emailRaw.toLowerCase()
  const a = svc()

  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('embassy_signups')
    .select('id', { count: 'exact', head: true }).gte('created_at', since)
  if ((count ?? 0) >= HOURLY) {
    return NextResponse.json({ error: 'busy' }, { status: 429 })
  }

  // ONE ROW PER EMAIL, AND INTERESTS MERGE.
  // The same person signs twice at an event — they forget, or a friend fills
  // it in for them. A second row would double-send to them later. Merging
  // means ticking "tastings" on a second pass ADDS it rather than replacing
  // what they chose the first time.
  const { data: existing } = await a.from('embassy_signups')
    .select('id, interests').eq('email_key', email_key).maybeSingle()

  const merged = existing
    ? [...new Set([...(existing.interests || []), ...interests])]
    : interests

  const row = {
    full_name,
    email: emailRaw,
    email_key,
    interests: merged,
    marketing_consent: true,
    consent_text: consentText,
    consented_at: new Date().toISOString(),
    locale,
    source: onKiosk ? 'kiosk_embassy_tet' : 'web_embassy_tet',
    device_label: deviceLabel,
  }

  const res = existing
    ? await a.from('embassy_signups').update(row).eq('id', existing.id).select('id').single()
    : await a.from('embassy_signups').insert(row).select('id').single()

  if (res.error) {
    // Most likely cause tonight: the migration has not been run.
    return NextResponse.json(
      { error: 'save_failed', detail: res.error.message, hint: 'Has db/embassy_signups.sql been run?' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, returning: !!existing, interests: merged })
}
