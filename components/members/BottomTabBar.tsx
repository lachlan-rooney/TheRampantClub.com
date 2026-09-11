'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useLang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'

// Persistent bottom navigation for phone widths — so the four most-used member
// destinations are one tap away instead of three (diamond → group → link). The
// full menu still lives behind the diamond. Hidden on desktop/tablet via CSS.
//
// Icons are a single consistent line-icon set (SVG, currentColor) — never a mix
// of emoji + glyphs.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const ICONS: Record<string, ReactNode> = {
  home: <svg width="25" height="25" viewBox="0 0 24 24" {...S}><path d="M3 11 12 4l9 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg>,
  library: <svg width="25" height="25" viewBox="0 0 24 24" {...S}><path d="M4 5h6a2 2 0 0 1 2 2v12a2.5 2.5 0 0 0-2.5-1.6H4z" /><path d="M20 5h-6a2 2 0 0 0-2 2v12a2.5 2.5 0 0 1 2.5-1.6H20z" /></svg>,
  snug: <svg width="25" height="25" viewBox="0 0 24 24" {...S}><path d="M6.5 4h11l-1.1 14.3A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.7z" /><path d="M7.1 9.5h9.8" /></svg>,
  concierge: <svg width="25" height="25" viewBox="0 0 24 24" {...S}><rect x="3.5" y="6" width="17" height="12" rx="1.6" /><path d="M4.2 7.2 12 13l7.8-5.8" /></svg>,
}

const TABS = [
  // Labels come from lib/members/surfaces.ts so they cannot drift from the rest
  // of the portal, and they follow the EN/VN switch. 'Home' is not a surface in
  // that registry — it is the dashboard — so it carries its own pair.
  { href: '/members',            icon: 'home',      label: 'Home', vn: 'Trang Chính' },
  { href: '/members/whisky',     icon: 'library',   label: 'Library' },
  { href: '/members/snug',       icon: 'snug',      label: 'Snug' },
  { href: '/members/concierge',  icon: 'concierge', label: 'Concierge' },
]

export default function BottomTabBar() {
  const pathname = usePathname() || ''
  const { lang } = useLang()
  // The registry holds both languages; 'Home' is the dashboard and is not a
  // surface in it, so it carries its own pair inline above.
  const labelFor = (t: { href: string; label: string; vn?: string }) =>
    lang === 'vn' ? (t.vn || surfaceName(t.href, 'vn') || t.label) : (surfaceName(t.href, 'en') || t.label)
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
        /* The house's green, one cream hairline above, and the tab you are on
           marked the way /studio marks its artists — a gold rule, not a pill. */
        .mtab-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 8998;
          display: none;
          background: rgba(5, 46, 32, 0.96);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid rgba(229, 212, 194, 0.16);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .mtab-inner { display: flex; }
        .mtab {
          flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 5px;
          padding: 12px 2px 11px; text-decoration: none; position: relative;
          color: rgba(229, 212, 194, 0.72); transition: color 0.2s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .mtab::before {
          content: ''; position: absolute; top: -1px; left: 26%; right: 26%; height: 2px; background: #D4B85A;
          transform: scaleX(0); transition: transform .35s cubic-bezier(.16,.84,.44,1);
        }
        .mtab:active { transform: scale(0.94); }
        .mtab.is-active { color: #D4B85A; }
        .mtab.is-active::before { transform: scaleX(1); }
        .mtab-icon { display: flex; align-items: center; justify-content: center; height: 25px; }
        .mtab-label { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.03em;
                      line-height: 1.25; text-align: center; max-width: 100%; }
        .mtab-dot {
          position: absolute; top: 8px; left: 50%; margin-left: 8px;
          min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
          background: #D4B85A; color: #052E20;
          font-family: 'Google Sans Code', monospace; font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        @media (max-width: 768px) { .mtab-bar { display: block; } }
        @media (prefers-reduced-motion: reduce) { .mtab, .mtab::before { transition: none; } }
      ` }} />
      <nav className="mtab-bar" aria-label="Member navigation">
        <div className="mtab-inner">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={`mtab ${isActive(t.href) ? 'is-active' : ''}`}>
              <span className="mtab-icon" aria-hidden>{ICONS[t.icon]}</span>
              <span className="mtab-label">{labelFor(t)}</span>
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
