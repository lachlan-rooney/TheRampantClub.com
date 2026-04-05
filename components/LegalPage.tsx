'use client'

import { useEffect, useState, ReactNode } from 'react'
import NavOverlay from '@/components/NavOverlay'

interface LegalPageProps {
  title: string
  subtitle: string
  lastUpdated: string
  children: ReactNode
}

export default function LegalPage({ title, subtitle, lastUpdated, children }: LegalPageProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 150) }, [])

  return (
    <>
      <NavOverlay variant="public" />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #E5D4C2 !important; margin: 0; padding: 0; }
      ` }} />

      {/* Grain overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
      }} />

      <div style={{
        minHeight: '100vh',
        background: '#E5D4C2',
        padding: '120px 40px 80px',
      }}>
        <div style={{
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* Title */}
          <div style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 400,
            color: '#052E20',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>
            {title}
          </div>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 13,
            color: '#7A7462',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}>
            {subtitle}
          </p>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 10,
            color: '#7A7462',
            textAlign: 'center',
            letterSpacing: '0.04em',
            opacity: 0.6,
            marginBottom: 12,
          }}>
            Last updated: {lastUpdated}
          </p>

          {/* Diamond */}
          <div style={{
            width: 8, height: 8,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.25,
            margin: '0 auto 48px',
          }} />

          {/* Content */}
          <div>
            {children}
          </div>

          {/* Bottom diamond */}
          <div style={{
            width: 6, height: 6,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.2,
            margin: '64px auto 28px',
          }} />
          <p style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 13,
            fontWeight: 400,
            color: '#052E20',
            letterSpacing: '0.06em',
            lineHeight: 1.8,
            opacity: 0.3,
            textAlign: 'center',
          }}>
            74A/2 Hai Bà Trưng<br />
            TP. HCM, Việt Nam
          </p>
        </div>
      </div>
    </>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: "'Rampant Sans', 'Playfair Display', serif",
        fontSize: 17,
        fontWeight: 400,
        color: '#052E20',
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: '1px solid rgba(178,170,152,0.25)',
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontFamily: "'Google Sans Code', 'DM Mono', monospace",
      fontSize: 12,
      lineHeight: 1.85,
      color: '#7A7462',
      marginBottom: 14,
      letterSpacing: '0.01em',
    }}>
      {children}
    </p>
  )
}
