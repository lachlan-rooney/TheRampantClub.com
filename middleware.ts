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
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/members'
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
  matcher: ['/members/:path*', '/admin/:path*', '/login'],
}
