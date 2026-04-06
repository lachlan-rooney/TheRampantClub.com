import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/notices', label: 'Notices' },
  { href: '/admin/whisky', label: 'Whisky Library' },
  { href: '/admin/fixtures', label: 'Fixtures' },
  { href: '/admin/rules', label: 'House Rules' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/quickref', label: 'Quick Reference' },
  { href: '/admin/agreements', label: 'Agreements' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = await isAdmin()
  if (!admin) redirect('/members')

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: `html, body { background: #052E20 !important; }` }} />
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 220,
        background: '#052E20', padding: '32px 0', display: 'flex', flexDirection: 'column',
        zIndex: 100,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/PNG/%5BRAMPANT%5D_Logo_Rampants/6.svg" alt="" style={{
          display: 'block', width: 44, height: 'auto', margin: '0 auto 16px', opacity: 0.4,
          filter: 'brightness(0) invert(1)',
        }} />
        <div style={{
          fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
          color: '#E5D4C2', textAlign: 'center', marginBottom: 32, letterSpacing: '0.04em',
        }}>
          Admin
        </div>
        <div style={{ flex: 1 }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} style={{
              display: 'block', padding: '10px 24px', textDecoration: 'none',
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
              color: '#B2AA98', letterSpacing: '0.04em',
            }}>
              {n.label}
            </Link>
          ))}
        </div>
        <Link href="/members" style={{
          display: 'block', padding: '10px 24px', textDecoration: 'none',
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
          color: '#B2AA98', opacity: 0.5, letterSpacing: '0.04em',
        }}>
          ← Back to Members
        </Link>
      </nav>
      <main style={{
        marginLeft: 220, flex: 1, minHeight: '100vh', background: '#052E20',
        padding: '48px 40px',
      }}>
        {children}
      </main>
    </div>
    </>
  )
}
