import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// One client per browser session. Multiple instances fight over the
// "lock:sb-…-auth-token" Web Lock and crash the auth flow.
let browserClient: SupabaseClient | null = null

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
