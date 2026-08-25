'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// Persistent bottom navigation for phone widths — so the four most-used member
// destinations are one tap away instead of three (diamond → group → link). The
// full menu still lives behind the diamond. Hidden on desktop/tablet via CSS.

const TABS = [
  { href: '/members',            glyph: '◈', label: 'Home' },
  { href: '/members/whisky',     glyph: '❖', label: 'Library' },
  { href: '/members/snug',       glyph: '☕', label: 'Snug' },
  { href: '/members/concierge',  glyph: '✉', label: 'Concierge' },
]

export default function BottomTabBar() {
  const pathname = usePathname() || ''
  const [conciergeUnread, setConciergeUnread] = useState(0)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('recipient', data.user.id).eq('type', 'concierge_reply').eq('read', false)
        .then(({ count }) => setConciergeUnread(count || 0))
    })
  }, [pathname])

  // Hide on the chat pages — they have their own bottom-anchored composer the
  // bar would overlap. The diamond menu still covers navigation there.
  const HIDE_ON = ['/members/concierge', '/members/messages']
  if (HIDE_ON.some(h => pathname === h || pathname.startsWith(h + '/'))) return null

  const isActive = (href: string) =>
    href === '/members' ? pathname === '/members' : (pathname === href || pathname.startsWith(href + '/'))

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .mtab-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 8998;
          display: none;
          background: rgba(4, 38, 26, 0.92);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid rgba(229, 212, 194, 0.10);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .mtab-inner { display: flex; }
        .mtab {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 9px 0 8px; text-decoration: none; position: relative;
          color: #8A8472; transition: color 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .mtab:active { transform: scale(0.94); }
        .mtab.is-active { color: #D4B85A; }
        .mtab-glyph { font-family: 'Rampant Sans', serif; font-size: 18px; line-height: 1; }
        .mtab-label { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.08em; }
        .mtab-dot {
          position: absolute; top: 6px; left: 50%; margin-left: 6px;
          min-width: 15px; height: 15px; padding: 0 4px; border-radius: 8px;
          background: #D4B85A; color: #052E20;
          font-family: 'Google Sans Code', monospace; font-size: 8px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        @media (max-width: 768px) { .mtab-bar { display: block; } }
      ` }} />
      <nav className="mtab-bar" aria-label="Member navigation">
        <div className="mtab-inner">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mtab ${isActive(t.href) ? 'is-active' : ''}`}>
              <span className="mtab-glyph" aria-hidden>{t.glyph}</span>
              <span className="mtab-label">{t.label}</span>
              {t.href === '/members/concierge' && conciergeUnread > 0 && (
                <span className="mtab-dot">{conciergeUnread > 9 ? '9+' : conciergeUnread}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
