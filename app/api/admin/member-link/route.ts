import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// ═══════════════════════════════════════════════════════════════════════════
// LINK AN ACCOUNT TO A MEMBERSHIP.
// ───────────────────────────────────────────────────────────────────────────
// The product had no way to do this at all. Accounts were created and the
// member_no set by hand in the database — which is how six invitations were
// about to go out with five of them half-made.
//
// member_no is NOT an account-completeness field: admins have always worked
// without one, and every admin route ignores it. It is specifically the link to
// a MEMBERSHIP RECORD, and only member-keyed things need it — a palate, visits,
// bookings, a Snug post attributed to a person.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const sb = svc()

  const [{ data: profiles }, { data: members }, users] = await Promise.all([
    sb.from('profiles').select('id, member_no, is_admin, created_at'),
    sb.from('members').select('member_no, full_name, nickname, tier, status, join_date, email'),
    sb.auth.admin.listUsers({ perPage: 500 }),
  ])

  const byId = new Map((profiles || []).map(p => [p.id, p]))
  const linkedNos = new Set((profiles || []).map(p => p.member_no).filter(Boolean))

  // An ACCOUNT is a real auth user. Show the things that make a wrong pairing
  // visible BEFORE it is made: the email it signs in with, when it was created,
  // and whether it has ever been used.
  const accounts = (users.data?.users || []).map(u => {
    const p = byId.get(u.id)
    return {
      id: u.id, email: u.email || null,
      created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null,
      is_admin: !!p?.is_admin, member_no: p?.member_no || null,
    }
  })

  return NextResponse.json({
    // Unlinked accounts first — that is the queue this screen exists to empty.
    unlinked: accounts.filter(a => !a.member_no),
    linked: accounts.filter(a => a.member_no),
    // Members with no account cannot sign in at all. The other half of the pair.
    memberless: (members || []).filter(m => !linkedNos.has(m.member_no)),
    members: members || [],
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { account_id, member_no } = await req.json().catch(() => ({}))
  if (!account_id || !member_no) return NextResponse.json({ error: 'Pick an account and a member.' }, { status: 400 })
  const sb = svc()

  // ONE MEMBERSHIP, ONE ACCOUNT. Linking a member who already has an account
  // would give two people the same dossier — the worst outcome available here,
  // so it is refused rather than warned about.
  const { data: taken } = await sb.from('profiles').select('id').eq('member_no', member_no).maybeSingle()
  if (taken && taken.id !== account_id) {
    return NextResponse.json({ error: 'That membership is already linked to another account. Unlink it first.' }, { status: 409 })
  }
  const { data: m } = await sb.from('members').select('member_no').eq('member_no', member_no).maybeSingle()
  if (!m) return NextResponse.json({ error: 'No such member number.' }, { status: 404 })

  const { error } = await sb.from('profiles').update({ member_no }).eq('id', account_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Reversible, deliberately. A wrong link is recoverable in one click rather
// than needing someone back in the database.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('account')
  if (!id) return NextResponse.json({ error: 'Which account?' }, { status: 400 })
  const { error } = await svc().from('profiles').update({ member_no: null }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
