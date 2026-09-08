import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliseName, nameTokens } from './names'

// A key no member can hold (real numbers are TRC-M###). Unresolvable attempts are
// logged against this rather than against a member, so a name matching several
// people — or nobody — can never accumulate failures against anyone real.
export const SENTINEL = '------------'

/** Members should not have to type "TRC-M". Accepts 1 · 001 · M1 · TRC-M001. */
export function normaliseMemberNo(raw: string): string {
  const v = raw.trim().toUpperCase().replace(/\s+/g, '')
  const digits = v.replace(/^TRC-?M?/, '').replace(/^M/, '')
  if (/^\d{1,3}$/.test(digits)) return `TRC-M${digits.padStart(3, '0')}`
  return v
}

/**
 * Who is this, exactly? Returns one member_no, or null.
 *
 * EXACTLY ONE is the whole point. The defect this replaces checked a code against
 * every member a name token matched and recorded each failure against all of them,
 * so wrong guesses at a tablet locked out everyone sharing a surname — including
 * the member who knew their code. Resolution now happens BEFORE verification and
 * an ambiguous name resolves to nothing, so it can neither authenticate nor
 * accumulate failures against anybody.
 *
 * Shared by sign-in and reset deliberately: a reset that resolved differently
 * from a sign-in could email several members because a surname matched, which
 * tells three people that someone tried to get into their account.
 */
export async function resolveMember(who: string, a: SupabaseClient): Promise<string | null> {
  const asNo = normaliseMemberNo(who)
  if (/^TRC-M\d{3}$/.test(asNo)) return asNo

  const needle = normaliseName(who)
  if (needle.length >= 2) {
    const { data: all } = await a.from('members').select('member_no, full_name, nickname')
    const hits = (all || []).filter(m => nameTokens(m.full_name, m.nickname).includes(needle))
    if (hits.length === 1) return hits[0].member_no      // two matches is as good as none
  }

  const literal = who.trim().toUpperCase()
  if (/^[A-Z0-9-]{1,12}$/.test(literal) && literal !== SENTINEL) return literal
  return null
}
