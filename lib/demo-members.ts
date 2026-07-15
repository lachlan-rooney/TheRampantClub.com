// Hardcoded demo members — not present in the Google Sheet roster.
// Used for showing the kiosk + card system off without polluting the real
// member fetcher. Remove an entry once the person is added to the Sheet.

export interface DemoMember {
  member_number: string
  full_name: string
  tier: string
}

export const DEMO_MEMBERS: DemoMember[] = [
  { member_number: 'DEMO-001', full_name: 'Shawn Smith', tier: 'Demo' },
  // Temp roster entry so a card can be linked before he's added to the Sheet.
  // Auto-skipped once TRC-M004 appears in the Sheet (dedup by member_number).
  { member_number: 'TRC-M004', full_name: 'Nguyen Van Binh', tier: 'Legacy' },
]

export const DEMO_MEMBERS_BY_NUMBER: Record<string, DemoMember> =
  Object.fromEntries(DEMO_MEMBERS.map(m => [m.member_number, m]))

// Shape the demo member to match a Google Sheet row so it slots into anything
// that already consumes that format (admin card lookup, etc.).
export function demoAsSheetMember(memberNumber: string): Record<string, string> | null {
  const dm = DEMO_MEMBERS_BY_NUMBER[memberNumber]
  if (!dm) return null
  const [first, ...rest] = dm.full_name.split(' ')
  return {
    'Member No.': dm.member_number,
    'Full Name': dm.full_name,
    'First Name': first || '',
    'Last Name': rest.join(' '),
    'Tier': dm.tier,
  }
}
