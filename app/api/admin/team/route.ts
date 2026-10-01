import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { svc } from '@/lib/kiosk/server'

// THE TEAM ITSELF — adding somebody, and standing somebody down.
//
// Owner, 2026-10-01: "I need to add a new staff member." There was no way to.
// Fifteen people were on team_members and every one of them had been put there
// by hand through the database; the admin could set a PIN and an address for
// somebody who already existed and nothing else. Two people were added this
// week by asking me, which is not a system.
//
// WHAT A TEAM MEMBER IS, and is not: a row that can be assigned a board task,
// given a PIN for the floor tablets, and given an address for the morning task
// digest. It is NOT a login — nobody gets a seat from here. See the note on
// /admin/members ("Logins & Admin Rights") for the three-way distinction.
//
// PIN and email stay on /api/admin/kiosk-devices/pin, where they already work.
// This route owns who is on the list and whether they are still here.
//
// NOBODY IS DELETED. A team member is referenced by every task they were ever
// assigned, every PIN attempt, every stocktake count and every guest they
// signed in. Deleting one would either fail on a foreign key or quietly orphan
// a year of attribution, and "who did this" is the whole reason the table
// exists. `active` false drops them off the picker, the rota and the digest
// while leaving the record of what they did intact.

export const dynamic = 'force-dynamic'

const NAME_MAX = 60
const clean = (s: unknown, max = NAME_MAX) =>
  typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : ''

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const display_name = clean(body.display_name)
  if (display_name.length < 2) return NextResponse.json({ error: 'Give them a name.' }, { status: 400 })

  const sb = svc()

  // ONE PERSON, ONE ROW. Two "Bình"s on the staff picker is two people who
  // cannot tell which one is them, and a board task assigned to the wrong one.
  // Checked case-insensitively, because Tai and tai are the same person.
  const { data: clash } = await sb.from('team_members')
    .select('id, display_name, active').ilike('display_name', display_name).maybeSingle()
  if (clash) {
    return NextResponse.json({
      error: clash.active
        ? `${clash.display_name} is already on the team.`
        : `${clash.display_name} is on the team but stood down — bring them back instead.`,
      existing_id: clash.id, inactive: !clash.active,
    }, { status: 409 })
  }

  const row: Record<string, unknown> = {
    display_name,
    role_title: clean(body.role_title, 80) || null,
    active: true,
    // ON THE ROTA IS A SEPARATE QUESTION from being on the team. A partner
    // contact (Duncan Taylor, AGS) is assigned board tasks and emailed about
    // them, and is not given shifts in a Sài Gòn club.
    on_rota: body.on_rota === true,
  }
  const { data, error } = await sb.from('team_members').insert(row).select('id, display_name').single()
  if (error) return NextResponse.json({ error: 'Could not add them.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id, display_name: data.display_name })
}

// Standing somebody down, bringing them back, or fixing what they are called.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { team_member_id, active, display_name, role_title, on_rota } = await req.json().catch(() => ({}))
  if (typeof team_member_id !== 'string') return NextResponse.json({ error: 'Pick a person.' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof active === 'boolean') patch.active = active
  if (typeof on_rota === 'boolean') patch.on_rota = on_rota
  if (display_name !== undefined) {
    const v = clean(display_name)
    if (v.length < 2) return NextResponse.json({ error: 'Give them a name.' }, { status: 400 })
    patch.display_name = v
  }
  if (role_title !== undefined) patch.role_title = clean(role_title, 80) || null
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })

  const { error } = await svc().from('team_members').update(patch).eq('id', team_member_id)
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
