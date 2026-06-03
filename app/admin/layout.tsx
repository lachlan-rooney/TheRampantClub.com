import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminNav from './_nav/AdminNav'
import NotificationBell from '@/components/admin/NotificationBell'

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
      <AdminNav />
      <NotificationBell />
      <main style={{
        marginLeft: 240, flex: 1, minWidth: 0, minHeight: '100vh', background: '#052E20',
        padding: '48px 40px',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
        <div style={{
          marginTop: 48,
          paddingTop: 16,
          textAlign: 'right',
          borderTop: '1px solid rgba(229,212,194,0.06)',
          fontFamily: "'Google Sans Code', monospace", fontSize: 9,
          color: '#7E7864', letterSpacing: '0.08em',
        }}>
          Licensed from LR Growth Solutions PTE LTD
        </div>
      </main>
    </div>
    </>
  )
}
