'use client'

import { ReactNode } from 'react'
import Link from 'next/link'

export default function MemberPage({
  title, subtitle, description, icon, children,
}: {
  title: string
  subtitle: string
  description?: string
  icon?: string
  children: ReactNode
}) {
  // Reveal is a single CSS mount animation (`both` fill) — it begins at
  // opacity 0 and animates in immediately, with NO artificial blank delay and
  // no re-trigger when the page's own data later loads. This replaced a pair of
  // setTimeout(150)/(1000) timers that fought each page's loading flag and
  // produced a two-stage flash on every navigation.
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mp-reveal {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }
        .mp-wrap { min-height: 100vh; background: #052E20; padding: 100px 40px 100px; }
        .mp-inner {
          max-width: 720px; width: 100%; margin: 0 auto;
          animation: mp-reveal 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }
        .mp-back {
          display: inline-block; margin-bottom: 32px;
          font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 11px;
          color: #B2AA98; opacity: 0.85; letter-spacing: 0.06em; text-decoration: none;
          transition: opacity 0.2s ease, color 0.2s ease;
        }
        .mp-back:hover { opacity: 1; color: #D4B85A; }
        @media (max-width: 600px) { .mp-wrap { padding: 84px 20px 72px; } }
        @media (prefers-reduced-motion: reduce) { .mp-inner { animation: none; } }
      ` }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.025,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat', backgroundSize: '300px',
      }} />
      <div className="mp-wrap">
        <div className="mp-inner">
          <Link href="/members" className="mp-back">← Back to dashboard</Link>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" style={{
              display: 'block', width: 80, height: 'auto', margin: '0 auto 24px',
            }} />
          ) : (
            <div style={{
              width: 8, height: 8, background: '#E5D4C2',
              transform: 'rotate(45deg)', opacity: 0.25, margin: '0 auto 32px',
            }} />
          )}
          <h1 style={{
            fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
            color: '#E5D4C2', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 6,
          }}>{title}</h1>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
            color: '#B2AA98', textAlign: 'center', letterSpacing: '0.04em',
            marginBottom: description ? 24 : 48,
          }}>{subtitle}</p>
          {description && (
            <p style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
              fontStyle: 'italic', color: '#B2AA98', textAlign: 'center', lineHeight: 1.7,
              marginBottom: 48, opacity: 0.6, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
            }}>{description}</p>
          )}
          {children}
        </div>
      </div>
    </>
  )
}
