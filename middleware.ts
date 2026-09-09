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

  // ── NOTHING UNDER /kiosk IS EVER STORED ────────────────────────────────────
  // The second half of the cache boundary (the first is the /kiosk exclusion in
  // public/sw.js). This one covers a DIFFERENT cache: the browser's HTTP disk
  // cache and the back-forward cache, neither of which the service worker touches.
  // A bolted-down shared tablet must not keep a member's view anywhere.
  const noStore = <T extends NextResponse>(res: T): T => {
    if (p === '/kiosk' || p.startsWith('/kiosk/')) {
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      res.headers.set('Pragma', 'no-cache')
    }
    return res
  }

  // Public floor kiosks (/kiosk/[floor]) and /kiosk/pair are NOT device-gated —
  // gating them would break the public display. They still get no-store.
  if (p === '/kiosk' || (p.startsWith('/kiosk/')
      && !p.startsWith('/kiosk/staff') && !p.startsWith('/kiosk/board') && !p.startsWith('/kiosk/member'))) {
    return noStore(supabaseResponse)
  }

  if (p.startsWith('/kiosk/staff') || p.startsWith('/kiosk/board') || p.startsWith('/kiosk/member')) {
    const token = request.cookies.get('trc_kiosk_device')?.value
    let active = false
    if (token) { const { data } = await supabase.rpc('kiosk_device_active', { p_token: token }); active = data === true }
    if (!active) {
      const url = request.nextUrl.clone()
      url.pathname = '/kiosk/pair'; url.search = ''
      return noStore(NextResponse.redirect(url))
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
          return noStore(NextResponse.redirect(url))
        }
      }
    }
    return noStore(supabaseResponse)   // device valid → allow; the staff picker is app-side (attribution)
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

  // ── DOCUMENTS OUTSTANDING ───────────────────────────────────────────────
  // Same shape as the must_change_password gate above, and for the same reason: a
  // member behind on a REQUIRED document cannot reach the portal until they agree.
  //
  // my_consent_state() decides, not this file — it reads terms_documents, so a
  // document published later is gated without touching middleware. Signed
  // documents and optional ones are never pending, so marketing can never gate.
  //
  // THE PORTAL ONLY. Nothing under /kiosk is checked here, deliberately: nobody
  // agrees to a contract on a bar-top tablet with a queue behind them, and the
  // schema refuses it anyway ('kiosk' is not a valid consent method).
  if (user && request.nextUrl.pathname.startsWith('/members')
      && request.nextUrl.pathname !== '/members/agree') {
    const { data: consent } = await supabase.rpc('my_consent_state')
    if ((consent || []).some((r: { needs_action?: boolean }) => r.needs_action)) {
      const url = request.nextUrl.clone()
      url.pathname = '/members/agree'; url.search = ''
      return NextResponse.redirect(url)
    }
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
  // /kiosk/:path* covers every kiosk surface so the no-store header reaches the
  // public floor pages too; the device gate inside applies only to staff/board/member.
  matcher: ['/members/:path*', '/admin/:path*', '/login', '/kiosk', '/kiosk/:path*'],
}
