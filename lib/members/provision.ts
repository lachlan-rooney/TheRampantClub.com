import type { SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// GIVE A NEW MEMBER THEIR WAY IN.
// ───────────────────────────────────────────────────────────────────────────
// Called at the moment someone signs the agreement, which is the only point
// where all three facts exist at once: a verified email they typed themselves,
// a member_no on the invitation, and an event that happens once per person.
//
// Extracted rather than inlined so the test drives THIS, not a copy of it. A
// test against a reimplementation proves the reimplementation.
export type Provision =
  | { ok: true; account_id: string; created: boolean; adopted: boolean }
  | { ok: false; error: string }

export async function provisionMemberAccount(
  sb: SupabaseClient,
  { email, fullName, memberNo }: { email: string; fullName?: string | null; memberNo: string },
): Promise<Provision> {
  try {
    // IDEMPOTENT FIRST. Signing twice, or a retry after a timeout, must not make
    // a second account or refuse the member — so an existing link is a success,
    // not a conflict.
    const { data: already } = await sb.from('profiles')
      .select('id').eq('member_no', memberNo).maybeSingle()
    if (already) return { ok: true, account_id: already.id, created: false, adopted: false }

    const { data: made, error: mkErr } = await sb.auth.admin.createUser({
      email, email_confirm: true,
      user_metadata: { full_name: fullName || null, member_no: memberNo },
    })

    let uid = made?.user?.id || null
    let adopted = false
    if (mkErr) {
      // Already registered — they had a login before joining, or this is a
      // second signature from a different device. Adopt it. Failing a member at
      // the moment they join because their address is known is the wrong answer.
      if (!/already|registered|exists/i.test(mkErr.message)) return { ok: false, error: mkErr.message }
      const { data: list, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 })
      if (listErr) return { ok: false, error: listErr.message }
      uid = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id || null
      adopted = true
      if (!uid) return { ok: false, error: 'email is registered but the account could not be found' }
    }
    if (!uid) return { ok: false, error: 'no account id returned' }

    // ONE MEMBERSHIP, ONE ACCOUNT — the same refusal the linking screen makes.
    // Two people sharing a dossier is the worst thing this system can do.
    const { data: clash } = await sb.from('profiles')
      .select('id, member_no').eq('id', uid).maybeSingle()
    if (clash?.member_no && clash.member_no !== memberNo) {
      return { ok: false, error: `that account is already linked to ${clash.member_no}` }
    }

    const { error: linkErr } = await sb.from('profiles').update({ member_no: memberNo }).eq('id', uid)
    if (linkErr) return { ok: false, error: linkErr.message }

    return { ok: true, account_id: uid, created: !adopted, adopted }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
