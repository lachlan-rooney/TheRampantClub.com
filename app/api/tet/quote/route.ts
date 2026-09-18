import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// A PRICE FOR THE PAGE — the buyer's side, never the cost side.
//
// It calls tet_quote_blends_public, which hard-codes p_admin => false, so the
// answer carries finished VND figures and nothing else: no ex-works, no
// freight, no margin. The admin flag is reachable only from /api/admin/tet/quote,
// behind isAdmin.
//
// Behind the door as well, because the prices are the reason the door exists.
//
// AND IT REFUSES WHILE ANYTHING IS PROVISIONAL. Every figure in the system is
// still invented; a quote built on an invented FX rate looks exactly like a real
// one once it is on a screen. The page asks for a price only when the flags are
// cleared, and this refuses in case a page somewhere forgets.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return NextResponse.json({ error: 'not_open' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const lines = Array.isArray(body?.lines)
    ? body.lines
        .filter((l: { sku?: string; qty?: number }) => typeof l?.sku === 'string' && Number(l?.qty) > 0)
        .slice(0, 10)
        .map((l: { sku: string; qty: number }) => ({ sku: l.sku, qty: Math.min(10000, Math.round(Number(l.qty))) }))
    : []
  if (!lines.length) return NextResponse.json({ error: 'empty_order' }, { status: 400 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: provisional } = await sb.rpc('tet_is_provisional')
  if (provisional !== false) {
    return NextResponse.json({ error: 'provisional', message: 'Prices are not published yet.' }, { status: 409 })
  }

  const { data, error } = await sb.rpc('tet_quote_blends_public', { p_lines: lines, p_sleeve: body?.sleeve !== false })
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 })
  return NextResponse.json({ quote: data })
}
