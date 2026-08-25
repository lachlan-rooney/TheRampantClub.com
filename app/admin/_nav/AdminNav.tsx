'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Grouped admin sidebar. Groups remember their collapsed state in localStorage.
// The Dashboard sits above the groups as a single landing link.

type Item = { href: string; label: string }
type Group = { id: string; label: string; items: Item[] }

const DASHBOARD: Item = { href: '/admin', label: 'Dashboard' }

const GROUPS: Group[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/admin/ops', label: 'Boards' },
      { href: '/admin/ops/rota', label: 'Rota' },
      { href: '/admin/ops/reports', label: 'Reports' },
      { href: '/admin/ops/activity', label: 'Activity' },
    ],
  },
  {
    id: 'floor',
    label: 'Floor',
    items: [
      { href: '/admin/concierge', label: 'Concierge' },
      { href: '/admin/snug', label: 'The Snug' },
      { href: '/admin/introductions', label: 'Introductions' },
      { href: '/admin/mx-daily', label: 'MX Daily' },
      { href: '/admin/tonight', label: 'Tonight' },
      { href: '/admin/calendar', label: 'Calendar' },
      { href: '/admin/checklists', label: 'Checklists' },
      { href: '/admin/harmony', label: 'Harmony Log' },
      { href: '/admin/notices', label: 'Notices' },
      { href: '/admin/quickref', label: 'Quick Reference' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { href: '/admin/mis/pipeline', label: 'Pipeline' },
      { href: '/admin/mis', label: 'Members' },
      { href: '/admin/mis/candidates', label: 'Pref Candidates' },
      { href: '/admin/decay-fit', label: 'Decay Fit' },
      { href: '/admin/observatory', label: 'Observatory' },
      { href: '/admin/gifts', label: 'Gifting' },
      { href: '/admin/cards', label: 'Member Cards' },
      { href: '/admin/membership', label: 'Membership Finance' },
      { href: '/admin/agreements', label: 'Agreements' },
    ],
  },
  {
    id: 'whisky',
    label: 'Whisky Library',
    items: [
      { href: '/admin/whisky', label: 'Inventory' },
      { href: '/admin/lockers', label: 'Lockers' },
      { href: '/admin/fixtures', label: 'Fixtures' },
    ],
  },
  {
    id: 'house',
    label: 'House',
    items: [
      { href: '/admin/rules', label: 'House Rules' },
      { href: '/admin/journal', label: 'Journal' },
      { href: '/admin/press', label: 'Press' },
      { href: '/admin/tier-budgets', label: 'Tier Budgets' },
      { href: '/admin/training', label: 'Training' },
      { href: '/admin/kiosk', label: 'Kiosk' },
      { href: '/admin/members', label: 'User Roster' },
    ],
  },
]

export default function AdminNav() {
  const pathname = usePathname() || ''

  // Default: all groups open. Persist per-group collapse.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_nav_collapsed')
      if (raw) setCollapsed(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])
  const toggle = (id: string) => {
    setCollapsed(c => {
      const next = { ...c, [id]: !c[id] }
      try { localStorage.setItem('admin_nav_collapsed', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Pick the single most-specific item that matches the current pathname so
  // overlapping nav prefixes (e.g. /admin/mis vs /admin/mis/pipeline) don't
  // both highlight at the same time.
  const allHrefs = [DASHBOARD.href, ...GROUPS.flatMap(g => g.items.map(it => it.href))]
  const bestMatch = allHrefs
    .filter(h => h === '/admin' ? pathname === '/admin' : (pathname === h || pathname.startsWith(h + '/')))
    .sort((a, b) => b.length - a.length)[0]
  const isActive = (href: string) => href === bestMatch

  return (
    <nav style={navWrap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-mark-cream.svg" alt="" style={logoMark} />
      <div style={brandTitle}>Admin</div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Link href={DASHBOARD.href} style={{ ...itemLink, ...(isActive(DASHBOARD.href) ? itemLinkActive : null), marginBottom: 12 }}>
          {DASHBOARD.label}
        </Link>

        {GROUPS.map(g => {
          const isCollapsed = !!collapsed[g.id]
          const groupActive = g.items.some(it => isActive(it.href))
          return (
            <div key={g.id} style={{ marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                style={{ ...groupHeader, color: groupActive ? '#D4B85A' : '#7E7864' }}
              >
                <span>{g.label}</span>
                <span style={{ opacity: 0.6, fontSize: 9 }}>{isCollapsed ? '▸' : '▾'}</span>
              </button>
              {!isCollapsed && (
                <div>
                  {g.items.map(it => (
                    <Link
                      key={it.href}
                      href={it.href}
                      style={{
                        ...itemLink,
                        ...(isActive(it.href) ? itemLinkActive : null),
                        paddingLeft: 32,
                      }}
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Link href="/members" style={backLink}>
        ← Back to Members
      </Link>
    </nav>
  )
}

const navWrap: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
  background: '#052E20', padding: '32px 0 16px',
  display: 'flex', flexDirection: 'column',
  zIndex: 100,
  borderRight: '1px solid rgba(229,212,194,0.06)',
}
const logoMark: React.CSSProperties = {
  display: 'block', width: 40, height: 'auto', margin: '0 auto 16px', opacity: 0.5,
}
const brandTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
  color: '#E5D4C2', textAlign: 'center', marginBottom: 28, letterSpacing: '0.04em',
}
const groupHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  width: '100%', padding: '10px 24px', background: 'transparent',
  border: 'none', cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 13,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  marginTop: 8,
}
const itemLink: React.CSSProperties = {
  display: 'block', padding: '7px 24px', textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const itemLinkActive: React.CSSProperties = {
  color: '#E5D4C2',
  background: 'rgba(212,184,90,0.10)',
  borderLeft: '2px solid #D4B85A',
  paddingLeft: 22,
}
const backLink: React.CSSProperties = {
  display: 'block', padding: '10px 24px', textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, letterSpacing: '0.04em',
  borderTop: '1px solid rgba(229,212,194,0.06)',
  marginTop: 8,
}
