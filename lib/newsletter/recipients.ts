import type { SupabaseClient } from '@supabase/supabase-js'

// Resolve the newsletter audience: every MEMBER with a login, minus admins and
// any suppressed addresses. Member emails live ONLY in auth.users (never in
// profiles), so this must run server-side under the service-role client. Mirrors
// the join in app/api/admin/members/route.ts.

export interface Recipient { member_no: string; name: string; email: string }

export async function resolveMemberRecipients(
  svc: SupabaseClient,
  suppress: string[] = [],
): Promise<Recipient[]> {
  // Members = a profile linked to a real member_no that is NOT an admin account.
  const { data: profiles } = await svc.from('profiles')
    .select('id, display_name, member_no, is_admin')
    .not('member_no', 'is', null)
    .or('is_admin.is.null,is_admin.eq.false')

  if (!profiles || profiles.length === 0) return []

  // Email lives in auth.users — page through the admin API into a lookup map.
  const emailById = new Map<string, string>()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) if (u.email) emailById.set(u.id, u.email)
    if (data.users.length < 1000) break
  }

  const suppressLc = new Set(suppress.map(s => s.toLowerCase()))
  const seen = new Set<string>()
  const out: Recipient[] = []
  for (const p of profiles) {
    const email = emailById.get(p.id)
    if (!email) continue
    const key = email.toLowerCase()
    if (suppressLc.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push({ member_no: p.member_no as string, name: p.display_name || 'Member', email })
  }
  return out
}
