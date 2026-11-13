import { NextResponse } from 'next/server'
import { deviceOk, actingStaff, denyDevice, denyStaff, svc } from '@/lib/kiosk/server'
import { deviceEvent } from '@/lib/popup/event'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE TABLET SHOWS ON SCREEN ONE.
// ───────────────────────────────────────────────────────────────────────────
// The sessions still to come, soonest first, with places left. Served through
// popup_public(), which returns no name, no email and no ticket code — so even
// though this route sits behind the staff PIN, the shape it hands the browser
// could be shown to anybody.
//
// ⚠ SESSIONS ALREADY STARTED ARE NOT IN IT. That is enforced in the function,
// not here: the list always opens on the next one with room, and a guest
// cannot book a time that has been and gone however stale the tablet's screen.
// ═══════════════════════════════════════════════════════════════════════════



// ── CAN A FIELD BE SAVED AT ALL? ─────────────────────────────────────────
// ⚠ A FIELD THAT CANNOT BE STORED IS NOT SHOWN. The phone field went live
// before db/popup_phone.sql was run: it took a number from a guest, the write
// failed on a missing column, and nobody was told — not the guest, not the
// staff member, not the owner. Asking somebody for their number and dropping
// it is worse than not asking.
//
// So the screen is told what the database can actually hold, and renders
// accordingly. Cached, because this is polled every eight seconds by every
// phone and the answer changes once in the life of the system.
let phoneReady: { at: number; ok: boolean } | null = null
async function phoneColumnExists(a: ReturnType<typeof svc>): Promise<boolean> {
  if (phoneReady && Date.now() - phoneReady.at < 60_000) return phoneReady.ok
  const { error } = await a.from('popup_bookings').select('phone').limit(1)
  const ok = !error
  phoneReady = { at: Date.now(), ok }
  return ok
}

export async function GET() {
  if (!(await deviceOk())) return denyDevice()
  const staff = await actingStaff()
  if (!staff) return denyStaff()

  const a = svc()
  // Which evening THIS handset is on — the real one, or practice if the run
  // sheet has switched it. See lib/popup/event.
  const ev = await deviceEvent()
  if (!ev) {
    return NextResponse.json({ error: 'No pop-up is set up.', hint: 'Has db/popup_timed_entry.sql been run?' }, { status: 500 })
  }

  const { data: sessions, error } = await a.rpc('popup_public', { p_slug: ev.slug })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    event: {
      title_en: ev.title_en, title_vn: ev.title_vn,
      venue_en: ev.venue_en, venue_vn: ev.venue_vn,
      session_minutes: ev.session_minutes,
      party_max: ev.party_max,
      published: ev.published,
      paused: ev.bookings_paused,
      practice: ev.is_practice,
      slug: ev.slug,
      default_cap: ev.default_cap,
      // What the form may ask for. See phoneColumnExists above.
      phone_ready: await phoneColumnExists(a),
    },
    // Empty while unpublished — the tablet shows "ask a member of staff"
    // rather than an empty list pretending the evening is full.
    sessions: sessions ?? [],
    now: new Date().toISOString(),
    staff: staff.name,
  })
}
