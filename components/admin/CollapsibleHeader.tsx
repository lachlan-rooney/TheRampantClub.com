'use client'

// Shared collapsible-section header — one component so the "Show / Hide" controls
// (Team roster, Email notifications) are identical and can't drift apart.
const FAMILY = "'Google Sans Code', monospace"

export default function CollapsibleHeader({ title, open, onToggle, count }: {
  title: string
  open: boolean
  onToggle: () => void
  count?: number
}) {
  return (
    <button onClick={onToggle} style={ch}>
      <span style={chTitle}>{title}</span>
      <span style={chHint}>{open ? '▾ hide' : `▸ show${count != null ? ` (${count})` : ''}`}</span>
    </button>
  )
}

const ch: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }
const chTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2' }
const chHint: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98' }
