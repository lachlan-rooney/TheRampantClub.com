'use client'

import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

// The analytics section's front door. Deliberately thin: it lists what is
// measured, and — the part that matters — what is NOT yet, so nobody reads a
// gap as a zero.
export default function AnalyticsIndex() {
  const { t } = useLang()
  return (
    <main style={wrap}>
      <Link href="/admin" style={back}>← {t('Admin', 'Quản trị')}</Link>
      <h1 style={h1}>{t('Analytics', 'Phân tích')}</h1>
      <p style={lede}>
        {t('Measurement that comes with a prescription. Numbers here are meant to be acted on in the Monday review, not admired.',
           'Số liệu đi kèm hành động. Những con số ở đây dùng cho buổi rà soát thứ Hai, không phải để ngắm.')}
      </p>

      <Link href="/admin/analytics/weekly" style={tile}>
        <span style={tileTag}>{t('Live', 'Đang hoạt động')}</span>
        <span style={tileName}>{t('Weekly Ops Scorecard', 'Bảng điểm vận hành tuần')}</span>
        <span style={tileSub}>
          {t('Overdue work, pipeline stalls, rota coverage, grievances, member reach — each banded and each with an owner.',
             'Việc quá hạn, hồ sơ đứng yên, mức phủ ca, khiếu nại, hội viên đã ghé — mỗi mục có ngưỡng và người phụ trách.')}
        </span>
      </Link>

      <div style={{ ...tile, cursor: 'default', opacity: .72 }}>
        <span style={{ ...tileTag, color: '#8A8575', background: 'rgba(138,133,117,.14)' }}>
          {t('Capturing', 'Đang thu thập')}
        </span>
        <span style={tileName}>{t('Member health over time', 'Sức khoẻ hội viên theo thời gian')}</span>
        <span style={tileSub}>
          {t('A snapshot of every member is written each Monday. Trends need several weeks of snapshots before they say anything, so there is nothing to show yet — by design.',
             'Mỗi thứ Hai hệ thống lưu một ảnh chụp của từng hội viên. Xu hướng cần vài tuần dữ liệu mới có ý nghĩa, nên hiện chưa có gì để hiển thị — đúng như dự kiến.')}
        </span>
      </div>

      <h2 style={h2}>{t('What is not measured', 'Những gì chưa đo được')}</h2>
      <ul style={ul}>
        <li style={li}>
          {t('Arrivals. Roughly one visit a week is recorded, so anything built on visits — reach, frequency, time in club — reads lower than the truth. Capture is the fix, not a different formula.',
             'Lượt ghé. Chỉ khoảng một lượt mỗi tuần được ghi nhận, nên mọi chỉ số dựa trên lượt ghé đều thấp hơn thực tế. Cần ghi nhận đầy đủ, không phải đổi công thức.')}
        </li>
        <li style={li}>
          {t('Spend per member. Charges are recorded; what a member actually spends at the bar is not in this system.',
             'Chi tiêu theo hội viên. Hệ thống ghi các khoản thu, nhưng chi tiêu thực tế tại quầy thì không.')}
        </li>
        <li style={li}>
          {t('Where members came from. Source channel is now captured, but only backfilled for thirteen of eighteen.',
             'Nguồn hội viên. Đã có trường ghi nhận, nhưng chỉ điền được cho 13 trong 18 người.')}
        </li>
      </ul>
    </main>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', Georgia, serif"
const wrap: React.CSSProperties = { padding: '28px clamp(18px,3vw,40px) 80px', maxWidth: 820, margin: '0 auto' }
const back: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A8575', textDecoration: 'none' }
const h1: React.CSSProperties = { fontFamily: SERIF, fontSize: 'clamp(28px,4vw,44px)', color: '#E5D4C2', margin: '10px 0 0', fontWeight: 400 }
const h2: React.CSSProperties = { fontFamily: SERIF, fontSize: 20, color: '#E5D4C2', margin: '40px 0 0', fontWeight: 400 }
const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12.5, lineHeight: 1.8, color: '#B2AA98', margin: '10px 0 26px' }
const tile: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', border: '1px solid rgba(229,212,194,.16)', borderRadius: 10, padding: '20px 22px', marginBottom: 14, textDecoration: 'none', background: 'rgba(229,212,194,.025)' }
const tileTag: React.CSSProperties = { position: 'absolute', top: 16, right: 16, padding: '3px 9px', borderRadius: 3, fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7FA88B', background: 'rgba(127,168,139,.14)' }
const tileName: React.CSSProperties = { fontFamily: SERIF, fontSize: 23, color: '#E5D4C2', paddingRight: 86 }
const tileSub: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, lineHeight: 1.8, color: '#8A8575' }
const ul: React.CSSProperties = { listStyle: 'none', margin: '14px 0 0', padding: 0 }
const li: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, lineHeight: 1.85, color: '#8A8575', padding: '11px 0', borderTop: '1px solid rgba(229,212,194,.1)' }
