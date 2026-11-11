import type { SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// TELLING SOMEBODY — the two ways the auction reaches the staff.
// ───────────────────────────────────────────────────────────────────────────
// The auction is open to the public with no sign-in, on an evening when the
// people who run it are in the room rather than at a screen. So anything that
// goes wrong, and every sales enquiry, has to find a person.
//
// ══ WHO "SOMEBODY" IS ═════════════════════════════════════════════════════
// Not "every admin". There are five admin logins, and an enquiry on a
// US$1,950 canvas is a sales lead that needs ONE owner — five recipients is
// five people each assuming another has replied. Two environment variables
// decide it, checked in this order:
//
//   1 · DEV_ALERT_ONLY_TO   One address. Lives in .env.local, which never
//                           reaches Vercel, so it gates THIS MACHINE only.
//                           Test runs file real enquiries through the real
//                           route; without this, each run emailed all five
//                           admins, which is exactly what happened on
//                           11 Nov 2026 before the gate existed.
//
//   2 · AUCTION_ALERT_TO    The named list for the live auction, comma
//                           separated. Set on Vercel. This is the one that
//                           decides who is told on the night.
//
//   3 · neither set         Every admin, the original behaviour. Kept as the
//                           fallback so a missing variable fails LOUD — five
//                           people get told — rather than silent, where a
//                           typo'd variable would mean nobody is told at all
//                           and the first anyone knows is a lost sale.
//
// Both the email and the in-app bell follow the same list. A bell that rings
// for someone who gets no email, or the reverse, is how an alert gets missed.
// ═══════════════════════════════════════════════════════════════════════════

const split = (v: string | undefined) =>
  (v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

/**
 * The addresses to tell, or `null` for "every admin".
 * Exported so a test can assert the routing without sending anything.
 */
export function alertRecipients(): string[] | null {
  const dev = split(process.env.DEV_ALERT_ONLY_TO)
  if (dev.length) return dev
  const named = split(process.env.AUCTION_ALERT_TO)
  if (named.length) return named
  return null
}

/**
 * An in-app notification for the people above. BEST EFFORT, ALWAYS: an alert
 * that can fail the thing it is reporting on is worse than no alert, so every
 * failure here is swallowed deliberately.
 *
 * `in_app_only` because these are technical alerts and the email sweep has
 * quiet hours — the bell is immediate and the opening is in the evening.
 */
export async function alertAdmins(
  a: SupabaseClient,
  label: string,
  metadata: Record<string, unknown>,
  link = '/admin/studio/auction',
): Promise<void> {
  try {
    const list = alertRecipients()
    let { data } = await a.from('profiles').select('id').eq('is_admin', true)

    if (list) {
      // Keep only the admins whose login is on the list, so the bell rings for
      // exactly the people who also get the email.
      const keep: { id: string }[] = []
      for (const p of data || []) {
        try {
          const { data: u } = await a.auth.admin.getUserById(p.id)
          const e = u?.user?.email?.toLowerCase()
          if (e && list.includes(e)) keep.push(p)
        } catch { /* an admin we cannot resolve is simply not on the list */ }
      }
      data = keep
    }

    for (const p of data || []) {
      await a.from('notifications').insert({
        recipient: p.id,
        type: 'auction_problem',
        metadata: { label, link, ...metadata },
        email_status: 'in_app_only',
      })
    }
  } catch { /* an alert must never be the thing that breaks a bid */ }
}

/**
 * The addresses to email. ⚠ Admin addresses live in auth.users, not in
 * profiles — profiles has no email column — so the fallback needs the service
 * role and the admin API, the same source /api/admin/members reads.
 *
 * Returns an empty list rather than throwing: a caller that cannot email
 * anybody must still be able to record what happened.
 */
export async function adminEmails(a: SupabaseClient, cap = 20): Promise<string[]> {
  // ⚠ THE LIST WINS, BEFORE ANY LOOKUP. Returning early matters: it means no
  // change to the profiles query or the admin API can later reopen this and
  // put auction mail back in front of five people.
  const list = alertRecipients()
  if (list) return list.slice(0, cap)

  const out: string[] = []
  try {
    const { data } = await a.from('profiles').select('id').eq('is_admin', true).limit(cap)
    for (const p of data || []) {
      try {
        const { data: u } = await a.auth.admin.getUserById(p.id)
        const e = u?.user?.email
        if (e && !out.includes(e)) out.push(e)
      } catch { /* one admin without a login is not a failure */ }
    }
  } catch { /* nor is a profiles read that fails */ }
  return out
}
