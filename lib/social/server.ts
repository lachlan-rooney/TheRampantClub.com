import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ── The S1 social write layer ───────────────────────────────────────────────
// The substrate has NO member INSERT policies by design — these helpers + the
// route handlers are the ONLY write path. Every route: authenticate → authorise
// → validate → rate-limit → write → emit(spine) → notify. Identity always comes
// from the SESSION (auth.uid()), never a client-sent id.

export const svc = (): SupabaseClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

export interface Actor {
  sb: SupabaseClient   // the cookie-session client — used for spine emit so actor = this user
  id: string           // auth.uid()
  memberNo: string | null
  isAdmin: boolean
}

// Resolve the caller from their session. Returns null if not signed in.
export async function getActor(): Promise<Actor | null> {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: prof } = await svc().from('profiles').select('member_no, is_admin').eq('id', user.id).maybeSingle()
  return { sb, id: user.id, memberNo: prof?.member_no ?? null, isAdmin: !!prof?.is_admin }
}

// Emit a social event onto the spine (activity_events, project_id null). Runs via
// the SESSION client so actor = auth.uid() = this user (ops_emit_event stamps
// auth.uid(), which is null under service-role). Best-effort — never blocks a write.
export async function socialEmit(
  sb: SupabaseClient, verb: string, objectType: string, objectId: string | null, metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await sb.rpc('ops_emit_event', {
      p_verb: verb, p_object_type: objectType, p_object_id: objectId, p_project_id: null, p_metadata: metadata,
    })
  } catch { /* spine emit is best-effort */ }
}

// Write an in-app notification (service-role; notifications has no INSERT policy).
// Payload hygiene: a generic label + click-through link ONLY — never a message body.
export async function notify(
  a: SupabaseClient, recipient: string, type: string, metadata: Record<string, unknown>
): Promise<void> {
  await a.from('notifications').insert({ recipient, type, metadata, email_status: 'in_app_only' })
}

// Count-rows rate-limit: messages by this sender in the last hour. Trivial at TRC's
// scale; no rate_limits table. Returns true when the sender is under the ceiling.
export async function rateLimitOk(a: SupabaseClient, sender: string, maxPerHour = 40): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('messages').select('id', { count: 'exact', head: true })
    .eq('sender', sender).gte('created_at', since)
  return (count ?? 0) < maxPerHour
}
