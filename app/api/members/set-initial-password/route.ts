import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/members/set-initial-password { password }
// The forced first-login password change. The member is signed in with their
// temp password; this sets a new one AND clears the must_change_password flag
// (app_metadata — admin-only, so the member can't clear it any other way and
// can't skip the change). Both happen here, service-side, atomically.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  // Must be the signed-in member themselves (cookie session).
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: { password?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const password = String(body.password || '')
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

  const sb = svc()
  // Merge app_metadata so we only flip the flag, preserving provider info etc.
  const existingMeta = (user.app_metadata || {}) as Record<string, unknown>
  const { error } = await sb.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...existingMeta, must_change_password: false },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
