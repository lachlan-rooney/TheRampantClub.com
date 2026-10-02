import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminNav from './_nav/AdminNav'
import NotificationBell from '@/components/admin/NotificationBell'
import ActingChip from '@/components/admin/ActingChip'
import LangToggle from '@/components/admin/LangToggle'
import IdleLock from '@/components/admin/IdleLock'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = await isAdmin()
  if (!admin) redirect('/members')

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: `html, body { background: #052E20 !important; }` }} />
    {/* The portal locks itself after five idle minutes, and on returning to a
        laptop that was closed for longer than that. It holds members' details;
        it does not sit open unattended. */}
    <IdleLock />
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminNav />
      {/* className, not only inline: an inline margin cannot be overridden by the
          media query that collapses the sidebar on iPad and phone. */}
      <main className="adm-main" style={{
        marginLeft: 240, flex: 1, minWidth: 0, minHeight: '100vh', background: '#052E20',
        padding: '48px 40px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Bell lives in-flow in its own reserved strip — never floats over content */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <LangToggle />
          <ActingChip />
          <NotificationBell />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
        {/* The licence line — "Licensed from LR Growth Solutions PTE LTD", set
            small and right-aligned at the foot of every admin page — was hidden
            on 2026-06-04 behind `{false && …}` with a note to restore it the
            next day. It stayed hidden for four months, which made it look like
            an oversight rather than a decision.
            REMOVED on the owner's instruction, 2026-10-02. Deleted rather than
            left switched off: a dead branch carrying a date that has passed
            tells the next reader nothing except that somebody forgot. If the
            line is ever wanted back it is this commit's parent — and that is a
            decision about what the club asserts, not a flag to flip. */}
      </main>
    </div>
    </>
  )
}
