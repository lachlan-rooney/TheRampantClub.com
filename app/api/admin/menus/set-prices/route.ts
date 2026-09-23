import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { svc } from '@/lib/kiosk/server'

// THE PRICE LADDER for one set menu — per head, by the size of the party.
//
// PUT replaces the whole ladder, the same way the opening hours do: a ladder
// is edited as a ladder, and replacing it wholesale means a rung somebody
// removed is actually gone rather than surviving invisibly.
//
// The database refuses a rung outside the menu's own min/max covers
// (menu_set_prices_range), so a price for fifteen guests on a menu that stops
// at twelve is rejected here rather than sold.

export const dynamic = 'force-dynamic'
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s })

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return bad('Admins only.', 403)

  const body = await req.json().catch(() => null) as
    { set_menu_id?: string; rungs?: { covers?: number; price_per_head_vnd?: number }[] } | null
  if (!body?.set_menu_id) return bad('Which set menu?')

  const rungs = (body.rungs ?? [])
    .map(r => ({ covers: Number(r.covers), price_per_head_vnd: Number(r.price_per_head_vnd) }))
    .filter(r => Number.isInteger(r.covers) && r.covers > 0 && Number.isFinite(r.price_per_head_vnd) && r.price_per_head_vnd >= 0)
  const sizes = new Set(rungs.map(r => r.covers))
  if (sizes.size !== rungs.length) return bad('Two prices for the same number of guests.')

  const sb = svc()
  const { error: delErr } = await sb.from('menu_set_prices').delete().eq('set_menu_id', body.set_menu_id)
  if (delErr) return bad(delErr.message, 500)
  if (rungs.length) {
    const { error } = await sb.from('menu_set_prices')
      .insert(rungs.map(r => ({ ...r, set_menu_id: body.set_menu_id })))
    // The trigger's message names the menu's own range, so it is worth showing.
    if (error) return bad(error.message)
  }

  const { data } = await sb.from('menu_set_prices')
    .select('id, set_menu_id, covers, price_per_head_vnd').eq('set_menu_id', body.set_menu_id).order('covers')
  return NextResponse.json({ ok: true, prices: data ?? [] })
}
