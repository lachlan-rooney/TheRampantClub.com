'use client'

import Link from 'next/link'
import ActivityFeed from '../ActivityFeed'

const FAMILY = "'Google Sans Code', monospace"

export default function OpsActivityPage() {
  return (
    <>
      <Link href="/admin/ops" style={backLink}>← Boards</Link>
      <div style={{ margin: '8px 0 4px' }}>
        <div style={eyebrow}>Operations Hub</div>
        <h1 style={pageTitle}>Activity</h1>
      </div>
      <p style={lede}>
        Who did what, across every board — newest first. Each line is a record of what was true
        at the time it happened; renaming or deleting a card later doesn’t rewrite its history.
      </p>
      <div style={{ marginTop: 20 }}>
        <ActivityFeed />
      </div>
    </>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }
const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', textDecoration: 'none', opacity: 0.7 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: 0 }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720, margin: '8px 0 0' }
