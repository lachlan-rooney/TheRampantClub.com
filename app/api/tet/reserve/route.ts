import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// RESERVE, OR REGISTER INTEREST — the page's only action.
//
// Which of the two it is is decided HERE, not by the buyer and not by the
// browser: while any cask, product or the programme still carries the
// placeholder flag, a "reservation" would hold a cask that does not exist and
// issue a reference for it. So the same submission becomes an enquiry, and
// nothing changes status.
//
// THE 18+ STAMP. The door already refused entry without it, and a valid pass
// is proof it was given — so the confirmation is recorded here with its
// timestamp rather than asked for twice. If the door ever stops asking, this
// must start.
//
// Everything runs through the service role behind the gate, so the contact
// details land in a table anon cannot read, and the rate limit is ours.

export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 20
const hits = new Map<string, { n: number; until: number }>()

function tooMany(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || rec.until < now) { hits.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  rec.n += 1
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  return rec.n > MAX_PER_HOUR
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: Request) {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) {
    return NextResponse.json({ error: 'not_open', message: 'Please enter through the front of the page.' }, { status: 403 })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'too_many', message: 'Too many submissions. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const kind = body?.kind === 'cask' ? 'cask' : 'blend'
  const company = str(body?.company_name)
  const name = str(body?.contact_name)
  const email = str(body?.contact_email)
  const phone = str(body?.contact_phone, 40)
  const tax = str(body?.tax_code, 40)
  const message = str(body?.message, 1200)
  const locale = body?.locale === 'vn' ? 'vn' : 'en'
  const caskRef = str(body?.cask_ref, 40) || null
  const targetAbv = typeof body?.target_abv === 'number' ? body.target_abv : null
  const lines = Array.isArray(body?.lines) ? body.lines.slice(0, 20) : []
  const sleeve = body?.sleeve !== false

  if (!company || !name || !email) {
    return NextResponse.json({ error: 'missing_contact', message: 'Company, name and email are needed.' }, { status: 400 })
  }
  // Deliberately loose: an address this side of the invoice only has to be
  // something a person can be replied to at.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'bad_email', message: 'That email address does not look right.' }, { status: 400 })
  }
  if (kind === 'cask' && !caskRef) {
    return NextResponse.json({ error: 'no_cask', message: 'No cask was chosen.' }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: provisional, error: provErr } = await sb.rpc('tet_is_provisional')
  if (provErr) {
    const missing = /could not find the function|does not exist/i.test(provErr.message)
    return NextResponse.json({
      error: 'not_configured',
      message: missing ? 'The Tết programme is not finished being set up.' : 'Could not take that just now.',
    }, { status: 503 })
  }

  // ── PROVISIONAL: an enquiry, and nothing that pretends otherwise ──────
  if (provisional !== false) {
    const { data, error } = await sb.from('tet_enquiries').insert({
      company_name: company, contact_name: name, contact_email: email,
      contact_phone: phone || null, tax_code: tax || null,
      age_confirmed_at: new Date().toISOString(), locale,
      kind, cask_ref: caskRef,
      bottling_strength: kind === 'cask' ? (targetAbv && targetAbv < 60 ? 'reduced' : 'cask_strength') : null,
      line_items: lines, total_bottles: lines.reduce((s: number, l: { qty?: number }) => s + (Number(l?.qty) || 0), 0) || null,
      message: message || null, source: str(body?.source, 40) || 'tet-page',
    }).select('reference').single()
    if (error) return NextResponse.json({ error: 'save_failed', message: error.message }, { status: 500 })
    return NextResponse.json({ mode: 'enquiry', reference: data.reference })
  }

  // ── REAL: a reservation, which holds the cask ─────────────────────────
  const args = {
    p_company: company, p_contact_name: name, p_contact_email: email,
    p_contact_phone: phone || null, p_tax_code: tax || null,
    p_personalisation: body?.personalisation ?? {},
    p_split_delivery: body?.split_delivery ?? [],
    p_age_confirmed: true,   // proved by the pass — see the note at the top
    p_locale: locale, p_source: str(body?.source, 40) || 'tet-page',
  }
  const { data, error } = kind === 'cask'
    ? await sb.rpc('tet_reserve_cask', { ...args, p_cask_ref: caskRef, p_target_abv: targetAbv })
    : await sb.rpc('tet_reserve_blends', { ...args, p_lines: lines, p_sleeve: sleeve })

  if (error) {
    // The ordering gate speaks in exceptions; turn it into something a buyer
    // can act on rather than a raised Postgres error.
    const closed = /ordering_closed_for/.test(error.message)
    return NextResponse.json({
      error: closed ? 'ordering_closed' : 'save_failed',
      message: closed
        ? 'The last order date for this has passed. Please speak to us directly.'
        : 'Could not take that just now.',
    }, { status: closed ? 409 : 500 })
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return NextResponse.json({ error: data.error, message: readable(String(data.error)) }, { status: 409 })
  }
  return NextResponse.json({ mode: 'reservation', ...data })
}

function readable(code: string): string {
  switch (code) {
    case 'cask_unavailable': return 'That cask has just been taken.'
    case 'cask_not_found': return 'That cask is no longer listed.'
    case 'below_minimum': return 'The minimum order is fifty bottles.'
    case 'age_not_confirmed': return 'Please confirm you are 18 or over.'
    case 'missing_contact': return 'Company and email are needed.'
    default: return 'That could not be completed.'
  }
}
