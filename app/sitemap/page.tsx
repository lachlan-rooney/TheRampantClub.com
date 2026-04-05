'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import NavOverlay from '@/components/NavOverlay'

const SECTIONS = [
  {
    title: 'The Club',
    links: [
      { href: '/', label: 'Home' },
      { href: '/membership', label: 'Membership' },
      { href: '/sports', label: 'The Sports Club' },
      { href: '/kitchen', label: 'The Kitchen' },
      { href: '/press', label: 'Press' },
      { href: '/vacancies', label: 'Staff & Vacancies' },
    ],
  },
  {
    title: 'Members',
    links: [
      { href: '/members', label: 'Dashboard' },
      { href: '/members/events', label: 'Events' },
      { href: '/members/spaces', label: 'Spaces & Menus' },
      { href: '/members/notices', label: 'The Notice Board' },
      { href: '/members/whisky', label: 'The Whisky Library' },
      { href: '/members/fixtures', label: 'T.R.C Sports Fixtures' },
      { href: '/members/profile', label: 'My Membership' },
      { href: '/members/rules', label: 'House Rules' },
      { href: '/members/terms', label: 'Rules of Membership' },
      { href: '/members/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/cookies', label: 'Cookies' },
    ],
  },
]

export default function SitemapPage() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 150) }, [])

  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }
      ` }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat', backgroundSize: '300px',
      }} />
      <div style={{
        minHeight: '100vh', background: '#E5D4C2', padding: '80px 40px 100px',
      }}>
        <div style={{
          maxWidth: 640, width: '100%', margin: '0 auto',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div style={{
            width: 8, height: 8, background: '#5E6650',
            transform: 'rotate(45deg)', opacity: 0.25, margin: '0 auto 32px',
          }} />
          <h1 style={{
            fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
            color: '#052E20', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 48,
          }}>
            Sitemap
          </h1>

          {SECTIONS.map((section, i) => (
            <div key={section.title} style={{ marginBottom: i < SECTIONS.length - 1 ? 40 : 0 }}>
              <h2 style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 600,
                color: '#052E20', letterSpacing: '0.04em', marginBottom: 16,
              }}>
                {section.title}
              </h2>
              {section.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: 'block', padding: '8px 0',
                    fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                    color: '#5E6650', textDecoration: 'none', letterSpacing: '0.02em',
                    borderBottom: '1px solid rgba(5,46,32,0.06)',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
