import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminNav from './_nav/AdminNav'

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
      <main style={{
        marginLeft: 240, flex: 1, minHeight: '100vh', background: '#052E20',
        padding: '48px 40px',
      }}>
        {children}
      </main>
      <div style={{
        position: 'fixed', right: 16, bottom: 12, zIndex: 90,
        padding: '4px 10px',
        background: 'rgba(5,46,32,0.85)',
        border: '1px solid rgba(229,212,194,0.10)',
        borderRadius: 4,
        fontFamily: "'Google Sans Code', monospace", fontSize: 9,
        color: '#7E7864', letterSpacing: '0.08em',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
      }}>
        Licensed from LR Growth Solutions PTE LTD
      </div>
    </div>
    </>
  )
}
