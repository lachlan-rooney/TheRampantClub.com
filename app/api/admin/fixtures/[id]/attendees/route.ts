import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { isMissingColumn, foldName } from '@/lib/fixtures'

// Who is coming to an event, and staff putting people on it (2026-09-15).
//
// Some members sign up in the portal; others sign up on Zalo through the hotline,
// and most have no portal account at all. So staff add them here: a MEMBER from
// the roster, or just a NAME for someone who is not on it. Each row takes one
// place, exactly as a portal sign-up does.
//
// ADMIN-ONLY, service role. This is the only route that returns attendee names;
// members and the public get counts from fixture_signup_counts() and nothing else.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const NOT_READY = 'Staff-added attendees are not set up yet — run db/fixture_attendees.sql.'

type Row = {
  id: string; user_id: string | null; signed_up_at: string
  member_no?: string | null; attendee_name?: string | null; note?: string | null
  added_by?: string | null; source?: string | null
}

type Svc = ReturnType<typeof svc>

// One place decides what a row is called, so the list and the duplicate check can
// never disagree about who someone is. The member record wins over the snapshot
// (a corrected spelling shows through); a login's display name is the fallback.
async function nameRows(a: Svc, rows: Row[]) {
  const nos = [...new Set(rows.map(r => r.member_no).filter((x): x is string => !!x))]
  const uids = [...new Set(rows.map(r => r.user_id).filter((x): x is string => !!x))]
  const [{ data: mem }, { data: prof }] = await Promise.all([
    nos.length ? a.from('members').select('member_no, full_name').in('member_no', nos) : Promise.resolve({ data: [] as { member_no: string; full_name: string }[] }),
    uids.length ? a.from('profiles').select('id, display_name').in('id', uids) : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ])
  const memberName = new Map((mem || []).map(m => [m.member_no, m.full_name]))
  const profileName = new Map((prof || []).map(p => [p.id, p.display_name]))
  return rows.map(r => ({
    id: r.id,
    name: (r.member_no && memberName.get(r.member_no)) || (r.user_id && profileName.get(r.user_id)) || r.attendee_name || (r.user_id ? r.user_id.slice(0, 8) : '—'),
    source: (r.source === 'staff' ? 'staff' : 'portal') as 'staff' | 'portal',
    member_no: r.member_no ?? null,
    has_account: !!r.user_id,
    note: r.note ?? null,
    added_by: r.added_by ?? null,
    signed_up_at: r.signed_up_at,
  }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const a = svc()

  const full = await a.from('fixture_signups')
    .select('id, user_id, signed_up_at, member_no, attendee_name, note, added_by, source')
    .eq('fixture_id', id).order('signed_up_at', { ascending: true })
  let rows: Row[]
  let ready = true
  if (full.error) {
    // Before the SQL has run: the portal sign-ups, exactly as the roster line
    // showed them. Any other error is a real one and is reported as such.
    if (!isMissingColumn(full.error)) return NextResponse.json({ error: full.error.message }, { status: 500 })
    const base = await a.from('fixture_signups').select('id, user_id, signed_up_at')
      .eq('fixture_id', id).order('signed_up_at', { ascending: true })
    if (base.error) return NextResponse.json({ error: base.error.message }, { status: 500 })
    rows = (base.data || []) as Row[]
    ready = false
  } else {
    rows = (full.data || []) as Row[]
  }
  return NextResponse.json({ ready, attendees: await nameRows(a, rows) })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const p = await req.json().catch(() => null)
  const memberNo = typeof p?.member_no === 'string' && p.member_no.trim() ? p.member_no.trim().slice(0, 40) : null
  const typedName = typeof p?.attendee_name === 'string' ? p.attendee_name.trim().replace(/\s+/g, ' ') : ''
  const note = typeof p?.note === 'string' && p.note.trim() ? p.note.trim().slice(0, 200) : null
  if (!memberNo && (typedName.length < 1 || typedName.length > 120)) {
    return NextResponse.json({ error: 'Pick a member or type a name (up to 120 characters).' }, { status: 400 })
  }

  const a = svc()
  // Selecting is_full doubles as the readiness probe: it only exists once the SQL
  // has run, and so do the columns the insert below needs.
  const fx = await a.from('fixtures').select('id, title, max_signups, is_full').eq('id', id).maybeSingle()
  if (fx.error) {
    if (isMissingColumn(fx.error)) return NextResponse.json({ error: NOT_READY, ready: false }, { status: 409 })
    return NextResponse.json({ error: fx.error.message }, { status: 500 })
  }
  if (!fx.data) return NextResponse.json({ error: 'That event no longer exists.' }, { status: 404 })

  const ex = await a.from('fixture_signups')
    .select('id, user_id, signed_up_at, member_no, attendee_name, source').eq('fixture_id', id)
  if (ex.error) {
    if (isMissingColumn(ex.error)) return NextResponse.json({ error: NOT_READY, ready: false }, { status: 409 })
    return NextResponse.json({ error: ex.error.message }, { status: 500 })
  }
  const existing = (ex.data || []) as Row[]

  let insert: Record<string, unknown>
  let label: string
  if (memberNo) {
    const { data: member, error: mErr } = await a.from('members').select('member_no, full_name').eq('member_no', memberNo).maybeSingle()
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    if (!member) return NextResponse.json({ error: `No member ${memberNo} on the roster.` }, { status: 404 })
    // A member with a portal login gets that login on the row, so it behaves
    // exactly as if they had tapped "Sign me up": they see "You're in" and can
    // withdraw. A member without one gets it claimed on their first tap
    // (fixture_signup() matches on member_no).
    const { data: linked, error: lErr } = await a.from('profiles').select('id').eq('member_no', memberNo)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    const linkedIds = new Set((linked || []).map(l => l.id))
    // Refused on member_no OR login: a portal sign-up from before the SQL ran
    // carries no member_no, and the unique index cannot see that one.
    if (existing.some(r => r.member_no === memberNo || (r.user_id && linkedIds.has(r.user_id)))) {
      return NextResponse.json({ error: `${member.full_name} is already on the list.` }, { status: 409 })
    }
    label = member.full_name
    insert = {
      fixture_id: id, member_no: memberNo, user_id: (linked || [])[0]?.id ?? null,
      attendee_name: member.full_name,   // snapshot — the row stays readable if the member record goes
      note, source: 'staff', added_by: user?.email || user?.id || null,
    }
  } else {
    const named = await nameRows(a, existing)
    const dup = named.find(r => foldName(r.name) === foldName(typedName))
    if (dup) return NextResponse.json({ error: `${dup.name} is already on the list.` }, { status: 409 })
    label = typedName
    insert = { fixture_id: id, attendee_name: typedName, note, source: 'staff', added_by: user?.email || user?.id || null }
  }

  const ins = await a.from('fixture_signups').insert(insert).select('id').single()
  if (ins.error) {
    if (ins.error.code === '23505') return NextResponse.json({ error: `${label} is already on the list.` }, { status: 409 })
    if (isMissingColumn(ins.error)) return NextResponse.json({ error: NOT_READY, ready: false }, { status: 409 })
    return NextResponse.json({ error: ins.error.message }, { status: 500 })
  }

  // Staff may go past the cap — they may be recording what already happened on
  // Zalo — and ignore the deadline. What they must not do is go past it without
  // being told, so the response always carries where the count now stands.
  const count = existing.length + 1
  const cap: number | null = fx.data.max_signups
  return NextResponse.json({
    ok: true, id: ins.data.id, name: label, count, cap,
    at_cap: cap != null && count === cap,
    over_cap: cap != null && count > cap,
  })
}
