'use client'

import { useEffect, useState } from 'react'

const ITEMS = [
  { name: "Phở 'Staff Meal'", note: 'Not on the menu. You know someone.', price: '₫0' },
  { name: "The Chairman's Toast", note: 'White bread. Kerrygold. No questions.', price: '₫35,000' },
  { name: 'Emergency Bánh Mì', note: "For members who've missed dinner. Again.", price: '₫50,000' },
  { name: 'Midnight Indomie', note: 'The real reason the kitchen stays open.', price: '₫20,000' },
  { name: 'One Glass of Milk', note: "Full fat. Don't make it weird.", price: '₫25,000' },
]

export default function KitchenPage() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 100) }, [])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
      }} />

      <div style={{
        minHeight: '100vh',
        background: 'var(--trc-cream, #E5D4C2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease',
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{
            width: 8, height: 8,
            background: '#5E6650',
            transform: 'rotate(45deg)',
            opacity: 0.25,
            margin: '0 auto 32px',
          }} />

          <h1 style={{
            fontFamily: "'Rampant Sans', 'Playfair Display', serif",
            fontSize: 24,
            fontWeight: 500,
            color: '#052E20',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}>
            The Kitchen
          </h1>
          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 11,
            color: '#7A7462',
            textAlign: 'center',
            letterSpacing: '0.04em',
            marginBottom: 48,
          }}>
            You weren&rsquo;t supposed to find this
          </p>

          {ITEMS.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '14px 0',
              borderBottom: '1px solid rgba(178,170,152,0.25)',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Rampant Sans', 'Playfair Display', serif",
                  fontSize: 14,
                  color: '#052E20',
                }}>
                  {item.name}
                </div>
                <div style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                  fontSize: 10,
                  fontStyle: 'italic',
                  color: '#7A7462',
                  marginTop: 3,
                }}>
                  {item.note}
                </div>
              </div>
              <span style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                fontSize: 12,
                color: '#5E6650',
                opacity: 0.7,
                whiteSpace: 'nowrap',
                marginLeft: 20,
              }}>
                {item.price}
              </span>
            </div>
          ))}

          <p style={{
            fontFamily: "'Google Sans Code', 'DM Mono', monospace",
            fontSize: 11,
            color: '#7A7462',
            textAlign: 'center',
            marginTop: 40,
            lineHeight: 1.8,
          }}>
            Available after 11pm. Ring the bell three times.<br />
            The Committee denies all knowledge of this page.
          </p>
        </div>
      </div>
    </>
  )
}
