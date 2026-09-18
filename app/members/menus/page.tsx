'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import EmptyState from '@/components/members/EmptyState'
import MenuBoard from '@/components/menus/MenuBoard'
import { readMenus } from '@/lib/menus/read'
import { SURFACE } from '@/lib/members/surfaces'
import type { MenuVenueGroup } from '@/lib/menus/types'

// THE MENUS, IN A MEMBER'S HAND.
//
// Read straight from the two public views under the member's own session —
// there is no service-role route behind this page, because there is nothing on
// it a member is not allowed to see. What they are not allowed to see (what the
// restaurant charges us) is not in the views at all.
//
// The old /menus page is a different thing and stays where it is: that is the
// floor menus as PDFs, for the public. This is what the club is actually
// serving tonight.

export default function MemberMenusPage() {
  const { t } = useLang()
  const [venues, setVenues] = useState<MenuVenueGroup[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    readMenus(createBrowserSupabaseClient())
      .then(d => { if (live) setVenues(d.venues) })
      .catch(e => { if (live) setErr(String(e?.message || e)) })
    return () => { live = false }
  }, [])

  return (
    <MemberPage
      title="Menus"
      subtitle={SURFACE['/members/menus'].vn}
      description={t(
        'Small dishes to share from the kitchens upstairs, and the set menus cooked in our dining room.',
        'Các món nhỏ dùng chung từ những nhà bếp phía trên, và thực đơn cố định được nấu tại phòng ăn của chúng tôi.',
      )}
    >
      {err && (
        <EmptyState
          title={t('The menu could not be loaded', 'Không tải được thực đơn')}
          body={t('Please try again in a moment, or ask any of the team.',
                  'Vui lòng thử lại sau giây lát, hoặc hỏi nhân viên.')}
        />
      )}

      {!err && venues === null && (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, opacity: .5 }}>
          {t('Loading…', 'Đang tải…')}
        </p>
      )}

      {!err && venues !== null && (
        venues.length
          ? <MenuBoard venues={venues} />
          : <EmptyState
              title={t('Nothing on the menu yet', 'Chưa có thực đơn')}
              body={t('The kitchen menus are being agreed with our partner restaurants. They will appear here first.',
                      'Thực đơn đang được thống nhất với các nhà hàng đối tác. Thực đơn sẽ xuất hiện tại đây trước tiên.')}
            />
      )}
    </MemberPage>
  )
}
