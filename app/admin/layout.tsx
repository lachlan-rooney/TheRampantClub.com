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
    </div>
    </>
  )
}
