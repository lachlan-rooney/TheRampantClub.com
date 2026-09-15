import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// THE COMPASS FAMILIES, FOR A FINDER WITH NO LOGIN (2026-09-15).
//
// flavour_categories is readable only when signed in ("read flavour_categories"
// → auth.uid() is not null, db/whisky_flavour_tags.sql). The public finders —
// /cup/finder and the floor tablets' /kiosk/finder — have no session, so reading
// the table from the browser returned ZERO rows with no error and the page sat on
// "Loading the compass…" forever. It had been doing that on the live /cup/finder.
//
// The 16 family names are the wheel's labels, not member data, so they are served
// here from the server instead of loosening the table's policy. Same columns and
// filter as fetchCategories(); the members' finder keeps reading under its session.

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await sb.from('flavour_categories')
    .select('slug,name,sort_order').not('quadrant', 'is', null).order('sort_order')
  if (error || !data?.length) return NextResponse.json({ cats: [] }, { status: 503 })
  return NextResponse.json({ cats: data }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } })
}
