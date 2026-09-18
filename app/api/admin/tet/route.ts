import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// EVERYTHING THE INTERNAL TẾT PAGE NEEDS, IN ONE CALL.
//
// Admin-gated and service-role: this is the side of the programme the browser
// on /tet may never see — the enquiries with their contact details, and the
// list of what is still a placeholder.
//
// The quote itself is a separate route, because it is a POST and because the
// margin it returns deserves a boundary of its own.

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  // Each guarded: a missing migration should cost that panel, not the page.
  const [provisional, countdown, audit, enquiries, casks, products, tiers] = await Promise.all([
    sb.rpc('tet_is_provisional').then(r => r.data ?? null, () => null),
    sb.rpc('tet_countdown').then(r => r.data ?? null, () => null),
    sb.rpc('tet_placeholder_audit').then(r => r.data ?? [], () => []),
    sb.from('tet_enquiries').select('reference, company_name, contact_name, contact_email, contact_phone, kind, cask_ref, message, status, created_at')
      .order('created_at', { ascending: false }).limit(50).then(r => r.data ?? [], () => []),
    sb.from('tet_casks').select('cask_ref, distillery, region, age_years, abv_pct, status, is_placeholder, display_order')
      .eq('is_active', true).order('display_order').then(r => r.data ?? [], () => []),
    sb.from('tet_products').select('sku, name_en, expression, uk_list_price_gbp, is_placeholder')
      .eq('is_active', true).order('display_order').then(r => r.data ?? [], () => []),
    sb.from('tet_volume_tiers').select('label_en, min_bottles, max_bottles, discount_pct, sleeve_price_vnd')
      .order('min_bottles').then(r => r.data ?? [], () => []),
  ])

  return NextResponse.json({ provisional, countdown, audit, enquiries, casks, products, tiers })
}
