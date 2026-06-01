import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/observatory/realtime-check
//
// Probes the Supabase Realtime publication and reports which of the tables
// Panel 4 cares about will actually fire postgres_changes events. The client
// uses this as one of two transport signals (the other being whether its
// channel subscription reaches the SUBSCRIBED state within a timeout).
//
// Honest probe: queries pg_publication_tables for membership in the
// supabase_realtime publication. If the publication doesn't exist or no
// tables are listed, the page falls back to a 15s setInterval poll.

export const dynamic = 'force-dynamic'

const PROBE_TABLES = ['validation_events', 'preferences', 'learned_decay_constants']

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  // Use an RPC if available, else a raw SELECT via the postgres_rest path is
  // not exposed to the service role for pg_publication_tables. Fall back to
  // a tiny RPC that the migrations could install; if it doesn't exist, return
  // "unknown" so the client picks the fallback transport on its own.
  //
  // Simpler robust path: just attempt a SELECT against information_schema for
  // existence of the publication, then assume the standard supabase_realtime
  // publication includes all tables by default (Supabase's default behaviour).
  // If the call errors, we report "unknown" and let the client probe by
  // subscription timeout.

  let probeRows: { table_name: string; enabled: boolean }[] | null = null
  try {
    const probe = await sb.rpc('observatory_realtime_check')
    if (!probe.error && Array.isArray(probe.data)) {
      probeRows = probe.data as { table_name: string; enabled: boolean }[]
    }
  } catch { /* probe RPC not installed — fall through */ }

  if (probeRows) {
    const enabledTables = probeRows.filter(r => r.enabled).map(r => r.table_name)
    const allWatched = PROBE_TABLES.every(t => enabledTables.includes(t))
    return NextResponse.json({
      probe: 'rpc',
      publication_visible: true,
      tables: PROBE_TABLES.map(t => ({ table: t, enabled: enabledTables.includes(t) })),
      summary: allWatched ? 'all watched tables published' : 'some tables not in supabase_realtime',
    })
  }

  // RPC not installed — return "unknown" with a hint. The client's
  // subscription-timeout probe is then the source of truth.
  return NextResponse.json({
    probe: 'rpc-unavailable',
    publication_visible: false,
    tables: PROBE_TABLES.map(t => ({ table: t, enabled: null })),
    summary: 'realtime publication membership unknown (no probe RPC); client will detect via subscription timeout.',
    install_hint: 'create an SQL function `observatory_realtime_check()` returning (table_name text, enabled bool) over pg_publication_tables where pubname = \'supabase_realtime\' to make this probe authoritative.',
  })
}
