export interface Profile {
  id: string
  display_name: string | null
  member_number: number | null
  admitted_at: string | null
  locker_number: string | null
  preferred_dram: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Notice {
  id: string
  title: string
  body: string
  category: 'committee' | 'fixture' | 'general' | 'whisky'
  pinned: boolean
  author: string | null
  created_at: string
  updated_at: string
}

export interface Whisky {
  id: string
  name: string
  distillery: string | null
  region: string | null
  cask_type: string | null
  age: string | null
  abv: string | null
  tasting_notes: string | null
  committees_pick: boolean
  in_stock: boolean
  image_url: string | null
  added_at: string
}

export interface Fixture {
  id: string
  sport: 'golf' | 'tennis' | 'padel' | 'hash' | 'other'
  title: string
  description: string | null
  date: string
  location: string | null
  max_signups: number | null
  signup_deadline: string | null
  results: string | null
  created_at: string
}

export interface FixtureSignup {
  id: string
  fixture_id: string
  user_id: string
  signed_up_at: string
}

export interface HouseRule {
  id: string
  section_title: string
  section_title_vn: string | null
  body: string
  sort_order: number
  updated_at: string
}
