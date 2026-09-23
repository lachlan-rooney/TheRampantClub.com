import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { svc } from '@/lib/kiosk/server'
import { openOrders, actOnOrder } from '@/lib/menus/orders'

// The same board as the tablets, for a manager on a laptop. Admin session, not
// a device token — and the same two actions, so a manager can place or clear
// an order without walking to the room.

export const dynamic = 'force-dynamic'

const guard = async () => (await isAdmin()) ? null : NextResponse.json({ error: 'Admins only.' }, { status: 403 })

export async function GET() {
  const no = await guard(); if (no) return no
  return NextResponse.json({ orders: await openOrders(svc()) })
}

export async function PATCH(req: NextRequest) {
  const no = await guard(); if (no) return no
  const body = await req.json().catch(() => null) as { order_id?: string; action?: string } | null
  const action = body?.action === 'clear' ? 'clear' : body?.action === 'ordered' ? 'ordered' : null
  if (!body?.order_id || !action) return NextResponse.json({ error: 'Which order?' }, { status: 400 })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const who = user?.email ?? 'admin'

  const res = await actOnOrder(svc(), body.order_id, action, who)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, orders: await openOrders(svc()) })
}
