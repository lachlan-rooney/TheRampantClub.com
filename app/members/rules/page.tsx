'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { HouseRule } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

export default function RulesPage() {
  const [rules, setRules] = useState<HouseRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('house_rules').select('*').order('sort_order')
      .then(({ data }) => { if (data) setRules(data); setLoading(false) })
  }, [])

  return (
    <>
      <NavOverlay variant="members" dark />
      <MemberPage
        title="House Rules"
        subtitle="Nội Quy Câu Lạc Bộ"
        description="The following rules are observed by all members of The Rampant Club. Ignorance is not a defence, though it is occasionally an explanation."
      >
        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading...</p>
        ) : (
          rules.map((r, i) => (
            <div key={r.id}>
              <div>
                <h3 style={{
                  fontFamily: "'Rampant Sans', serif", fontSize: 17, fontWeight: 600,
                  color: '#E5D4C2', marginBottom: 4, margin: 0,
                }}>
                  {r.section_title}
                </h3>
                {r.section_title_vn && (
                  <div style={{
                    fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                    color: 'rgba(178,170,152,0.5)', letterSpacing: '0.04em', marginBottom: 16,
                  }}>
                    {r.section_title_vn}
                  </div>
                )}
                <p style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                  color: '#B2AA98', lineHeight: 1.85, margin: 0,
                }}>
                  {r.body}
                </p>
              </div>
              {i < rules.length - 1 && (
                <div style={{
                  width: 8, height: 8, background: '#E5D4C2',
                  transform: 'rotate(45deg)', opacity: 0.15, margin: '40px auto',
                }} />
              )}
            </div>
          ))
        )}

        <div style={{
          width: 8, height: 8, background: '#E5D4C2',
          transform: 'rotate(45deg)', opacity: 0.15, margin: '48px auto 32px',
        }} />

        <div style={{ textAlign: 'center' }}>
          <Link
            href="/members/terms"
            style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
              color: '#B2AA98', opacity: 0.5, textDecoration: 'none', letterSpacing: '0.04em',
            }}
          >
            Full Terms & Conditions →
          </Link>
        </div>
      </MemberPage>
    </>
  )
}
