'use client'

import { ReactNode, useState, useEffect } from 'react'

export default function MemberPage({
  title, subtitle, description, icon, children,
}: {
  title: string
  subtitle: string
  description?: string
  icon?: string
  children: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    setTimeout(() => setVisible(true), 150)
    setTimeout(() => setAnimated(true), 1000)
  }, [])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.025,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat', backgroundSize: '300px',
      }} />
      <div style={{
        minHeight: '100vh', background: '#052E20', padding: '60px 40px 100px',
      }}>
        <div style={{
          maxWidth: 720, width: '100%', margin: '0 auto',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: animated ? 'none' : 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
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
