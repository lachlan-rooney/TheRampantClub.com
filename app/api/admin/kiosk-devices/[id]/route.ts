import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { svc } from '@/lib/kiosk/server'

// Revoke a device (tablet lost/retired) — the token stops working at once. Or
// re-issue a fresh pairing code for a pending/revoked device. Admin-gated.

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const { action } = await req.json().catch(() => ({}))
  if (action !== 'revoke') return NextResponse.json({ error: 'Bad action.' }, { status: 400 })
  const { error } = await svc().from('kiosk_devices').update({ revoked_at: new Date().toISOString(), token_hash: null, pair_code: null }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not revoke.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
