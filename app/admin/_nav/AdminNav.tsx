'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Grouped admin sidebar. Groups remember their collapsed state in localStorage.
// The Dashboard sits above the groups as a single landing link.

type Item = { href: string; label: string; icon: string }
type Group = { id: string; label: string; items: Item[] }

// Reorganised by TEAM (2026-08): On-Site (floor/service), Membership,
// Cellar & Whisky, Sports & Events, Management. Renamed the two confusing
// duplicates — "User Roster" → "Access & Logins", ops "Reports" → "Ops Reports".
const DASHBOARD: Item = { href: '/admin', label: 'Dashboard', icon: 'grid' }

const GROUPS: Group[] = [
  {
    id: 'onsite',
    label: 'On-Site',
    items: [
      { href: '/admin/tonight', label: 'Tonight', icon: 'moon' },
      { href: '/admin/mx-daily', label: 'MX Daily', icon: 'clipboard' },
      { href: '/admin/checklists', label: 'Checklists', icon: 'checklist' },
      { href: '/admin/quickref', label: 'Quick Reference', icon: 'book' },
      { href: '/admin/cards', label: 'Member Cards', icon: 'card' },
      { href: '/admin/concierge', label: 'Concierge', icon: 'bell' },
      { href: '/admin/notices', label: 'Notices', icon: 'megaphone' },
      { href: '/admin/calendar', label: 'Calendar', icon: 'calendar' },
      { href: '/admin/harmony', label: 'Harmony Log', icon: 'heart' },
      { href: '/admin/snug', label: 'The Snug', icon: 'cup' },
      { href: '/admin/introductions', label: 'Introductions', icon: 'people' },
    ],
  },
  {
    id: 'membership',
    label: 'Membership',
    items: [
      { href: '/admin/mis/pipeline', label: 'Pipeline', icon: 'funnel' },
      { href: '/admin/mis', label: 'Members', icon: 'users' },
      { href: '/admin/mis/candidates', label: 'Pref Candidates', icon: 'star' },
      { href: '/admin/agreements', label: 'Agreements', icon: 'signature' },
      { href: '/admin/membership', label: 'Membership Finance', icon: 'receipt' },
      { href: '/admin/newsletters', label: 'Newsletter', icon: 'megaphone' },
      { href: '/admin/gifts', label: 'Gifting', icon: 'gift' },
      { href: '/admin/observatory', label: 'Observatory', icon: 'eye' },
      { href: '/admin/decay-fit', label: 'Decay Fit', icon: 'trend' },
    ],
  },
  {
    id: 'cellar',
    label: 'Cellar & Whisky',
    items: [
      { href: '/admin/whisky', label: 'Inventory', icon: 'bottle' },
      { href: '/admin/lockers', label: 'Lockers', icon: 'lock' },
      { href: '/admin/whisky/flavour-review', label: 'Flavour Review', icon: 'flask' },
    ],
  },
  {
    id: 'sports',
    label: 'Sports & Events',
    items: [
      { href: '/admin/fixtures', label: 'Fixtures', icon: 'trophy' },
      { href: '/admin/gallery', label: 'Event Gallery', icon: 'image' },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { href: '/admin/ops', label: 'Boards', icon: 'boards' },
      { href: '/admin/ops/rota', label: 'Rota', icon: 'rota' },
      { href: '/admin/ops/reports', label: 'Ops Reports', icon: 'bars' },
      { href: '/admin/reports', label: 'Weekly Report', icon: 'doc' },
      { href: '/admin/ops/activity', label: 'Activity', icon: 'pulse' },
      { href: '/admin/tier-budgets', label: 'Tier Budgets', icon: 'layers' },
      { href: '/admin/training', label: 'Training', icon: 'cap' },
      { href: '/admin/rules', label: 'House Rules', icon: 'rules' },
      { href: '/admin/journal', label: 'Journal', icon: 'pen' },
      { href: '/admin/press', label: 'Press', icon: 'news' },
      { href: '/admin/kiosk', label: 'Kiosk', icon: 'tablet' },
      { href: '/admin/members', label: 'Access & Logins', icon: 'badge' },
    ],
  },
]

