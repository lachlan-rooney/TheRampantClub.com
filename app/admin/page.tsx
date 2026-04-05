import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient()

  const [members, notices, whiskies, fixtures] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('notices').select('*', { count: 'exact', head: true }),
    supabase.from('whiskies').select('*', { count: 'exact', head: true }).eq('in_stock', true),
    supabase.from('fixtures').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString()),
  ])

  const stats = [
    { label: 'Members', value: members.count ?? 0 },
    { label: 'Notices', value: notices.count ?? 0 },
    { label: 'Whiskies in Stock', value: whiskies.count ?? 0 },
    { label: 'Upcoming Fixtures', value: fixtures.count ?? 0 },
  ]

  return (
    <>
      <h1 style={{
        fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500,
        color: '#E5D4C2', marginBottom: 32, letterSpacing: '0.04em',
      }}>
        Dashboard
      </h1>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16,
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: 'rgba(229,212,194,0.06)', borderRadius: 8, padding: 24,
          }}>
            <div style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
              color: '#E5D4C2', marginBottom: 4,
            }}>
              {s.value}
            </div>
            <div style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
              color: '#B2AA98', letterSpacing: '0.04em',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
