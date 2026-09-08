import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── KIOSK BOUNDARY: /kiosk/staff/* shows member PII, so it is gated on a valid
  // enrolled, non-revoked DEVICE SESSION (the tablet's device-token cookie) — NOT
  // a personal login. No valid device → bounced to pairing. The public display
  // /kiosk/[floor] is unaffected (not in the matcher).
  const p = request.nextUrl.pathname
  if (p.startsWith('/kiosk/staff') || p.startsWith('/kiosk/board') || p.startsWith('/kiosk/member')) {
    const token = request.cookies.get('trc_kiosk_device')?.value
    let active = false
    if (token) { const { data } = await supabase.rpc('kiosk_device_active', { p_token: token }); active = data === true }
    if (!active) {
      const url = request.nextUrl.clone()
      url.pathname = '/kiosk/pair'; url.search = ''
      return NextResponse.redirect(url)
    }

    // ── THE PHASE 2 MODE BOUNDARY ──────────────────────────────────────────
    // Phase 1 gated /kiosk/staff on the DEVICE TOKEN ALONE. In member mode that
    // cookie is still perfectly valid, so a back-gesture from the member view
    // reached the staff shell. The staff picker meant it showed a picker rather
    // than PII — but the requirement is that a member's thumb CANNOT ARRIVE
    // THERE, not that it finds little when it does.
    //
    // While a member session is live on this tablet, /kiosk/staff does not exist.
    // Boolean-only RPC, and it deliberately does NOT touch the idle clock — a
    // redirect check must never keep a session alive. One extra round trip, and
    // only when a member cookie is actually present.
    if (p.startsWith('/kiosk/staff')) {
      const ms = request.cookies.get('trc_kiosk_member')?.value
      if (ms) {
        const { data: live } = await supabase.rpc('kiosk_member_session_live',
          { p_device_token: token, p_session_token: ms })
        if (live === true) {
          const url = request.nextUrl.clone()
          url.pathname = '/kiosk/board'; url.search = ''
          return NextResponse.redirect(url)
        }
      }
    }
    return supabaseResponse   // device valid → allow; the staff picker is app-side (attribution)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Forced first-login password change: an account flagged must_change_password
  // (a freshly-created member login on its temp password) cannot reach any gated
  // page until it sets a new password. Route it to /set-password (which clears
  // the flag via the service-side route). app_metadata is admin-only, so the
  // member can't clear it themselves or skip this.
  if (user && (user.app_metadata as Record<string, unknown> | undefined)?.must_change_password === true) {
    if (request.nextUrl.pathname !== '/set-password') {
      const url = request.nextUrl.clone()
      url.pathname = '/set-password'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protect /members/* and /admin/* routes — must be signed in.
  if ((request.nextUrl.pathname.startsWith('/members') || request.nextUrl.pathname.startsWith('/admin')) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // /admin/* additionally requires an ADMIN profile. A logged-in non-admin
  // (a member, once member logins exist) must NOT render the admin pages —
  // redirect to /members. (The APIs are separately isAdmin()-gated; this stops
  // the client pages rendering at all.) The session client reads the user's
  // OWN profile row under RLS — admins (all accounts today) pass through.
  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles').select('is_admin, requires_staff_pick').eq('id', user.id).single()
    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/members'
      url.search = ''
      return NextResponse.redirect(url)
    }
    // Shared staff login: must "click who you are" (attribution) before the portal.
    // Personal admins (requires_staff_pick=false) pass straight through.
    if (profile.requires_staff_pick
        && request.nextUrl.pathname !== '/admin/who'
        && !request.cookies.get('trc_admin_staff')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/who'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Redirect logged-in users away from /login.
  // Honour ?redirect= if it's an internal path; otherwise drop them on /members.
  // Either way, strip the redirect param so it doesn't linger in the URL bar.
  if (request.nextUrl.pathname === '/login' && user) {
    const target = request.nextUrl.searchParams.get('redirect')
    const url = request.nextUrl.clone()
    url.pathname = target && target.startsWith('/') && !target.startsWith('//') ? target : '/members'
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/members/:path*', '/admin/:path*', '/login',
            '/kiosk/staff/:path*', '/kiosk/board/:path*', '/kiosk/member/:path*'],
}
