'use client'

import OpenOrders from '@/components/menus/OpenOrders'
import { useLang } from '@/lib/lang'

// ROOM ORDERS, FOR A MANAGER ON A LAPTOP.
//
// The same list the floor sees on the staff tablet (components/menus/
// OpenOrders) — one component, so the floor and the office can never be
// looking at different versions of the same order. What a manager gets that
// the floor does not is distance: they can place or clear an order without
// walking to the room.

export default function AdminOrdersPage() {
  const { t } = useLang()
  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ fontFamily: "'Rampant Sans', Georgia, serif", fontSize: 32, color: '#E5D4C2', margin: '0 0 8px' }}>
        {t('Room orders', 'Yêu cầu gọi món')}
      </h1>
      <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12.5, lineHeight: 1.85,
                  color: 'rgba(229,212,194,.55)', maxWidth: '62ch', margin: '0 0 28px' }}>
        {t('What each room has asked for on its tablet. Nothing here is charged — an order is a written record so the team can read it back correctly. Members still call a server with the button on their table.',
           'Những gì mỗi phòng đã gọi trên máy tính bảng. Không có khoản thanh toán nào ở đây — yêu cầu chỉ là bản ghi để nhân viên đọc lại cho đúng. Hội viên vẫn gọi nhân viên bằng nút trên bàn.')}
      </p>
      <OpenOrders source="admin" heading={false} />
    </div>
  )
}
