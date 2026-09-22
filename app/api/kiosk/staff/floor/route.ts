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

// ── THE SHIFT TIMES, from 2026-09-22 ───────────────────────────────────────
// The new rota rules, after the staff's letter about working days and rest
// days: four 8-hour shifts, five shifts and two rest days a week, and a close
// that runs to 00:30 instead of ending the minute the club shuts.
//
// The 21 September instruction still applies to whoever is in first: in at
// 14:00, bar set up by 15:00, then report to Miss Châu for the day's
// requirements. S1 is the 14:00 shift, so it carries that line.
//
// The new rota went live from 14:13 on Tuesday 22 September — the owner's
// "start fresh today" — so the changeover line that told staff to keep to
// their old times until it was published has come off.
//
// It no longer says "five shifts a week" either. DUTY (side jobs) is off for
// now, and a DUTY day is left unrostered, so most weeks are four shifts. The
// footnote states only what holds every week.
//
// Hours are called weekly hours, never anything the employment agreements
// state: the agreements state no hours at all.

const SHIFT_RULES = {
  title: { en: 'Shift times', vn: 'Giờ làm việc' },
  rows: [
    { shift: 'S1', time: '14:00 – 22:00',
      en: 'Set-up, early trade and peak. In at 2pm, bar set up by 3pm, then report to Miss Châu for the day’s requirements.',
      vn: 'Chuẩn bị, đầu ca và giờ cao điểm. Có mặt lúc 14:00, chuẩn bị quầy bar xong trước 15:00, sau đó báo cáo chị Châu để nhận yêu cầu trong ngày.' },
    { shift: 'S2', time: '15:30 – 23:30',
      en: 'Early trade through to late.',
      vn: 'Từ đầu ca đến khuya.' },
    { shift: 'S3', time: '16:30 – 00:30',
      en: 'Peak, late trade and close-down. The supervisor on duty closes — close-down is inside the shift, not after it.',
      vn: 'Giờ cao điểm, khuya và đóng cửa. Người trực ca đóng cửa — việc đóng cửa nằm trong ca, không làm ngoài giờ.' },
    { shift: 'S4', time: '16:00 – 00:00',
      en: 'Peak cover, Tuesday to Friday only.',
      vn: 'Tăng cường giờ cao điểm, chỉ từ Thứ Ba đến Thứ Sáu.' },
    { shift: 'Office', time: '—',
      en: 'Office staff only — Miss Ni and Miss Châu.',
      vn: 'Chỉ dành cho nhân viên văn phòng — chị Ni và chị Châu.' },
  ],
  footnote: {
    en: 'Every shift is 8 hours, with at least two rest days a week. The 30-minute break is inside the shift and paid. Your shifts are on the rota.',
    vn: 'Mỗi ca 8 tiếng, mỗi tuần ít nhất hai ngày nghỉ. 30 phút nghỉ giải lao nằm trong ca và được tính lương. Ca của bạn có trên lịch làm việc.',
  },
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
