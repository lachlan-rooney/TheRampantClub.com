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
]

export const DEMO_MEMBERS_BY_NUMBER: Record<string, DemoMember> =
  Object.fromEntries(DEMO_MEMBERS.map(m => [m.member_number, m]))
