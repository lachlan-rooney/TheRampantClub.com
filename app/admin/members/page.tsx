'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

interface Member {
  id: string
  email: string
  display_name: string | null
  member_number: number | null
  admitted_at: string | null
  locker_number: string | null
  preferred_dram: string | null
  is_admin: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Member>>({})

  const supabase = createBrowserSupabaseClient()

  const load = async () => {
    const { data } = await supabase.from('member_list').select('*').order('member_number', { ascending: true, nullsFirst: false })
    if (data) setMembers(data as Member[])
  }

  useEffect(() => { load() }, [])

  const expand = (m: Member) => {
    if (expandedId === m.id) { setExpandedId(null); return }
    setExpandedId(m.id)
    setEditValues({
      member_number: m.member_number,
      admitted_at: m.admitted_at,
      locker_number: m.locker_number,
      is_admin: m.is_admin,
    })
  }

  const save = async (id: string) => {
    await supabase.from('profiles').update({
      member_number: editValues.member_number || null,
      admitted_at: editValues.admitted_at || null,
      locker_number: editValues.locker_number || null,
      is_admin: editValues.is_admin ?? false,
    }).eq('id', id)
    setExpandedId(null)
    load()
  }

  return (
    <>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 24 }}>
        Members
      </h1>

      <div>
        {members.map(m => (
          <div key={m.id} style={{ borderBottom: '1px solid rgba(229,212,194,0.08)' }}>
            <div
              onClick={() => expand(m)}
              style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', minWidth: 36 }}>
                  {m.member_number ? `#${String(m.member_number).padStart(3, '0')}` : '—'}
                </span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>
                  {m.display_name || m.email}
                </span>
                {m.display_name && (
                  <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>{m.email}</span>
                )}
                {m.is_admin && (
                  <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#E5D4C2', background: 'rgba(229,212,194,0.1)', borderRadius: 4, padding: '2px 8px' }}>Admin</span>
                )}
              </div>
              <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98' }}>
                {m.admitted_at ? new Date(m.admitted_at).toLocaleDateString() : '—'}
              </span>
            </div>

            {expandedId === m.id && (
              <div style={{ padding: '0 0 20px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={labelStyle}>Member Number</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={editValues.member_number ?? ''}
                    onChange={e => setEditValues(v => ({ ...v, member_number: e.target.value ? parseInt(e.target.value) : null }))}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={labelStyle}>Admitted</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={editValues.admitted_at || ''}
                    onChange={e => setEditValues(v => ({ ...v, admitted_at: e.target.value || null }))}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={labelStyle}>Locker Number</label>
                  <input
                    style={inputStyle}
                    value={editValues.locker_number || ''}
                    onChange={e => setEditValues(v => ({ ...v, locker_number: e.target.value || null }))}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={editValues.is_admin ?? false}
                      onChange={e => setEditValues(v => ({ ...v, is_admin: e.target.checked }))}
                    />
                    Admin
                  </label>
                </div>
                <div style={{ width: '100%' }}>
                  <button
                    onClick={() => save(m.id)}
                    style={{
                      background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
                      borderRadius: 6, padding: '8px 20px', cursor: 'pointer',
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
