import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'
import { doorClock } from '@/lib/guests'

// WHAT THE FLOOR NEEDS, AND THE TWO LINES THAT ARE NOT FOR MEMBERS.
//
// ── WHY THE PROCESS TEXT IS SERVED RATHER THAN RENDERED ───────────────────
// It used to be written into app/kiosk/staff/page.tsx, which means it shipped
// in the client bundle: anybody who could load that page on an enrolled tablet
// could read the club's 20% margin and which card pays for the food WITHOUT
// ever passing the PIN screen. The PIN was a UI gate on text that had already
// been downloaded. It now comes from here, and only for a caller who has one.
//
// ── THE STAFF COOKIE IS NOT A SIGNATURE ───────────────────────────────────
// lib/kiosk/server documents it plainly: trc_kiosk_staff holds a bare, unsigned
// team_members id, and the door flow re-verifies the PIN on every real decision
// because of it. So this route does not trust the cookie's contents either — it
// checks the id against team_members and requires the row to be ACTIVE and to
// have a PIN set. That turns "any string" into "a real member of staff who
// could have logged in", which is the most this cookie can honestly support.
//
// It is still not a hard boundary, and should not be asked to carry anything
// worse than a margin: no member PII, no grievance notes, no card numbers.

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await deviceOk())) {
    return NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })
  }
  const id = await actingStaffId()
  if (!id) return NextResponse.json({ error: 'Sign in first.' }, { status: 403 })

  const sb = svc()

  // The cookie names somebody — is that somebody real, and still on the team?
  const { data: who } = await sb.from('team_members')
    .select('id, display_name, is_active, pin_hash')
    .eq('id', id).maybeSingle()
  if (!who || who.is_active === false || !who.pin_hash) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 403 })
  }

  // The same service date the door and the board use: the small hours belong to
  // the evening before, so a 1am shift is still "tonight".
  const { serviceDate } = doorClock()

  const { data: shifts } = await sb.from('rota_shifts')
    .select('shift_name, member, start_time, end_time')
    .eq('shift_date', serviceDate)
  const ids = [...new Set((shifts ?? []).map(s => s.member))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: tm } = await sb.from('team_members').select('id, display_name').in('id', ids)
    for (const m of tm ?? []) names.set(m.id, m.display_name)
  }
  const onShift = (shifts ?? [])
    .map(s => ({
      name: names.get(s.member) ?? '—',
      shift: s.shift_name as string,
      start: (s.start_time as string | null) ?? null,
      end: (s.end_time as string | null) ?? null,
      isMe: s.member === id,
    }))
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '') || a.name.localeCompare(b.name))

  return NextResponse.json({
    staff: { id: who.id, name: who.display_name },
    date: serviceDate,
    onShift,
    process: PROCESS,
    shiftRules: SHIFT_RULES,
  })
}

// ── THE SHIFT TIMES, from 2026-09-21 ───────────────────────────────────────
// The owner set these and they apply seven days a week: "Open is now at 2pm…
// From 2-3 they must set up the bar as quick as possible, then report to Miss
// Chau for dayshift requirements that day. The other shifts will begin at 3pm."
// Saturday and Sunday take the 2pm start too, because the club opens at 3pm
// every day of the week.
//
// It lives here rather than in a notice on a wall because the tablet is the
// thing a floor member of staff actually looks at, and a rule nobody can find
// is a rule nobody follows.

const SHIFT_RULES = {
  title: { en: 'Shift times', vn: 'Giờ làm việc' },
  rows: [
    { shift: 'Open', time: '14:00 – 22:00',
      en: 'In at 2pm. Set the bar up as quickly as you can, then report to Miss Châu at 3pm for the day’s requirements. One person a day, seven days a week.',
      vn: 'Có mặt lúc 14:00. Chuẩn bị quầy bar nhanh nhất có thể, sau đó báo cáo chị Châu lúc 15:00 để nhận yêu cầu trong ngày. Mỗi ngày một người, cả bảy ngày.' },
    { shift: 'Close', time: '15:00 – 00:00',
      en: 'In at 3pm, when the doors open. Through to midnight.',
      vn: 'Có mặt lúc 15:00, khi câu lạc bộ mở cửa. Làm đến nửa đêm.' },
    { shift: 'Office', time: '—',
      en: 'Office staff only — Miss Ni and Miss Châu. Nobody on the floor is rostered to the office any more.',
      vn: 'Chỉ dành cho nhân viên văn phòng — chị Ni và chị Châu. Nhân viên phục vụ không còn ca văn phòng.' },
  ],
  footnote: { en: 'The club opens at 3pm and closes at midnight, seven days a week.',
              vn: 'Câu lạc bộ mở cửa lúc 15:00 và đóng cửa lúc nửa đêm, cả bảy ngày.' },
}

// ── The process, as the owner wrote it ─────────────────────────────────────
// Bilingual because it names Miss Lan and the kitchen: the people who most need
// to read it are not the people most likely to read English.

const PROCESS = {
  steps: [
    { en: 'Take the order from the guest — work from the choices they confirmed on the tablet, not from memory.',
      vn: 'Nhận yêu cầu từ khách — theo đúng các món khách đã xác nhận trên máy tính bảng, không dựa vào trí nhớ.' },
    { en: 'Order from the restaurant on Zalo, or call them.',
      vn: 'Đặt món với nhà hàng qua Zalo, hoặc gọi điện.' },
    { en: 'Collect it — or ask Miss Lan to go for it.',
      vn: 'Đi lấy món — hoặc nhờ chị Lan đi lấy giúp.' },
    { en: 'Pay with the Silver credit card (Rượu Ngon). Get the red invoice using our company details.',
      vn: 'Thanh toán bằng thẻ tín dụng Silver (Rượu Ngon). Lấy hoá đơn đỏ theo thông tin công ty.' },
    { en: 'Plate it up nicely in the kitchen.',
      vn: 'Bày biện món ăn đẹp mắt tại bếp.' },
    { en: 'Present it to the member.',
      vn: 'Phục vụ khách.' },
    { en: 'Miss Châu invoices them next week. Nothing is paid at the table.',
      vn: 'Chị Châu sẽ xuất hoá đơn vào tuần sau. Khách không thanh toán tại bàn.' },
  ],
  notes: [
    { lead_en: 'Do not add anything to the price.',
      lead_vn: 'Không cộng thêm gì vào giá.',
      en: 'The club’s 20% is already built into what the tablet shows.',
      vn: 'Giá hiển thị trên máy tính bảng đã bao gồm 20% của câu lạc bộ.' },
    { lead_en: 'The 100,000₫ plating fee is per head, and only if they bring their own food.',
      lead_vn: 'Phí bày biện 100.000₫/người, chỉ áp dụng khi khách mang đồ ăn riêng.',
      en: 'A member who orders through us does not pay it.',
      vn: 'Khách đặt món qua câu lạc bộ thì không phải trả phí này.' },
  ],
  footnote: { en: 'This process is being refined next week.',
              vn: 'Quy trình sẽ được hoàn thiện vào tuần sau.' },
}
