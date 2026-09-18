import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mintTetPass, TET_COOKIE, tetCookieOpts } from '@/lib/tet/gate'

// THE DOOR TO /tet — 18+ and a shared password, in one request.
//
// The password is checked by tet_check_access in Postgres, which compares a
// bcrypt hash and returns only true or false. The hash never comes here, so a
// leak of this route's code or logs cannot leak the password.
//
// RATE LIMITED, because a shared password with no limit is a password anyone
// patient can have. Ten attempts per IP per ten minutes: generous for someone
// mistyping a phrase from a leaflet, useless for a script.

export const dynamic = 'force-dynamic'

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { n: number; until: number }>()

function tooMany(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || rec.until < now) { attempts.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  rec.n += 1
  // Keep the map from growing without bound on a long-lived instance.
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k)
  return rec.n > MAX_ATTEMPTS
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'too_many', message: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''
  const age = body?.age_confirmed === true

  // The 18+ confirmation is not decoration: the database refuses a reservation
  // without one, so the door asks the same question the reservation will.
  if (!age) {
    return NextResponse.json({ error: 'age_not_confirmed', message: 'Please confirm you are 18 or over.' }, { status: 400 })
  }
  if (!password.trim()) {
    return NextResponse.json({ error: 'no_password', message: 'Please enter the password.' }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb.rpc('tet_check_access', { p_password: password })

  if (error) {
    // Most likely: the migration has not been run. Say which, rather than
    // "something went wrong" at a door nobody can open.
    const missing = /could not find the function|does not exist/i.test(error.message)
    return NextResponse.json({
      error: 'not_configured',
      message: missing
        ? 'The Tết page is not set up yet.'
        : 'Could not check that just now.',
    }, { status: 503 })
  }
  if (data !== true) {
    return NextResponse.json({ error: 'wrong_password', message: 'That password is not right.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(TET_COOKIE, mintTetPass(), tetCookieOpts)
  return res
}
