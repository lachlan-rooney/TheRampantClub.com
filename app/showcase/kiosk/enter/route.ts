import { NextResponse, type NextRequest } from 'next/server'
import { SHOWCASE_COOKIE, showcaseCookieOpts, verifyShowcasePass } from '@/lib/showcase/gate'

// THE DOOR ITSELF — /showcase/kiosk/enter?k=<pass>
//
// A page cannot set a cookie in Next (only a Server Action or a Route Handler
// can), so the link lands here: the pass is checked, put in an httpOnly
// cookie, and the visitor is sent on to a clean URL. The pass never stays in
// the address bar, so a screenshot of the showcase cannot be used to open it.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k')
  const to = new URL('/showcase/kiosk', req.nextUrl.origin)
  if (!verifyShowcasePass(k)) {
    to.searchParams.set('expired', '1')
    return NextResponse.redirect(to)
  }
  const res = NextResponse.redirect(to)
  res.cookies.set(SHOWCASE_COOKIE, k!, showcaseCookieOpts)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