// Minimal monochrome line icons (inner SVG markup; stroke inherited). One
// consistent set — no emoji.
const ICONS: Record<string, string> = {
  grid: '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  image: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.1"/><path d="M2.5 11.5l3.2-3 2.3 2 2.2-2.4 3.3 3.4"/>',
  moon: '<path d="M13 9.3A5.3 5.3 0 116.7 3 4.3 4.3 0 0013 9.3z"/>',
  clipboard: '<rect x="3.5" y="3" width="9" height="11" rx="1.5"/><path d="M6 3.2V2.2h4v1M6 7h4M6 10h4"/>',
  checklist: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5.2 8l1.8 1.8L11 5.6"/>',
  book: '<path d="M8 4C6.5 3 4 3 2.5 3.7v8.6C4 11.6 6.5 11.6 8 12.6c1.5-1 4-1 5.5-.3V3.7C12 3 9.5 3 8 4z"/><path d="M8 4v8.6"/>',
  card: '<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2 6.8h12M4.3 9.6h3"/>',
  bell: '<path d="M4.2 7a3.8 3.8 0 017.6 0c0 2.8 1 3.7 1 3.7H3.2s1-.9 1-3.7z"/><path d="M6.6 12.6a1.5 1.5 0 002.8 0"/>',
  megaphone: '<path d="M3 6.8l7-2.8v8L3 9.2z"/><path d="M3 6.8H2v2.4h1M5 9.9v2.3a1 1 0 002 0v-1.4"/><path d="M12 5.5a2.2 2.2 0 010 5"/>',
  calendar: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.2h12M5.5 2v2M10.5 2v2"/>',
  heart: '<path d="M8 13S3.2 10 3.2 6.4A2.6 2.6 0 018 4.2a2.6 2.6 0 014.8 2.2C12.8 10 8 13 8 13z"/>',
  cup: '<path d="M4 4.5h7v3.5a3 3 0 01-3 3H7a3 3 0 01-3-3z"/><path d="M11 5.5h1.6a1.5 1.5 0 010 3H11"/><path d="M4 13.5h7"/>',
  people: '<circle cx="6" cy="6" r="2.1"/><path d="M2.6 13a3.4 3.4 0 016.8 0"/><path d="M11 4.4a2 2 0 010 3.9M11.6 13a3.3 3.3 0 00-1.1-2.4"/>',
  funnel: '<path d="M2.5 3.5h11l-4.2 4.8v4.2l-2.6-1.3V8.3z"/>',
  users: '<circle cx="6" cy="6" r="2.2"/><path d="M2.3 13a3.7 3.7 0 017.4 0"/><path d="M11 4.4a2.1 2.1 0 010 4M11.7 13a3.6 3.6 0 00-1.1-2.5"/>',
  star: '<path d="M8 2.6l1.6 3.2 3.5.5-2.6 2.5.6 3.5L8 10.6l-3.1 1.7.6-3.5L2.9 6.3l3.5-.5z"/>',
  signature: '<path d="M4 2.5h5l3 3v6H4z"/><path d="M9 2.5v3h3"/><path d="M5.5 13.4s.9-1 1.9-.5 1.5 1 2.6.5"/>',
  receipt: '<path d="M4 2.4h8v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1z"/><path d="M6.4 6h3.2M6.4 8.4h3.2"/>',
  gift: '<rect x="2.6" y="6" width="10.8" height="7.4" rx="1"/><path d="M2 6h12M8 6v7.4M5.6 6a1.7 1.7 0 110-3.4C7 2.6 8 6 8 6M10.4 6a1.7 1.7 0 100-3.4C9 2.6 8 6 8 6"/>',
  eye: '<path d="M1.6 8s2.4-4.3 6.4-4.3S14.4 8 14.4 8 12 12.3 8 12.3 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="1.7"/>',
  trend: '<path d="M2 5l4 4 2.5-2.5L14 12"/><path d="M14 8.5V12h-3.5"/>',
  bottle: '<path d="M6.6 2.2h2.8v1.8l1 2v7.3a1.4 1.4 0 01-1.4 1.4H7a1.4 1.4 0 01-1.4-1.4V6l1-2z"/>',
  lock: '<rect x="3.4" y="7" width="9.2" height="6.6" rx="1.4"/><path d="M5.4 7V5.2a2.6 2.6 0 015.2 0V7"/>',
  flask: '<path d="M6.5 2.2v3.5L3.5 12a1.2 1.2 0 001.1 1.7h6.8A1.2 1.2 0 0012.5 12L9.5 5.7V2.2"/><path d="M6 2.2h4M5.3 9h5.4"/>',
  trophy: '<path d="M5 3h6v3a3 3 0 01-6 0z"/><path d="M5 4H3.2v1a2 2 0 002 2M11 4h1.8v1a2 2 0 01-2 2M7.2 9.2v1.6M5.6 13.4h4.8M6.6 13.4v-1.8h2.8v1.8"/>',
  boards: '<rect x="2.2" y="2.5" width="3.2" height="11" rx="1"/><rect x="6.4" y="2.5" width="3.2" height="11" rx="1"/><rect x="10.6" y="2.5" width="3.2" height="7.5" rx="1"/>',
  rota: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.2h12M5.5 2v2M10.5 2v2M8 8.5v2l1.4.9"/>',
  bars: '<path d="M2.5 13.5h11"/><rect x="3.5" y="8" width="2.3" height="4"/><rect x="7" y="5" width="2.3" height="7"/><rect x="10.5" y="9.5" width="2.3" height="2.5"/>',
  doc: '<path d="M4 2.2h5l3 3v8.6H4z"/><path d="M9 2.2v3h3M6 8h4M6 10.5h4"/>',
  pulse: '<path d="M2 8h3l1.8-4.5L9.5 12l1.8-4h2.7"/>',
  layers: '<path d="M8 2.4l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3M2 10.6l6 3 6-3"/>',
  cap: '<path d="M8 3l6 2.4-6 2.4-6-2.4z"/><path d="M4 6.4v3.1c0 1.1 1.9 2 4 2s4-.9 4-2V6.4M14 5.4v3.4"/>',
  rules: '<rect x="3" y="2.4" width="10" height="11.2" rx="1.5"/><path d="M5.6 5.8h4.8M5.6 8.2h4.8M5.6 10.6h3"/>',
  pen: '<path d="M10.8 2.4l2.8 2.8L6 12.8l-3.2.5.5-3.2z"/><path d="M9.7 3.5l2.8 2.8"/>',
  news: '<rect x="2" y="3" width="12" height="10" rx="1"/><path d="M4.5 6h5M4.5 8.4h5M4.5 10.8h3M11 6h1.5v4.8H11z"/>',
  tablet: '<rect x="4" y="2" width="8" height="12" rx="1.5"/><path d="M7 12h2"/>',
  badge: '<rect x="3" y="2.5" width="10" height="11" rx="1.5"/><circle cx="8" cy="6.4" r="1.6"/><path d="M5.6 11a2.5 2.5 0 014.8 0M6.5 2.5h3"/>',
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.grid }} aria-hidden />
  )
}

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
          <NavIcon name={DASHBOARD.icon} />{DASHBOARD.label}
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
                        paddingLeft: 20,
                      }}
                    >
                      <NavIcon name={it.icon} />{it.label}
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
  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 24px', textDecoration: 'none',
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
