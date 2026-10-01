import type { SupabaseClient } from '@supabase/supabase-js'

// WRITING DOWN THE ANSWER — without ON CONFLICT.
//
// gallery_prompts is "asked once per member per thing", where the thing is a
// gallery event OR a fixture, exactly one (db/gallery_nudge.sql). That is
// enforced by two PARTIAL unique indexes:
//
//   (member, event_id)   where event_id   is not null
//   (member, fixture_id) where fixture_id is not null
//
// ── AND POSTGRES WILL NOT INFER A PARTIAL INDEX ───────────────────────────
// `on_conflict=member,fixture_id` is refused outright:
//
//   42P10 — there is no unique or exclusion constraint matching the
//           ON CONFLICT specification
//
// Conflict-target inference needs the index's predicate to be implied by the
// statement, and Postgres will not prove that for `where fixture_id is not
// null`. So every upsert failed, the route returned 500, and NOTHING was ever
// written — the nudge asked, took the answer, and forgot it.
//
// It went unnoticed because the harness checked that the prompt stopped being
// raised but never checked the WRITE. Absence is not presence.
//
// ── THE FIX IS HERE, NOT IN THE SCHEMA ────────────────────────────────────
// The partial indexes say exactly what is true and are worth keeping: a plain
// unique index would also work (NULLs are distinct by default) but it would
// claim to constrain rows it does not. So the read-then-write happens here
// instead, in one place both callers share.
//
// The race — two tabs answering the same prompt at once — is closed by the
// index, not by this function: a duplicate insert raises 23505 and that is
// treated as SUCCESS, because it means the answer is already recorded. The
// only way to lose is to treat "somebody beat me to it" as a failure.

export type PromptOutcome = 'posted' | 'dismissed'

interface Target { member: string; eventId?: string | null; fixtureId?: string | null }

/**
 * Record that this member has answered the prompt for this event or fixture.
 *
 * 'posted' wins over 'dismissed': somebody who said not-this-time and later put
 * a photograph up has posted, and the row is the record of what happened rather
 * than of what they first said. The reverse never overwrites.
 *
 * Returns true when the answer is on record — including when it already was.
 */
export async function recordPrompt(
  a: SupabaseClient,
  { member, eventId = null, fixtureId = null }: Target,
  outcome: PromptOutcome,
): Promise<boolean> {
  // Exactly one target, the same rule the CHECK constraint enforces. Asserted
  // here too so a caller bug is a refusal rather than a 400 from Postgres.
  if ((eventId === null) === (fixtureId === null)) return false

  const col = eventId ? 'event_id' : 'fixture_id'
  const val = eventId ?? fixtureId

  const { data: existing } = await a.from('gallery_prompts')
    .select('outcome').eq('member', member).eq(col, val).maybeSingle()

  if (existing) {
    if (existing.outcome === outcome || existing.outcome === 'posted') return true
    const { error } = await a.from('gallery_prompts')
      .update({ outcome, decided_at: new Date().toISOString() })
      .eq('member', member).eq(col, val)
    return !error
  }

  const { error } = await a.from('gallery_prompts')
    .insert({ member, [col]: val, outcome })
  // 23505 — another tab got there first. The answer is recorded; that is all
  // this function was asked to achieve.
  if (error && (error.code === '23505' || /duplicate key/i.test(error.message || ''))) return true
  return !error
}
