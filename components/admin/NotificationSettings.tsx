'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import CollapsibleHeader from './CollapsibleHeader'

const FAMILY = "'Google Sans Code', monospace"

// Editable per-type email-worthiness (notification_email_types). Toggle which
// notification types also send email — tune live, no redeploy. In-app delivery
// always happens regardless; this only governs the email channel.
const LABELS: Record<string, string> = {
  task_assigned:  'Task assigned to someone',
  task_completed: 'Task completed',
  task_due_soon:  'Task due tomorrow',
  shift_assigned: 'Shift assigned',
  shift_updated:  'Shift changed',
  shift_removed:  'Shift removed',
}

type Row = { type: string; email_enabled: boolean }

export default function NotificationSettings() {
  const supabase = createBrowserSupabaseClient()
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [savingType, setSavingType] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('notification_email_types').select('*').then(({ data }) => {
      if (data) setRows((data as Row[]).sort((a, b) => a.type.localeCompare(b.type)))
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (r: Row) => {
    setSavingType(r.type)
    const next = !r.email_enabled
    const { error } = await supabase.from('notification_email_types').update({ email_enabled: next }).eq('type', r.type)
    if (!error) setRows(prev => prev.map(x => x.type === r.type ? { ...x, email_enabled: next } : x))
    setSavingType(null)
  }

  return (
    <div>
      <CollapsibleHeader title="Email notifications" open={open} onToggle={() => setOpen(o => !o)} />
      {open && (
        <div style={{ marginTop: 12 }}>
          <p style={{ ...metaText, marginBottom: 12, maxWidth: 520 }}>
            Everyone with a login sees these in the bell. Toggle which also send an email
            (suppressed 21:00–08:00; sent next morning). Notifications only reach people with an
            account — name-only team members don&apos;t get them until they have a login.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 460 }}>
            {rows.map(r => (
              <label key={r.type} style={row}>
                <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12 }}>{LABELS[r.type] || r.type}</span>
                <span style={{ ...metaText, marginLeft: 'auto', marginRight: 10 }}>{r.email_enabled ? 'email + in-app' : 'in-app only'}</span>
                <input
                  type="checkbox"
                  checked={r.email_enabled}
                  disabled={savingType === r.type}
                  onChange={() => toggle(r)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, cursor: 'pointer' }
