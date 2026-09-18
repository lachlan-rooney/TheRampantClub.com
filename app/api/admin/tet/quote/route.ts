import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// THE QUOTE BUILDER'S ONE ROUTE — the only place p_admin => true is ever sent.
//
// That flag is what makes tet_quote_blends and tet_quote_cask return landed
// cost, gross margin per line and gross profit on the order. The browser cannot
// reach those functions at all (foundations §14 revokes them from anon and
// authenticated, and the public wrappers hard-code false), so a margin can only
// come from here, behind isAdmin, with the service-role key.
//
// If this route is ever made public, the cost model is public. There is no
// second line of defence behind it.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  if (body?.kind === 'cask') {
    const ref = typeof body.cask_ref === 'string' ? body.cask_ref : ''
    if (!ref) return NextResponse.json({ error: 'no_cask' }, { status: 400 })
    const { data, error } = await sb.rpc('tet_quote_cask', {
      p_cask_ref: ref,
      p_target_abv: typeof body.target_abv === 'number' ? body.target_abv : null,
      p_admin: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ quote: data })
  }

  const lines = Array.isArray(body?.lines) ? body.lines.filter((l: { sku?: string; qty?: number }) => l?.sku && Number(l.qty) > 0) : []
  if (!lines.length) return NextResponse.json({ error: 'empty_order' }, { status: 400 })
  const { data, error } = await sb.rpc('tet_quote_blends', {
    p_lines: lines, p_sleeve: body?.sleeve !== false, p_admin: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data })
}
