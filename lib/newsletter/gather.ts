import type { SupabaseClient } from '@supabase/supabase-js'

// Build the FROZEN recap snapshot for a newsletter issue: "this month at the
// club" numbers, the new members to say hello to (by name), and what's coming
// up. Every section is guarded so a missing table never breaks the whole pull.

async function safe<T>(q: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await q; return (data ?? fallback) } catch { return fallback }
}

export interface NewsletterAutoData {
  period: { start: string; end: string; label: string }
  new_members: { member_no: string; name: string; tier: string | null; join_date: string }[]
  stats: { visits: number; unique_members: number; footfall_unique: number; new_member_count: number; events_count: number }
  upcoming: { title: string; date: string; kind: string }[]
  generated_at: string
}

const monthLabel = (start: string) =>
  new Date(start + 'T12:00:00+07:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

export async function gatherRecap(
  svc: SupabaseClient, start: string, end: string, now: string,
): Promise<NewsletterAutoData> {
  // New members this window — names for the "say hello" greeting.
  const newMembers = await safe<{ member_no: string; full_name: string | null; nickname: string | null; tier: string | null; join_date: string }[]>(
    svc.from('members').select('member_no, full_name, nickname, tier, join_date')
      .gte('join_date', start).lte('join_date', end).order('join_date', { ascending: true }), [])

  // Usage this window.
  const visits = await safe<{ member_no: string; visit_date: string }[]>(
    svc.from('visits').select('member_no, visit_date').is('archived_at', null)
      .gte('visit_date', start).lte('visit_date', end), [])
  const presence = await safe<{ member_number: string; seen_at: string }[]>(
    svc.from('card_presence').select('member_number, seen_at')
      .gte('seen_at', start).lte('seen_at', end + 'T23:59:59'), [])

  // Events held this window (member-visible calendar entries + fixtures).
  const heldEntries = await safe<{ id: string }[]>(
    svc.from('calendar_entries').select('id').eq('visibility', 'member')
      .gte('entry_date', start).lte('entry_date', end), [])
  const heldFixtures = await safe<{ id: string }[]>(
    svc.from('fixtures').select('id').gte('date', start).lte('date', end + 'T23:59:59'), [])

  // Upcoming — member-visible entries + fixtures from `now` forward, a handful.
  const upEntries = await safe<{ title: string; entry_date: string; kind: string }[]>(
    svc.from('calendar_entries').select('title, entry_date, kind').eq('visibility', 'member')
      .gte('entry_date', now).order('entry_date', { ascending: true }).limit(8), [])
  const upFixtures = await safe<{ title: string; date: string; sport: string }[]>(
    svc.from('fixtures').select('title, date, sport').gte('date', now)
      .order('date', { ascending: true }).limit(8), [])

  const upcoming = [
    ...upEntries.map(e => ({ title: e.title, date: e.entry_date, kind: e.kind })),
    ...upFixtures.map(f => ({ title: f.title, date: f.date.slice(0, 10), kind: 'fixture' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)

  return {
    period: { start, end, label: monthLabel(start) },
    new_members: newMembers.map(m => ({
      member_no: m.member_no,
      name: m.nickname || m.full_name || 'A new member',
      tier: m.tier,
      join_date: m.join_date,
    })),
    stats: {
      visits: visits.length,
      unique_members: new Set(visits.map(v => v.member_no)).size,
      footfall_unique: new Set(presence.map(p => p.member_number)).size,
      new_member_count: newMembers.length,
      events_count: heldEntries.length + heldFixtures.length,
    },
    upcoming,
    generated_at: now,
  }
}
