'use client'

import { useEffect, useState } from 'react'
import NavOverlay from '@/components/NavOverlay'

export default function PressPage() {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 40px 80px',
      }}>
        <div style={{
          maxWidth: 620,
          width: '100%',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 400,
            color: '#052E20',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>
            Press
          </div>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 13,
            color: '#7A7462',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 12,
          }}>
            Báo chí
          </p>

          {/* Diamond */}
          <div style={{
            width: 8, height: 8,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.25,
            margin: '0 auto 40px',
          }} />

          {/* Intro */}
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 12,
            color: '#7A7462',
            textAlign: 'center',
            lineHeight: 1.8,
            marginBottom: 48,
            maxWidth: 520,
            margin: '0 auto 48px',
          }}>
            Press kits and our latest press releases can be found below. For any further questions or special requests, please contact us at{' '}
            <a href="mailto:Press@TheRampantClub.com" style={{ color: '#052E20', textDecoration: 'none' }}>
              Press@TheRampantClub.com
            </a>
          </p>

          {/* Downloads section */}
          <div style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 20,
            fontWeight: 400,
            color: '#052E20',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 32,
          }}>
            Downloads
          </div>

          {/* Press Kits */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
              fontSize: 16,
              fontWeight: 400,
              color: '#052E20',
              marginBottom: 8,
            }}>
              Press Kits
            </div>
            <p style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              color: '#7A7462',
              lineHeight: 1.7,
              marginBottom: 16,
            }}>
              For our latest press kits, with key details on the club and our offerings across whisky, music, art, and hospitality.
            </p>
            <a href="#" style={{
              display: 'inline-block',
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              color: '#052E20',
              letterSpacing: '0.04em',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(5,46,32,0.2)',
              paddingBottom: 2,
              transition: 'border-color 0.2s',
            }}>
              The Rampant Club Press Kit
            </a>
          </div>

          <div style={{
            height: 1,
            background: 'rgba(178,170,152,0.25)',
            marginBottom: 36,
          }} />

          {/* Press Releases */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              fontFamily: "'Rampant Sans', 'Playfair Display', serif",
              fontSize: 16,
              fontWeight: 400,
              color: '#052E20',
              marginBottom: 8,
            }}>
              Press Releases
            </div>
            <p style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              color: '#7A7462',
              lineHeight: 1.7,
              marginBottom: 16,
            }}>
              Stay up to date with the latest news from The Rampant Club, including updates on the club, events, and exclusive experiences.
            </p>
            <a href="#" style={{
              display: 'inline-block',
              fontFamily: "'Google Sans Code', 'DM Mono', monospace",
              fontSize: 11,
              color: '#052E20',
              letterSpacing: '0.04em',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(5,46,32,0.2)',
              paddingBottom: 2,
              transition: 'border-color 0.2s',
            }}>
              Latest Press Release
            </a>
          </div>

          {/* Diamond */}
          <div style={{
            width: 6, height: 6,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.2,
            margin: '48px auto 32px',
          }} />

          {/* Legal */}
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 10,
            color: '#7A7462',
            textAlign: 'center',
            lineHeight: 1.8,
            maxWidth: 520,
            margin: '0 auto',
            letterSpacing: '0.02em',
          }}>
            All materials provided in this press kit, including images, videos, and written content, are the intellectual property of The Rampant Club. These assets are made available exclusively for editorial and non-commercial use in connection with coverage of The Rampant Club and its activities. Any alteration, unauthorised use, or redistribution of these materials is strictly prohibited. For additional permissions or enquiries, please contact{' '}
            <a href="mailto:Press@TheRampantClub.com" style={{ color: '#052E20', textDecoration: 'none' }}>
              Press@TheRampantClub.com
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
