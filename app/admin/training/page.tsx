'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

// Admin / House / Training
//
// Living team handbook for the CRM (MIS) and the rest of the admin portal.
// Sections are collapsible; bilingual EN ⇄ VN via the toggle.
//
// CONTENT MODEL (review-friendly bilingual):
//   Each section's body is a Block[] — every translatable string carries en + vn
//   side by side, so the Vietnamese is a flat string a reviewer (Miss Châu) can
//   correct without touching JSX. renderBlocks() turns blocks back into the same
//   h4/list/callout look. Inline markup inside any string:
//     **bold**            → <strong>
//     *italic*            → <em>
//     `code`              → <Code>
//     [label](href)       → <Link>
//     {{#RRGGBB:text}}    → coloured <span>
//   Update a section by editing its blocks — edit en + vn together (no drift).
//   The VN is an AI DRAFT until Miss Châu reviews it (see the under-review note
//   shown on the VN view) — do not treat it as authoritative before then.

type Lang = 'en' | 'vn'
type LangStr = { en: string; vn: string }
type ListItem = LangStr & { sub?: LangStr[] }
type Block =
  | { kind: 'p'; en: string; vn: string }
  | { kind: 'h4'; en: string; vn: string }
  | { kind: 'ul'; items: ListItem[] }
  | { kind: 'ol'; items: ListItem[] }
  | { kind: 'callout'; title: LangStr; en: string; vn: string }
  | { kind: 'stages'; items: { name: LangStr; desc: LangStr }[] }

interface SectionDef {
  id: string
  eyebrow: string          // category label — kept EN (short, consistent UI tag)
  titleEn: string
  titleVn: string
  introEn: string
  introVn: string
  blocks: Block[]
}

// Hoisted style constants.
const ulStyle: React.CSSProperties = { margin: '8px 0', paddingLeft: 20, color: '#E5D4C2' }
const olStyle: React.CSSProperties = { margin: '8px 0', paddingLeft: 22, color: '#E5D4C2' }
const h4: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, fontWeight: 500,
  color: '#D4B85A', margin: '18px 0 8px', letterSpacing: '0.04em',
}
const codeStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', padding: '2px 6px', borderRadius: 4,
  border: '1px solid rgba(229,212,194,0.10)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A',
}
const linkStyle: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
}
const calloutBlock: React.CSSProperties = {
  background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.25)',
  borderLeft: '3px solid #D4B85A',
  borderRadius: 6, padding: '12px 16px', margin: '14px 0',
}
const calloutTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.12em', textTransform: 'uppercase',
  marginBottom: 6,
}
const stageRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14,
  padding: '8px 12px',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
}
const stageName: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', letterSpacing: '0.06em',
}
const stageDesc: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.6,
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={codeStyle}>{children}</code>
}
function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={calloutBlock}>
      <div style={calloutTitle}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
function Stages({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
      {items.map(([name, desc]) => (
        <div key={name} style={stageRow}>
          <div style={stageName}>{name}</div>
          <div style={stageDesc}>{desc}</div>
        </div>
      ))}
    </div>
  )
}

// HTML entities are written literally in the content strings (transcribed from
// the old JSX); JS strings don't auto-decode them, so do it here to match the
// original render exactly. &amp; last so it can't double-decode.
const dec = (s: string) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

// Inline markup → React nodes. Handles `code`, [label](href), {{#hex:text}},
// **bold**, *italic*. Plain text (incl. unicode glyphs) passes through, entity-decoded.
function renderInline(text: string, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\{\{#[0-9A-Fa-f]{6}:[^}]+\}\})|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g
  let last = 0, i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(dec(text.slice(last, m.index)))
    const tok = m[0]
    const key = `${kp}-${i}`
    if (m[1]) out.push(<Code key={key}>{dec(tok.slice(1, -1))}</Code>)
    else if (m[2]) { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!; out.push(<Link key={key} href={mm[2]} style={linkStyle}>{dec(mm[1])}</Link>) }
    else if (m[3]) { const mm = /^\{\{(#[0-9A-Fa-f]{6}):([^}]+)\}\}$/.exec(tok)!; out.push(<span key={key} style={{ color: mm[1] }}>{dec(mm[2])}</span>) }
    else if (m[4]) out.push(<strong key={key}>{dec(tok.slice(2, -2))}</strong>)
    else if (m[5]) out.push(<em key={key}>{dec(tok.slice(1, -1))}</em>)
    last = m.index + tok.length; i++
  }
  if (last < text.length) out.push(dec(text.slice(last)))
  return out
}

const pick = (s: LangStr, lang: Lang) => (lang === 'vn' && s.vn ? s.vn : s.en)

function renderBlocks(blocks: Block[], lang: Lang): React.ReactNode {
  return blocks.map((b, i) => {
    const kp = `b${i}`
    switch (b.kind) {
      case 'p':
        return <p key={kp}>{renderInline(pick(b, lang), kp)}</p>
      case 'h4':
        return <h4 key={kp} style={h4}>{renderInline(pick(b, lang), kp)}</h4>
      case 'ul':
      case 'ol': {
        const Tag = b.kind === 'ul' ? 'ul' : 'ol'
        const st = b.kind === 'ul' ? ulStyle : olStyle
        return (
          <Tag key={kp} style={st}>
            {b.items.map((it, j) => (
              <li key={`${kp}-${j}`}>
                {renderInline(pick(it, lang), `${kp}-${j}`)}
                {it.sub && (
                  <ul style={ulStyle}>
                    {it.sub.map((s, k) => <li key={`${kp}-${j}-${k}`}>{renderInline(pick(s, lang), `${kp}-${j}-${k}`)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </Tag>
        )
      }
      case 'callout':
        return <Callout key={kp} title={dec(pick(b.title, lang))}>{renderInline(pick(b, lang), kp)}</Callout>
      case 'stages':
        return <Stages key={kp} items={b.items.map(it => [pick(it.name, lang), pick(it.desc, lang)] as [string, string])} />
    }
  })
}

const SECTIONS: SectionDef[] = [
  {
    id: 'getting-started',
    eyebrow: 'Orientation',
    titleEn: 'Getting started',
    titleVn: 'Bắt đầu',
    introEn: 'What the CRM is, who it is for, and how to think about it.',
    introVn: 'CRM là gì, dành cho ai, và cách hiểu về nó.',
    blocks: [
      { kind: 'p',
        en: 'The admin portal at `/admin` is the team&apos;s working surface — it&apos;s where we manage prospects, members, the whisky library, the floor, and everything in between. It is *not* a public-facing site; only signed-in admins reach it.',
        vn: 'Cổng quản trị tại `/admin` là nơi làm việc của đội ngũ — nơi chúng ta quản lý khách tiềm năng, thành viên, thư viện whisky, khu vực phục vụ và mọi thứ ở giữa. Đây *không* phải trang công khai; chỉ quản trị viên đã đăng nhập mới vào được.' },
      { kind: 'p', en: 'The sidebar is grouped by job-to-be-done:', vn: 'Thanh bên được nhóm theo công việc cần làm:' },
      { kind: 'ul', items: [
        { en: '**Floor** — what you need at the club: MX Daily (the morning brief), Tonight (service prep), Calendar (bookings), Shift Checklists (opening/closing handover), Harmony Log (end-of-shift AI capture), Notices, Quick Reference.',
          vn: '**Floor** — những gì bạn cần tại câu lạc bộ: MX Daily (bản tóm tắt buổi sáng), Tonight (chuẩn bị phục vụ), Calendar (đặt chỗ), Shift Checklists (bàn giao mở/đóng ca), Harmony Log (ghi nhận cuối ca bằng AI), Notices, Quick Reference.' },
        { en: '**Intelligence** — the CRM: Pipeline (prospects), Members, User Roster, Pref Candidates (review queue), Member Cards (NFC), Agreements (signed PDFs).',
          vn: '**Intelligence** — phần CRM: Pipeline (khách tiềm năng), Members, User Roster, Pref Candidates (hàng chờ duyệt), Member Cards (thẻ NFC), Agreements (PDF đã ký).' },
        { en: '**Whisky Library** — Inventory, Lockers, Fixtures.',
          vn: '**Whisky Library** — Inventory (tồn kho), Lockers (tủ rượu), Fixtures (lịch thi đấu).' },
        { en: '**House** — House Rules, Journal, Press, this Training doc.',
          vn: '**House** — House Rules (nội quy), Journal (nhật ký), Press (báo chí), và tài liệu Training này.' },
      ] },
      { kind: 'callout', title: { en: 'Golden rule', vn: 'Nguyên tắc vàng' },
        en: 'Everything you do in the admin portal is logged. Activity timelines on members and prospects are the team&apos;s collective memory — write clear, professional notes; assume the GM, the MX, and the founder will all read them.',
        vn: 'Mọi thao tác trong cổng quản trị đều được ghi lại. Dòng thời gian hoạt động của thành viên và khách tiềm năng là ký ức chung của cả đội — hãy ghi chú rõ ràng, chuyên nghiệp; cứ cho rằng GM, MX và nhà sáng lập đều sẽ đọc.' },
    ],
  },

  {
    id: 'pipeline',
    eyebrow: 'Intelligence',
    titleEn: 'Pipeline (prospects)',
    titleVn: 'Pipeline (khách tiềm năng)',
    introEn: 'How to add a prospect, move them through the stages, and convert them into a member.',
    introVn: 'Cách thêm khách tiềm năng, đưa họ qua các giai đoạn, và chuyển thành thành viên.',
    blocks: [
      { kind: 'p',
        en: 'The Pipeline at [/admin/mis/pipeline](/admin/mis/pipeline) is the kanban for everyone who isn&apos;t a member yet. Cards move left-to-right through six active stages, plus three off-ramps for prospects who don&apos;t convert.',
        vn: 'Pipeline tại [/admin/mis/pipeline](/admin/mis/pipeline) là bảng kanban cho tất cả những người chưa phải thành viên. Thẻ di chuyển từ trái sang phải qua sáu giai đoạn chính, cùng ba lối rẽ cho khách không chuyển đổi.' },
      { kind: 'h4', en: 'Active stages', vn: 'Các giai đoạn chính' },
      { kind: 'stages', items: [
        { name: { en: 'Lead', vn: 'Lead' }, desc: { en: 'A name on the radar. No commitment, no contact yet.', vn: 'Một cái tên trong tầm ngắm. Chưa cam kết, chưa liên hệ.' } },
        { name: { en: 'Initial Contact', vn: 'Initial Contact' }, desc: { en: 'We have reached out, or they have reached out to us. First impression formed.', vn: 'Ta đã liên hệ, hoặc họ đã liên hệ ta. Đã có ấn tượng đầu tiên.' } },
        { name: { en: 'Interview Scheduled', vn: 'Interview Scheduled' }, desc: { en: 'A face-to-face is on the calendar.', vn: 'Đã hẹn gặp trực tiếp trên lịch.' } },
        { name: { en: 'Interview Complete', vn: 'Interview Complete' }, desc: { en: 'Interview happened; we are deciding.', vn: 'Đã phỏng vấn xong; đang cân nhắc.' } },
        { name: { en: 'Application Received', vn: 'Application Received' }, desc: { en: 'Signing invitation has been sent; awaiting their signature.', vn: 'Đã gửi thư mời ký; đang chờ chữ ký của họ.' } },
        { name: { en: 'Onboarded', vn: 'Onboarded' }, desc: { en: 'They have signed; they are an active member.', vn: 'Họ đã ký; đã là thành viên hoạt động.' } },
      ] },
      { kind: 'h4', en: 'Off-ramps', vn: 'Các lối rẽ' },
      { kind: 'stages', items: [
        { name: { en: 'Declined', vn: 'Declined' }, desc: { en: 'We chose not to extend an invitation.', vn: 'Ta quyết định không mời.' } },
        { name: { en: 'Withdrawn', vn: 'Withdrawn' }, desc: { en: 'They withdrew themselves.', vn: 'Họ tự rút lui.' } },
        { name: { en: 'On Hold', vn: 'On Hold' }, desc: { en: 'Paused — revisit later, do not delete.', vn: 'Tạm dừng — xem lại sau, đừng xóa.' } },
      ] },
      { kind: 'h4', en: 'Daily flow', vn: 'Quy trình hằng ngày' },
      { kind: 'ol', items: [
        { en: 'Open the Pipeline first thing. Glance at the *Needs attention* dashboard at the top — stale leads, interviews this week, actions due.',
          vn: 'Mở Pipeline đầu tiên. Liếc bảng *Needs attention* ở trên cùng — lead bị bỏ quên, phỏng vấn tuần này, việc đến hạn.' },
        { en: 'Add new prospects via the **＋ Add prospect** button. Minimum required: full name. Capture source, referred-by, and contact info if you have them.',
          vn: 'Thêm khách mới bằng nút **＋ Add prospect**. Tối thiểu phải có: họ tên đầy đủ. Ghi nguồn, người giới thiệu và thông tin liên hệ nếu có.' },
        { en: 'For interviews: open the prospect, fill in the *Interview* section. After the interview, use the rubric to score 1–5 on each dimension. The overall score appears live.',
          vn: 'Với phỏng vấn: mở khách, điền mục *Interview*. Sau phỏng vấn, dùng thang chấm 1–5 cho từng tiêu chí. Điểm tổng hiện trực tiếp.' },
        { en: 'When ready to admit: hit **✉ Send signing invitation** — see the next section.',
          vn: 'Khi sẵn sàng kết nạp: nhấn **✉ Send signing invitation** — xem mục kế tiếp.' },
      ] },
      { kind: 'callout', title: { en: 'Quick actions on cards', vn: 'Thao tác nhanh trên thẻ' },
        en: 'Hover any card in the kanban. You&apos;ll see three icons: **→** moves to the next stage, **✉** toggles letter-sent, **×** archives. Use these to fly through stage updates.',
        vn: 'Di chuột lên bất kỳ thẻ nào trên kanban. Bạn sẽ thấy ba biểu tượng: **→** chuyển sang giai đoạn kế, **✉** bật/tắt đã-gửi-thư, **×** lưu trữ. Dùng chúng để cập nhật giai đoạn thật nhanh.' },
    ],
  },

  {
    id: 'signing-loop',
    eyebrow: 'Intelligence',
    titleEn: 'Signing loop',
    titleVn: 'Vòng ký kết',
    introEn: 'How a prospect becomes a fully Active member: send the link, they sign, status flips.',
    introVn: 'Cách một khách tiềm năng trở thành thành viên Active: gửi liên kết, họ ký, trạng thái chuyển.',
    blocks: [
      { kind: 'p',
        en: 'The signing loop turns an approved prospect into a member with a signed agreement on file — automatically. You no longer need to manually convert prospects to members.',
        vn: 'Vòng ký kết biến một khách đã duyệt thành thành viên có hợp đồng đã ký trong hồ sơ — một cách tự động. Bạn không còn phải chuyển khách thành thành viên thủ công.' },
      { kind: 'h4', en: 'Step by step', vn: 'Từng bước' },
      { kind: 'ol', items: [
        { en: 'Open the prospect&apos;s detail page.', vn: 'Mở trang chi tiết của khách.' },
        { en: 'In the sidebar, click **✉ Send signing invitation**.', vn: 'Ở thanh bên, nhấn **✉ Send signing invitation**.' },
        { en: 'Pick the tier (Founding / Legacy / Pioneer / Corporate / Honorary), confirm the email (auto-detected from contact info), add mobile if you have it.',
          vn: 'Chọn hạng (Founding / Legacy / Pioneer / Corporate / Honorary), xác nhận email (tự nhận từ thông tin liên hệ), thêm số di động nếu có.' },
        { en: 'Hit **Send invitation**. Behind the scenes:', vn: 'Nhấn **Send invitation**. Phía sau hậu trường:',
          sub: [
            { en: 'A `member_no` is minted (or the existing provisional one is reused).', vn: 'Một `member_no` được cấp (hoặc dùng lại số tạm hiện có).' },
            { en: 'A `members` row is created with status `Pending Signature`.', vn: 'Một dòng `members` được tạo với trạng thái `Pending Signature`.' },
            { en: 'A signing invitation is created with a unique link.', vn: 'Một thư mời ký được tạo kèm liên kết riêng.' },
            { en: 'An email goes out via Resend.', vn: 'Email được gửi qua Resend.' },
            { en: 'The prospect flips to *Application Received*.', vn: 'Khách chuyển sang *Application Received*.' },
          ] },
        { en: 'The sidebar now shows invitation status — sent date, viewed/view-count, reminder count. You can **Resend email**, **Copy link**, or **Revoke**.',
          vn: 'Thanh bên giờ hiển thị trạng thái thư mời — ngày gửi, đã xem/số lượt xem, số lần nhắc. Bạn có thể **Resend email**, **Copy link**, hoặc **Revoke**.' },
        { en: 'When they sign, everything closes the loop: member flips to *Active* with today&apos;s join date, prospect flips to *Onboarded*, and a signed PDF lands in storage.',
          vn: 'Khi họ ký, mọi thứ khép vòng: thành viên chuyển sang *Active* với ngày gia nhập là hôm nay, khách chuyển sang *Onboarded*, và một PDF đã ký được lưu vào kho.' },
      ] },
      { kind: 'callout', title: { en: 'When to use Force convert', vn: 'Khi nào dùng Force convert' },
        en: 'The *★ Force convert without signing* override creates an Active member with no agreement on file. Only use this when a paper agreement has been signed offline and you&apos;re catching up the system.',
        vn: 'Tùy chọn *★ Force convert without signing* tạo một thành viên Active mà không có hợp đồng trong hồ sơ. Chỉ dùng khi đã ký hợp đồng giấy ngoại tuyến và bạn đang cập nhật lại hệ thống.' },
    ],
  },

  {
    id: 'guardian-angel',
    eyebrow: 'Intelligence',
    titleEn: 'Guardian Angel cycle (per visit)',
    titleVn: 'Chu trình Guardian Angel (mỗi lần ghé)',
    introEn: 'Each visit moves Overture → Accord → Continuum → Closed. This is what makes PS(t) live.',
    introVn: 'Mỗi lần ghé đi qua Overture → Accord → Continuum → Closed. Đây là điều giữ cho PS(t) luôn sống.',
    blocks: [
      { kind: 'p',
        en: 'Every visit at The Rampant Club runs a four-phase cycle. The brief assembles itself before arrival, the team logs structured observations during, and a closing note feeds the next visit&apos;s brief — closing the loop the dissertation describes.',
        vn: 'Mỗi lần ghé The Rampant Club chạy một chu trình bốn giai đoạn. Bản tóm tắt tự lắp trước khi khách đến, đội ngũ ghi nhận quan sát có cấu trúc trong lúc phục vụ, và một ghi chú kết thúc nuôi bản tóm tắt cho lần ghé sau — khép lại vòng lặp mà luận văn mô tả.' },
      { kind: 'h4', en: 'How to start a visit', vn: 'Cách bắt đầu một lần ghé' },
      { kind: 'ol', items: [
        { en: 'The natural way: a member taps their NFC card → kiosk auto-creates the visit at phase=`overture` and routes the host to it. If they have a confirmed booking today, it&apos;s linked automatically and the booking flips to *arrived*.',
          vn: 'Cách tự nhiên: thành viên chạm thẻ NFC → kiosk tự tạo lần ghé ở phase=`overture` và đưa người tiếp đón đến đó. Nếu hôm nay họ có đặt chỗ đã xác nhận, nó được liên kết tự động và đặt chỗ chuyển sang *arrived*.' },
        { en: 'The manual way: open the member profile and click **◉ Start tonight&apos;s visit →**. Or, from the calendar, click **◉ Start visit** on the booking card.',
          vn: 'Cách thủ công: mở hồ sơ thành viên và nhấn **◉ Start tonight&apos;s visit →**. Hoặc, từ calendar, nhấn **◉ Start visit** trên thẻ đặt chỗ.' },
      ] },
      { kind: 'h4', en: 'Overture · pre-arrival brief', vn: 'Overture · bản tóm tắt trước khi đến' },
      { kind: 'p',
        en: 'Three things, assembled live from current data: Score-5 non-negotiables (the never-get-wrong items), open **⚠ REVALIDATE** preferences (confirm these on the visit to lift R), and the last `data_for_next_overture` note from this member&apos;s previous closed visit. Click **◆ Begin Accord →** to step forward.',
        vn: 'Ba thứ, lắp trực tiếp từ dữ liệu hiện tại: các điểm Score-5 không thể sai (những điều tuyệt đối không được nhầm), các sở thích **⚠ REVALIDATE** đang mở (xác nhận chúng trong lần ghé để nâng R), và ghi chú `data_for_next_overture` cuối cùng từ lần ghé đã đóng trước của thành viên. Nhấn **◆ Begin Accord →** để bước tiếp.' },
      { kind: 'h4', en: 'Accord · live observation log', vn: 'Accord · nhật ký quan sát trực tiếp' },
      { kind: 'p',
        en: 'Each observation has a category, a sentiment (Excellence / Neutral / Grievance), an optional 1–5 score, and one of three modes:',
        vn: 'Mỗi quan sát có một danh mục, một sắc thái (Excellence / Neutral / Grievance), một điểm 1–5 tùy chọn, và một trong ba chế độ:' },
      { kind: 'ul', items: [
        { en: '**Just an observation** — pure record, no preference touched.', vn: '**Just an observation** — chỉ ghi nhận, không động đến sở thích nào.' },
        { en: '**Link to an existing preference** with Confirmed / Contradicted / Revised — fires write contract A: `validation_count` climbs, `last_validated` resets, a `validation_event` lands. Revalidation flag clears.',
          vn: '**Link to an existing preference** với Confirmed / Contradicted / Revised — kích hoạt write contract A: `validation_count` tăng, `last_validated` được đặt lại, một `validation_event` được ghi. Cờ revalidation được xóa.' },
        { en: '**Spawn a new candidate** — sends the proposal to the candidates queue for an admin to accept (write contract B) or reject.',
          vn: '**Spawn a new candidate** — gửi đề xuất vào hàng chờ candidates để quản trị viên chấp nhận (write contract B) hoặc từ chối.' },
      ] },
      { kind: 'h4', en: 'Continuum · the loop-closer', vn: 'Continuum · khâu khép vòng' },
      { kind: 'p',
        en: 'The single most important field: `data_for_next_overture`. Write the one sentence the team needs from tonight when this member walks back in. Required to close the visit. Once written, hit **◆ Mark visit closed →**. Done.',
        vn: 'Trường quan trọng nhất: `data_for_next_overture`. Viết đúng một câu mà đội ngũ cần từ tối nay cho lần sau thành viên này quay lại. Bắt buộc phải có để đóng lần ghé. Viết xong, nhấn **◆ Mark visit closed →**. Xong.' },
      { kind: 'callout', title: { en: 'The cycle is one-way', vn: 'Chu trình chỉ đi một chiều' },
        en: 'Phases move forward only — overture → accord → continuum → closed. You can&apos;t skip steps or go backwards. If something was logged in error, archive the visit from the visits log.',
        vn: 'Các giai đoạn chỉ tiến về phía trước — overture → accord → continuum → closed. Không thể bỏ bước hay lùi lại. Nếu ghi nhầm điều gì, hãy lưu trữ lần ghé từ nhật ký visits.' },
    ],
  },

  {
    id: 'candidates',
    eyebrow: 'Intelligence',
    titleEn: 'Preference candidates',
    titleVn: 'Ứng viên sở thích',
    introEn: 'Review queue for new preferences proposed by observations and AI extractions.',
    introVn: 'Hàng chờ duyệt cho các sở thích mới do quan sát và AI đề xuất.',
    blocks: [
      { kind: 'p',
        en: '[/admin/mis/candidates](/admin/mis/candidates) is the gate between &quot;the AI thinks this might be a preference&quot; and &quot;this is actually a preference.&quot; Two paths feed it:',
        vn: '[/admin/mis/candidates](/admin/mis/candidates) là cửa ngăn giữa &quot;AI nghĩ đây có thể là một sở thích&quot; và &quot;đây thật sự là một sở thích.&quot; Hai luồng dẫn vào đây:' },
      { kind: 'ul', items: [
        { en: 'An observation during Accord flagged as &quot;spawn a new candidate.&quot;', vn: 'Một quan sát trong Accord được đánh dấu &quot;spawn a new candidate.&quot;' },
        { en: 'The Harmony Log&apos;s AI extraction proposing a preference from a shift narrative.', vn: 'AI của Harmony Log đề xuất một sở thích từ bản tường thuật ca làm.' },
      ] },
      { kind: 'h4', en: 'How to review', vn: 'Cách duyệt' },
      { kind: 'ol', items: [
        { en: 'Open the queue. Pending count shows at the top; default filter is pending.', vn: 'Mở hàng chờ. Số lượng pending hiện ở trên; bộ lọc mặc định là pending.' },
        { en: 'Each card shows the suggested preference, the member, the source observation snippet (with a link back to the originating visit), and the source label.',
          vn: 'Mỗi thẻ hiển thị sở thích được gợi ý, thành viên, đoạn quan sát nguồn (kèm liên kết về lần ghé gốc), và nhãn nguồn.' },
        { en: 'Click **Review** to expand and edit the name, category, S₀ / Confidence / λ / Frequency. The system snaps your values to the allowed sets if they drift outside.',
          vn: 'Nhấn **Review** để mở rộng và chỉnh tên, danh mục, S₀ / Confidence / λ / Frequency. Hệ thống tự đưa giá trị về tập hợp lệ nếu lệch ra ngoài.' },
        { en: '**Accept** fires the atomic promote RPC — the preference lands with `validation_count=1` and the candidate marks the moment it was promoted.',
          vn: '**Accept** kích hoạt RPC promote nguyên tử — sở thích được tạo với `validation_count=1` và ứng viên đánh dấu thời điểm được thăng.' },
        { en: '**Reject** closes the candidate with no preference written.', vn: '**Reject** đóng ứng viên mà không tạo sở thích nào.' },
      ] },
      { kind: 'callout', title: { en: 'Why a queue?', vn: 'Tại sao cần hàng chờ?' },
        en: 'AI is good at suggesting; humans are still better at curating. Every preference in the member intelligence system has been through a human pass — that&apos;s what keeps PS(t) meaningful.',
        vn: 'AI giỏi gợi ý; con người vẫn giỏi chọn lọc hơn. Mọi sở thích trong hệ thống member intelligence đều đã qua một lượt duyệt của con người — đó là điều giữ cho PS(t) có ý nghĩa.' },
    ],
  },

  {
    id: 'members',
    eyebrow: 'Intelligence',
    titleEn: 'Members (MIS)',
    titleVn: 'Thành viên (MIS)',
    introEn: 'The member roster, the PS(t) score, preferences, and revalidation.',
    introVn: 'Danh sách thành viên, điểm PS(t), sở thích, và revalidation.',
    blocks: [
      { kind: 'p',
        en: '[/admin/mis](/admin/mis) is the member intelligence dashboard. Every member has a profile showing their preferences, scoring history, and activity. The headline number is **PS(t)** — the time-decayed preference score.',
        vn: '[/admin/mis](/admin/mis) là bảng điều khiển member intelligence. Mỗi thành viên có một hồ sơ thể hiện sở thích, lịch sử điểm và hoạt động. Con số chủ đạo là **PS(t)** — điểm sở thích đã suy giảm theo thời gian.' },
      { kind: 'h4', en: 'What PS(t) means', vn: 'PS(t) nghĩa là gì' },
      { kind: 'p',
        en: 'PS(t) = S₀ × C × e^(−λt) × F × R × M, clamped 0..5. In plain English: a preference&apos;s power fades over time unless you revalidate it. A member who said &quot;loves Bowmore&quot; 18 months ago and hasn&apos;t reordered will have a much lower PS(t) than someone who reordered last week.',
        vn: 'PS(t) = S₀ × C × e^(−λt) × F × R × M, giới hạn trong 0..5. Nói đơn giản: sức mạnh của một sở thích phai dần theo thời gian trừ khi bạn revalidate nó. Một thành viên nói &quot;thích Bowmore&quot; 18 tháng trước mà chưa gọi lại sẽ có PS(t) thấp hơn nhiều so với người vừa gọi lại tuần trước.' },
      { kind: 'ul', items: [
        { en: '**S₀** — base strength (1–5) when the preference was first captured.', vn: '**S₀** — độ mạnh gốc (1–5) khi sở thích được ghi nhận lần đầu.' },
        { en: '**C** — confidence factor (was this said directly, observed, or inferred?).', vn: '**C** — hệ số tin cậy (điều này được nói trực tiếp, quan sát được, hay suy luận ra?).' },
        { en: '**λ** — decay rate. Longer-lived preferences (a love of Highland malts) decay slower than transient ones (a phase with rye).',
          vn: '**λ** — tốc độ suy giảm. Sở thích bền lâu (yêu thích Highland malt) phai chậm hơn sở thích nhất thời (giai đoạn mê rye).' },
        { en: '**F** — frequency multiplier (how often they reorder).', vn: '**F** — hệ số tần suất (họ gọi lại thường xuyên đến đâu).' },
        { en: '**R** — recency boost (last engagement).', vn: '**R** — điểm cộng theo độ gần đây (lần tương tác cuối).' },
        { en: '**M** — multiplier from confirmed re-statements (revalidations).', vn: '**M** — hệ số nhân từ các lần khẳng định lại (revalidation).' },
      ] },
      { kind: 'h4', en: 'Revalidating preferences', vn: 'Revalidate sở thích' },
      { kind: 'p',
        en: 'When a member reconfirms a preference (they ordered it again, mentioned it again, gave you new feedback), use the **Revalidate** button. This bumps R and M and refreshes the timestamp, so PS(t) climbs back up.',
        vn: 'Khi một thành viên khẳng định lại một sở thích (gọi lại, nhắc lại, hoặc cho phản hồi mới), hãy dùng nút **Revalidate**. Việc này nâng R và M cùng làm mới mốc thời gian, nên PS(t) leo lên lại.' },
      { kind: 'h4', en: 'Adding preferences from interviews', vn: 'Thêm sở thích từ phỏng vấn' },
      { kind: 'p',
        en: 'During or after an interview, upload the transcript on the prospect&apos;s profile and the system extracts structured preferences using Claude. Review each extracted preference, edit if needed, accept. They land on the provisional member&apos;s profile.',
        vn: 'Trong hoặc sau phỏng vấn, tải bản ghi lên hồ sơ của khách và hệ thống trích xuất sở thích có cấu trúc bằng Claude. Duyệt từng sở thích được trích, chỉnh nếu cần, rồi chấp nhận. Chúng sẽ xuất hiện trên hồ sơ thành viên tạm.' },
    ],
  },

  {
    id: 'member-logins',
    eyebrow: 'Intelligence',
    titleEn: 'Member logins & onboarding',
    titleVn: 'Tài khoản thành viên & onboarding',
    introEn: 'Give a member their own login to the member portal — temp password, shown once, they set their own.',
    introVn: 'Cấp cho thành viên tài khoản riêng vào cổng thành viên — mật khẩu tạm, hiện một lần, họ tự đặt mật khẩu của mình.',
    blocks: [
      { kind: 'p',
        en: 'A member needs a login to see the member portal (their palate, visits, gifts, the whisky library). You create it from their member record at [/admin/mis](/admin/mis) → open the member → the **Member login** panel.',
        vn: 'Thành viên cần một tài khoản để xem cổng thành viên (khẩu vị, lần ghé, quà tặng, thư viện whisky). Bạn tạo nó từ hồ sơ thành viên tại [/admin/mis](/admin/mis) → mở thành viên → bảng **Member login**.' },
      { kind: 'h4', en: 'Creating a login', vn: 'Tạo tài khoản' },
      { kind: 'ol', items: [
        { en: 'On the member&apos;s record, find the **Member login** panel. If they have no login yet it shows *No login yet* with a **Create member login** button.',
          vn: 'Trong hồ sơ thành viên, tìm bảng **Member login**. Nếu họ chưa có tài khoản, bảng hiện *No login yet* kèm nút **Create member login**.' },
        { en: 'Click it, enter the member&apos;s **email** (their login), and hit **Create login**.',
          vn: 'Nhấn nút đó, nhập **email** của thành viên (chính là tài khoản đăng nhập), rồi nhấn **Create login**.' },
        { en: 'A **temporary password** appears. **Copy it** and relay it to the member (Zalo / WhatsApp / in person). Then hit **Done — I&apos;ve relayed it**.',
          vn: 'Một **mật khẩu tạm** hiện ra. **Sao chép** và chuyển cho thành viên (Zalo / WhatsApp / trực tiếp). Sau đó nhấn **Done — I&apos;ve relayed it**.' },
        { en: 'The member signs in at [/login](/login) with their email + the temp password, and is immediately required to set their own password before they reach anything.',
          vn: 'Thành viên đăng nhập tại [/login](/login) bằng email + mật khẩu tạm, và bị yêu cầu đặt mật khẩu riêng ngay trước khi vào được bất cứ đâu.' },
      ] },
      { kind: 'callout', title: { en: 'The temp password is shown once', vn: 'Mật khẩu tạm chỉ hiện một lần' },
        en: 'It is generated, shown that one time, and **never stored** — you cannot look it up again. Copy and relay it when it appears. If it&apos;s lost, you&apos;ll need to reset the account rather than retrieve it. Never write it somewhere insecure.',
        vn: 'Nó được sinh ra, hiện đúng một lần, và **không bao giờ được lưu** — bạn không thể tra lại. Hãy sao chép và chuyển ngay khi nó hiện. Nếu mất, bạn phải đặt lại tài khoản chứ không lấy lại được. Đừng bao giờ ghi nó ở nơi không an toàn.' },
      { kind: 'callout', title: { en: 'They must change it on first login', vn: 'Họ phải đổi mật khẩu ở lần đăng nhập đầu' },
        en: 'A freshly-created login is forced to `/set-password` on first sign-in — it can&apos;t reach any member page until the member sets their own password. So the temp password is only ever a one-time handoff.',
        vn: 'Tài khoản vừa tạo bị buộc đến `/set-password` ở lần đăng nhập đầu — không vào được trang thành viên nào cho đến khi đặt mật khẩu riêng. Vậy nên mật khẩu tạm chỉ là cú bàn giao một lần.' },
      { kind: 'callout', title: { en: 'One login per member', vn: 'Mỗi thành viên một tài khoản' },
        en: 'A member record links to a single login. If one already exists the panel shows **✓ Linked** with the email — don&apos;t create a second.',
        vn: 'Mỗi hồ sơ thành viên liên kết với đúng một tài khoản. Nếu đã có, bảng hiện **✓ Linked** kèm email — đừng tạo cái thứ hai.' },
    ],
  },

  {
    id: 'lockers',
    eyebrow: 'Whisky Library',
    titleEn: 'Lockers',
    titleVn: 'Tủ rượu',
    introEn: 'Visual map of the physical locker wall. Assign members, track bottles and fill levels.',
    introVn: 'Bản đồ trực quan của tường tủ rượu thật. Gán thành viên, theo dõi chai và mức rượu còn lại.',
    blocks: [
      { kind: 'p',
        en: '[/admin/lockers](/admin/lockers) mirrors the physical wall. Each tile is a real locker; the position on the screen matches the position on the wall (row + column).',
        vn: '[/admin/lockers](/admin/lockers) phản chiếu tường thật. Mỗi ô là một tủ thật; vị trí trên màn hình khớp với vị trí trên tường (hàng + cột).' },
      { kind: 'h4', en: 'Tile colours', vn: 'Màu của ô' },
      { kind: 'ul', items: [
        { en: '{{#7AB07A:Green}} — occupied (assigned to a member).', vn: '{{#7AB07A:Xanh lá}} — đang dùng (đã gán cho một thành viên).' },
        { en: '{{#D4B85A:Gold}} — reserved (held but not yet active).', vn: '{{#D4B85A:Vàng}} — đã giữ (giữ chỗ nhưng chưa kích hoạt).' },
        { en: '{{#B2AA98:Muted}} — empty.', vn: '{{#B2AA98:Xám}} — trống.' },
        { en: '{{#C27070:Red-tinted}} — retired (broken, removed, do not assign).', vn: '{{#C27070:Đỏ nhạt}} — ngừng dùng (hỏng, đã gỡ, không gán).' },
      ] },
      { kind: 'h4', en: 'Assigning a locker', vn: 'Gán một tủ' },
      { kind: 'ol', items: [
        { en: 'Click any empty tile.', vn: 'Nhấn vào một ô trống bất kỳ.' },
        { en: 'In the drawer, search for the member by name or number. Click them — assignment is instant.',
          vn: 'Trong ngăn kéo, tìm thành viên theo tên hoặc số. Nhấn vào họ — việc gán diễn ra tức thì.' },
        { en: 'Optionally set a custom display label (e.g. &quot;Bowmore Society — corner&quot;).',
          vn: 'Tùy chọn đặt nhãn hiển thị riêng (vd. &quot;Bowmore Society — góc&quot;).' },
      ] },
      { kind: 'h4', en: 'Tracking contents', vn: 'Theo dõi rượu trong tủ' },
      { kind: 'ol', items: [
        { en: 'Open the locker. Scroll to *Contents*.', vn: 'Mở tủ. Cuộn xuống mục *Contents*.' },
        { en: 'Add a bottle: name, distillery, age, ABV, fill %.', vn: 'Thêm một chai: tên, nhà chưng cất, số năm, ABV, % còn lại.' },
        { en: 'Drag the fill slider whenever a bottle is poured down. Anything ≤ 25% shows up on the dashboard as a top-up opportunity.',
          vn: 'Kéo thanh trượt mức rượu mỗi khi rót vơi đi. Bất cứ chai nào ≤ 25% sẽ hiện trên dashboard như một cơ hội châm thêm.' },
      ] },
      { kind: 'callout', title: { en: 'Tip', vn: 'Mẹo' },
        en: 'Use the *Notes* field for things the team should know — lock combinations, fragile glass, members who like a specific glass paired with their bottle.',
        vn: 'Dùng trường *Notes* cho những điều đội ngũ nên biết — mã khóa, ly dễ vỡ, thành viên thích một loại ly riêng đi kèm chai của họ.' },
    ],
  },

  {
    id: 'cards',
    eyebrow: 'Intelligence',
    titleEn: 'Member cards (NFC)',
    titleVn: 'Thẻ thành viên (NFC)',
    introEn: 'Linking physical NFC cards to member profiles.',
    introVn: 'Liên kết thẻ NFC vật lý với hồ sơ thành viên.',
    blocks: [
      { kind: 'p',
        en: '[/admin/cards](/admin/cards) is where physical NFC cards get bound to member records. Once linked, a tap at any kiosk pulls up the member instantly.',
        vn: '[/admin/cards](/admin/cards) là nơi gắn thẻ NFC vật lý với hồ sơ thành viên. Sau khi liên kết, một cú chạm tại bất kỳ kiosk nào sẽ mở hồ sơ thành viên ngay lập tức.' },
      { kind: 'ol', items: [
        { en: 'Open the card admin page.', vn: 'Mở trang quản trị thẻ.' },
        { en: 'Tap a fresh card at the kiosk (it shows up as orphaned).', vn: 'Chạm một thẻ mới tại kiosk (nó hiện ra dạng orphaned — chưa gắn).' },
        { en: 'From the admin page, link it to the right member by selecting them.', vn: 'Từ trang quản trị, liên kết nó với đúng thành viên bằng cách chọn họ.' },
      ] },
      { kind: 'p',
        en: 'Cards carry stored credit (in VND). Top-ups happen via the transaction endpoint; the kiosk shows current balance after every tap.',
        vn: 'Thẻ mang số dư lưu sẵn (bằng VND). Việc nạp thêm diễn ra qua endpoint giao dịch; kiosk hiển thị số dư hiện tại sau mỗi lần chạm.' },
    ],
  },

  {
    id: 'tonight',
    eyebrow: 'Floor',
    titleEn: 'Tonight',
    titleVn: 'Tonight',
    introEn: 'Pre-shift brief: who is coming in, what they prefer, what to remember.',
    introVn: 'Bản tóm tắt trước ca: ai sẽ đến, họ thích gì, cần nhớ điều gì.',
    blocks: [
      { kind: 'p',
        en: '[/admin/tonight](/admin/tonight) is the manager&apos;s first stop of the evening. Bookings cross-referenced with member intelligence: top preferences, last-visit notes, birthday/anniversary flags.',
        vn: '[/admin/tonight](/admin/tonight) là điểm dừng đầu tiên của quản lý mỗi tối. Đặt chỗ được đối chiếu với member intelligence: sở thích nổi bật, ghi chú lần ghé trước, cờ sinh nhật/kỷ niệm.' },
      { kind: 'h4', en: 'How to use it', vn: 'Cách dùng' },
      { kind: 'ul', items: [
        { en: 'Print or screen-mirror to the back-of-house monitor.', vn: 'In ra hoặc chiếu lên màn hình khu vực hậu cần.' },
        { en: 'Brief the team — call out anyone with a milestone, anyone with an open complaint, anyone the GM has asked the team to give special attention.',
          vn: 'Dặn dò đội ngũ — nêu tên ai có dấu mốc, ai có khiếu nại còn mở, ai được GM yêu cầu quan tâm đặc biệt.' },
        { en: 'After service, jot any new preferences or notes against the member.', vn: 'Sau khi phục vụ, ghi lại sở thích hoặc ghi chú mới cho thành viên.' },
      ] },
    ],
  },

  {
    id: 'calendar',
    eyebrow: 'Floor',
    titleEn: 'Calendar & bookings',
    titleVn: 'Lịch & đặt chỗ',
    introEn: 'Who&apos;s coming in, which room and table, when. Member bookings and house entries both live here.',
    introVn: 'Ai đến, phòng nào và bàn nào, khi nào. Cả đặt chỗ của thành viên lẫn mục nội bộ đều ở đây.',
    blocks: [
      { kind: 'p',
        en: '[/admin/calendar](/admin/calendar) is the weekly grid — day columns, today highlighted. Filter by space (Library Bar / The Studio / The Rampant Room / The Dining Room / Source & Origin Lab). Each card shows the member, party size, time or session, the booked **table(s)**, and any notes.',
        vn: '[/admin/calendar](/admin/calendar) là lưới theo tuần — cột theo ngày, hôm nay được tô sáng. Lọc theo không gian (Library Bar / The Studio / The Rampant Room / The Dining Room / Source & Origin Lab). Mỗi thẻ hiển thị thành viên, số khách, giờ hoặc phiên, **bàn** đã đặt, và ghi chú.' },
      { kind: 'h4', en: 'Booking a member in', vn: 'Đặt chỗ cho một thành viên' },
      { kind: 'ol', items: [
        { en: 'Hit **＋ New booking** at the top-right of the calendar. The form opens on the **Member booking** tab.',
          vn: 'Nhấn **＋ New booking** ở góc trên bên phải của lịch. Biểu mẫu mở ở tab **Member booking**.' },
        { en: 'Pick the member (autocomplete from the roster) and the date. Set **either** a precise start time **or** a session (early / evening / late) — both is fine. Set the party size.',
          vn: 'Chọn thành viên (gợi ý tự động từ danh sách) và ngày. Đặt **hoặc** giờ bắt đầu cụ thể **hoặc** một phiên (early / evening / late) — cả hai cũng được. Đặt số khách.' },
        { en: 'Pick the **Room**. The **Tables** picker below then shows every table in that room with its seat count.',
          vn: 'Chọn **Room**. Bộ chọn **Tables** bên dưới sẽ hiện mọi bàn trong phòng đó kèm số chỗ ngồi.' },
        { en: 'Tap the table(s) for this party. The running counter reads `N seats selected · party M` — the seats must cover the party. A six-top can&apos;t sit on a single four-seat table; add a second table or pick a bigger one.',
          vn: 'Chạm chọn (các) bàn cho nhóm này. Bộ đếm hiện `N seats selected · party M` — số chỗ phải đủ cho số khách. Nhóm sáu người không thể ngồi một bàn bốn chỗ; hãy thêm bàn thứ hai hoặc chọn bàn lớn hơn.' },
        { en: 'If the member has an email on file, optionally tick **Send confirmation email to the member** (Resend). No email → the checkbox disables itself and tells you.',
          vn: 'Nếu thành viên có email trong hồ sơ, tùy chọn tích **Send confirmation email to the member** (Resend). Không có email → ô tích tự khóa và báo cho bạn.' },
        { en: 'Save → back to the calendar with the booking on the right day, showing its table(s).',
          vn: 'Lưu → quay lại lịch với đặt chỗ ở đúng ngày, hiển thị (các) bàn của nó.' },
      ] },
      { kind: 'h4', en: 'The tables, room by room', vn: 'Các bàn, theo từng phòng' },
      { kind: 'ul', items: [
        { en: '**Library Bar** — Bookcase Table (4), Window Table (4), the **Sofa** (book it *whole* for up to 8, or as its three segments — left 3, middle 2, right 3), and six Bar Stools (1 each).',
          vn: '**Library Bar** — Bookcase Table (4), Window Table (4), chiếc **Sofa** (đặt *nguyên* tối đa 8 người, hoặc theo ba đoạn — trái 3, giữa 2, phải 3), và sáu Bar Stool (mỗi cái 1).' },
        { en: '**The Studio** — book it *whole* (the big table, seats 6), or as three tables of 2 (A / B / C).',
          vn: '**The Studio** — đặt *nguyên* (bàn lớn, 6 chỗ), hoặc theo ba bàn 2 chỗ (A / B / C).' },
        { en: '**The Rampant Room** — four independent tables: Table 1 & 2 (6 each), Table 3 & 4 (4 each).',
          vn: '**The Rampant Room** — bốn bàn độc lập: Table 1 & 2 (mỗi bàn 6), Table 3 & 4 (mỗi bàn 4).' },
        { en: '**The Dining Room** and **Source & Origin Lab** — one whole-room unit each; booking it takes the whole room (exclusive).',
          vn: '**The Dining Room** và **Source & Origin Lab** — mỗi nơi là một đơn vị nguyên phòng; đặt là lấy trọn phòng (độc quyền).' },
      ] },
      { kind: 'callout', title: { en: 'The either-or — Sofa & Studio', vn: 'Quy tắc một-hoặc-kia — Sofa & Studio' },
        en: 'Booking the **whole Sofa** blocks its three segments, and booking **any segment** blocks the whole Sofa — but the segments are independent of each other (left, middle and right can be three different parties). Same for the Studio (whole vs A / B / C). The bar stools and the room&apos;s other tables stay free regardless.',
        vn: 'Đặt **nguyên Sofa** sẽ khóa ba đoạn của nó, và đặt **bất kỳ đoạn nào** sẽ khóa nguyên Sofa — nhưng các đoạn độc lập với nhau (trái, giữa, phải có thể là ba nhóm khác nhau). Studio cũng vậy (nguyên bàn so với A / B / C). Ghế bar và các bàn khác trong phòng vẫn trống bình thường.' },
      { kind: 'callout', title: { en: 'Greyed tables & “unavailable”', vn: 'Bàn bị mờ & “unavailable”' },
        en: 'A table shows **greyed and unselectable** when it&apos;s already booked for that time, or when it conflicts with what you&apos;ve already picked (the either-or). If a save is refused as *unavailable*, that table was taken for the window — pick another table or time. The system will not let you double-book a table.',
        vn: 'Một bàn hiện **mờ và không chọn được** khi đã có người đặt cho khung giờ đó, hoặc khi nó xung đột với lựa chọn của bạn (quy tắc một-hoặc-kia). Nếu lưu bị từ chối là *unavailable*, bàn đó đã được giữ cho khung giờ — chọn bàn hoặc giờ khác. Hệ thống sẽ không cho đặt trùng một bàn.' },
      { kind: 'h4', en: 'Tap-to-start', vn: 'Chạm-để-bắt-đầu' },
      { kind: 'p',
        en: 'When a member taps their NFC card at the kiosk, the system: (1) creates a visit at phase=`overture` with arrival_time stamped, (2) if exactly one confirmed booking exists for them today, links it and flips the booking to *arrived*, (3) routes the host straight into the Guardian Angel detail page. Walk-ins work the same way — no booking link, but the cycle starts cleanly.',
        vn: 'Khi thành viên chạm thẻ NFC tại kiosk, hệ thống: (1) tạo một lần ghé ở phase=`overture` với arrival_time được đóng dấu, (2) nếu hôm nay họ có đúng một đặt chỗ đã xác nhận, liên kết nó và chuyển đặt chỗ sang *arrived*, (3) đưa người tiếp đón thẳng vào trang chi tiết Guardian Angel. Khách vãng lai cũng vậy — không có liên kết đặt chỗ, nhưng chu trình vẫn bắt đầu gọn gàng.' },
      { kind: 'p',
        en: 'From the calendar itself, today&apos;s confirmed/pending booking cards show a **◉ Start visit** button that does the same thing (member_no path instead of card_uid).',
        vn: 'Ngay trên lịch, các thẻ đặt chỗ confirmed/pending của hôm nay có nút **◉ Start visit** làm điều tương tự (theo member_no thay vì card_uid).' },
      { kind: 'callout', title: { en: 'Multiple bookings same day', vn: 'Nhiều đặt chỗ trong cùng ngày' },
        en: 'If a member has more than one confirmed booking today (e.g. dinner then drinks), the tap-to-start skips the auto-link — staff resolves which booking the arrival applies to from the calendar.',
        vn: 'Nếu một thành viên có nhiều hơn một đặt chỗ đã xác nhận trong hôm nay (vd. ăn tối rồi uống), chạm-để-bắt-đầu sẽ bỏ qua tự liên kết — nhân viên tự chọn lần đến này ứng với đặt chỗ nào trên lịch.' },
      { kind: 'h4', en: 'House entries — closures, hires & visits', vn: 'Mục nội bộ — đóng cửa, thuê riêng & khách ghé' },
      { kind: 'p',
        en: 'For anything that isn&apos;t a member booking — a closure, a private hire, a supplier or distiller visit, a tasting — use the **House / non-member entry** tab on the same **＋ New booking** form. Give it a title, a kind (closure / private hire / supplier / tasting / other), a date, and optionally a time and room.',
        vn: 'Với bất cứ điều gì không phải đặt chỗ của thành viên — đóng cửa, thuê riêng, nhà cung cấp hoặc nhà chưng cất ghé thăm, một buổi nếm thử — dùng tab **House / non-member entry** trên cùng biểu mẫu **＋ New booking**. Đặt tiêu đề, loại (closure / private hire / supplier / tasting / other), ngày, và tùy chọn giờ cùng phòng.' },
      { kind: 'callout', title: { en: 'Member-visible vs staff-only', vn: 'Hiển thị cho thành viên vs chỉ nhân viên' },
        en: 'Every house entry has a **Visibility**. **Member-visible (shows on member events)** means members see it on their events page — e.g. &quot;Club closed tonight&quot;. **Staff-only (members never see it)** is invisible to members — e.g. &quot;Private hire for the Nguyen party&quot;. When in doubt — anything members shouldn&apos;t see — choose staff-only.',
        vn: 'Mỗi mục nội bộ có một **Visibility**. **Member-visible (shows on member events)** nghĩa là thành viên thấy nó trên trang sự kiện — vd. &quot;Câu lạc bộ đóng cửa tối nay&quot;. **Staff-only (members never see it)** thì thành viên không thấy — vd. &quot;Thuê riêng cho nhóm nhà Nguyễn&quot;. Khi phân vân — bất cứ điều gì thành viên không nên thấy — chọn staff-only.' },
      { kind: 'callout', title: { en: 'Closing a room vs blocking a table', vn: 'Đóng cả phòng vs khóa một bàn' },
        en: 'Tick **Closes the room** and the entry blocks member bookings for that window. With **no tables picked**, the whole room closes. **Pick specific tables** and only those are blocked — a private hire of just the Sofa leaves the rest of the bar bookable. Leave &quot;closes the room&quot; off for something purely informational, like a distiller visit that doesn&apos;t take the space.',
        vn: 'Tích **Closes the room** thì mục này sẽ khóa việc đặt chỗ của thành viên trong khung giờ đó. **Không chọn bàn nào** → cả phòng đóng. **Chọn bàn cụ thể** → chỉ những bàn đó bị khóa — thuê riêng mỗi chiếc Sofa thì phần còn lại của quầy bar vẫn đặt được. Bỏ trống &quot;closes the room&quot; cho những việc chỉ mang tính thông báo, như một nhà chưng cất ghé thăm mà không chiếm chỗ.' },
    ],
  },

  {
    id: 'checklists',
    eyebrow: 'Floor',
    titleEn: 'Shift checklists',
    titleVn: 'Danh sách kiểm ca',
    introEn: 'Opening and closing sheets. Tick as you go; sign off at the end.',
    introVn: 'Phiếu mở ca và đóng ca. Tích khi làm; ký xác nhận khi xong.',
    blocks: [
      { kind: 'p',
        en: '[/admin/checklists](/admin/checklists) holds the day&apos;s opening and closing sheets side by side. The opening sheet is what the morning team works through; the closing sheet is what the night team finishes the day with. Both feed the MX Daily handover.',
        vn: '[/admin/checklists](/admin/checklists) đặt phiếu mở ca và đóng ca cạnh nhau. Phiếu mở ca là thứ đội buổi sáng làm theo; phiếu đóng ca là thứ đội buổi tối kết thúc ngày. Cả hai cùng nuôi phần bàn giao MX Daily.' },
      { kind: 'h4', en: 'How to use a sheet', vn: 'Cách dùng một phiếu' },
      { kind: 'ol', items: [
        { en: 'Type your initials in the field at the top-right of the page. Stored in your browser so you only do this once.',
          vn: 'Nhập tên viết tắt của bạn vào ô góc trên bên phải trang. Được lưu trong trình duyệt nên chỉ làm một lần.' },
        { en: 'Tick each item as you complete it. Your initials and a timestamp are captured automatically.',
          vn: 'Tích từng mục khi hoàn thành. Tên viết tắt và mốc thời gian được ghi tự động.' },
        { en: 'Write anything for the next team in **Notes for the handover**. This is the part Miss Châu reads on the MX Daily page in the morning.',
          vn: 'Ghi mọi điều cho đội kế tiếp vào **Notes for the handover**. Đây là phần Miss Châu đọc trên trang MX Daily vào buổi sáng.' },
        { en: 'At the end of the shift, hit **Lock & sign**. The sheet is sealed, the locking person is recorded, and the sheet renders read-only.',
          vn: 'Cuối ca, nhấn **Lock & sign**. Phiếu được niêm, người khóa được ghi lại, và phiếu chuyển sang chỉ-đọc.' },
      ] },
      { kind: 'h4', en: 'Editing the item list', vn: 'Chỉnh danh sách mục' },
      { kind: 'p',
        en: 'Items live in `lib/checklist-templates.ts`. Engineers can rename, add or remove items there; existing checklists keep whatever they already recorded. New items appear on every future day&apos;s sheet automatically.',
        vn: 'Các mục nằm trong `lib/checklist-templates.ts`. Kỹ sư có thể đổi tên, thêm hoặc bớt mục ở đó; các phiếu đã có vẫn giữ những gì đã ghi. Mục mới tự xuất hiện trên phiếu của mọi ngày sau.' },
      { kind: 'callout', title: { en: 'Yesterday&apos;s closing → today&apos;s MX Daily', vn: 'Đóng ca hôm qua → MX Daily hôm nay' },
        en: 'The most recent closing sheet&apos;s handover note surfaces at the top of [/admin/mx-daily](/admin/mx-daily). Miss Châu opens MX Daily first thing; reading the closing handover is part of her day-one ritual.',
        vn: 'Ghi chú bàn giao của phiếu đóng ca gần nhất hiện lên đầu [/admin/mx-daily](/admin/mx-daily). Miss Châu mở MX Daily đầu tiên; đọc bàn giao đóng ca là một phần nếp làm việc mỗi ngày của cô.' },
    ],
  },

  {
    id: 'harmony',
    eyebrow: 'Floor',
    titleEn: 'Harmony Log',
    titleVn: 'Harmony Log',
    introEn: 'End-of-shift narrative. Type what happened; Claude proposes structured updates.',
    introVn: 'Bản tường thuật cuối ca. Gõ những gì đã diễn ra; Claude đề xuất các cập nhật có cấu trúc.',
    blocks: [
      { kind: 'p',
        en: '[/admin/harmony](/admin/harmony) is where the team closes out a shift. You type one paragraph about the night — names, drinks, conversations, complaints, walk-ins, charges — and Claude reads it back and proposes a list of structured updates. You tick what to keep, hit Apply, and everything fans out to the right MIS tables.',
        vn: '[/admin/harmony](/admin/harmony) là nơi đội ngũ khép lại một ca. Bạn gõ một đoạn về buổi tối — tên, đồ uống, cuộc trò chuyện, khiếu nại, khách vãng lai, khoản tính tiền — và Claude đọc lại rồi đề xuất một danh sách cập nhật có cấu trúc. Bạn tích những gì muốn giữ, nhấn Apply, và mọi thứ tỏa về đúng các bảng MIS.' },
      { kind: 'h4', en: 'Daily flow', vn: 'Quy trình hằng ngày' },
      { kind: 'ol', items: [
        { en: 'End of shift, open [/admin/harmony/new](/admin/harmony/new).', vn: 'Cuối ca, mở [/admin/harmony/new](/admin/harmony/new).' },
        { en: 'Fill the shift metadata (date is pre-filled to today; pick early / evening / late / all-day).',
          vn: 'Điền thông tin ca (ngày đã điền sẵn là hôm nay; chọn early / evening / late / all-day).' },
        { en: 'Type the narrative. Be specific with names and drinks. Don&apos;t worry about format — write like you&apos;d brief the GM in person.',
          vn: 'Gõ bản tường thuật. Cụ thể về tên và đồ uống. Đừng lo định dạng — viết như khi bạn báo cáo trực tiếp với GM.' },
        { en: 'Hit **Save & Process**. You land on the detail page and the extraction stream kicks off automatically.',
          vn: 'Nhấn **Save & Process**. Bạn vào trang chi tiết và luồng trích xuất tự khởi động.' },
        { en: 'Review the checklist on the right. Each row shows the proposed update — a tier, an icon, the member hint, and a one-line summary. Untick anything you don&apos;t want; click × to reject.',
          vn: 'Duyệt danh sách bên phải. Mỗi dòng hiện cập nhật được đề xuất — một cấp, một biểu tượng, gợi ý thành viên, và tóm tắt một dòng. Bỏ tích những gì không muốn; nhấn × để từ chối.' },
        { en: 'Hit **Apply N →**. Accepted rows fan out into the live tables.',
          vn: 'Nhấn **Apply N →**. Các dòng được chấp nhận tỏa vào các bảng thật.' },
      ] },
      { kind: 'h4', en: 'What Claude proposes', vn: 'Claude đề xuất những gì' },
      { kind: 'ul', items: [
        { en: '**Visits** — one row per identified member, written to `visits` at `phase=&apos;accord&apos;` so they enter the Guardian Angel lifecycle. Open the visit detail to add a `data_for_next_overture` note and close out.',
          vn: '**Visits** — một dòng cho mỗi thành viên nhận diện được, ghi vào `visits` ở `phase=&apos;accord&apos;` để bước vào vòng đời Guardian Angel. Mở chi tiết lần ghé để thêm ghi chú `data_for_next_overture` và đóng lại.' },
        { en: '**Preferences** — bottles loved, requested, asked about → land in `preference_candidates` for a human review pass. Accepted ones become real preferences via [/admin/mis/candidates](/admin/mis/candidates).',
          vn: '**Preferences** — chai được yêu thích, được yêu cầu, được hỏi đến → vào `preference_candidates` để qua một lượt duyệt của con người. Những cái được chấp nhận thành sở thích thật qua [/admin/mis/candidates](/admin/mis/candidates).' },
        { en: '**Bottle pours** — depletes a bottle in the member&apos;s locker. &quot;finished&quot; → 0%; otherwise drops one quarter unless you specify a fill.',
          vn: '**Bottle pours** — làm vơi một chai trong tủ của thành viên. &quot;finished&quot; → 0%; nếu không sẽ giảm một phần tư trừ khi bạn chỉ định mức.' },
        { en: '**Prospects** — walk-ins mentioned as potential members. Mints a new P-xxx at the Lead stage, links the referrer if hinted.',
          vn: '**Prospects** — khách vãng lai được nhắc đến như thành viên tiềm năng. Cấp một P-xxx mới ở giai đoạn Lead, liên kết người giới thiệu nếu có gợi ý.' },
        { en: '**Complaints** — friction items. If the narrative says &quot;we fixed it&quot;, they&apos;re marked resolved on the spot.',
          vn: '**Complaints** — các điểm vướng. Nếu bản tường thuật nói &quot;đã xử lý&quot;, chúng được đánh dấu giải quyết ngay.' },
        { en: '**Card charges** — explicit amounts charged tonight. Inserts into `card_transactions` and decrements the live balance.',
          vn: '**Card charges** — các khoản tính tiền cụ thể trong tối nay. Chèn vào `card_transactions` và trừ vào số dư hiện tại.' },
      ] },
      { kind: 'callout', title: { en: 'Member resolution', vn: 'Khớp thành viên' },
        en: 'The team writes names how they normally would (&quot;Smith&quot;, &quot;Tran&quot;, &quot;Sarah&quot;). The apply step matches them against the live roster. If exactly one member matches, the update goes through. If zero or many match, the row is marked *failed* with the reason — open the log to see why and fix manually.',
        vn: 'Đội ngũ viết tên như bình thường (&quot;Smith&quot;, &quot;Trần&quot;, &quot;Sarah&quot;). Bước apply khớp chúng với danh sách thật. Nếu khớp đúng một thành viên, cập nhật đi qua. Nếu khớp không ai hoặc nhiều người, dòng bị đánh dấu *failed* kèm lý do — mở nhật ký để xem vì sao và sửa thủ công.' },
      { kind: 'callout', title: { en: 'Re-process is safe', vn: 'Xử lý lại là an toàn' },
        en: 'Hitting **↻ Re-process** wipes the pending extractions (already-applied rows are preserved) and re-runs Claude on the same narrative. Useful if you edit the narrative after seeing what was missed.',
        vn: 'Nhấn **↻ Re-process** xóa các trích xuất đang chờ (các dòng đã apply được giữ nguyên) và chạy lại Claude trên cùng bản tường thuật. Hữu ích nếu bạn sửa bản tường thuật sau khi thấy còn sót gì.' },
    ],
  },

  {
    id: 'mx-daily',
    eyebrow: 'Floor',
    titleEn: 'MX Daily',
    titleVn: 'MX Daily',
    introEn: 'The Member Experience Manager&apos;s daily checklist — birthdays, lapsed members, complaints.',
    introVn: 'Danh sách hằng ngày của Member Experience Manager — sinh nhật, thành viên thưa vắng, khiếu nại.',
    blocks: [
      { kind: 'p',
        en: '[/admin/mx-daily](/admin/mx-daily) bundles the Member Experience Manager&apos;s four daily checks into one screen:',
        vn: '[/admin/mx-daily](/admin/mx-daily) gom bốn việc kiểm tra hằng ngày của Member Experience Manager vào một màn hình:' },
      { kind: 'ol', items: [
        { en: '**Tonight&apos;s brief** — abridged version of the Tonight page.', vn: '**Tonight&apos;s brief** — bản rút gọn của trang Tonight.' },
        { en: '**Birthdays + milestones** — anyone with a birthday this week or hitting an N-year membership anniversary.',
          vn: '**Birthdays + milestones** — ai có sinh nhật tuần này hoặc chạm mốc kỷ niệm N năm thành viên.' },
        { en: '**Lapsed radar** — Active members who haven&apos;t visited in 30/60/90 days.',
          vn: '**Lapsed radar** — thành viên Active chưa ghé trong 30/60/90 ngày.' },
        { en: '**Complaint queue** — anything flagged as friction in the last 14 days.',
          vn: '**Complaint queue** — bất cứ điều gì bị đánh dấu là vướng mắc trong 14 ngày qua.' },
      ] },
      { kind: 'p',
        en: 'Pair this with the morning coffee. Anything flagged should generate one specific action by end of day — a card, a call, a comp pour at next visit.',
        vn: 'Kết hợp việc này với ly cà phê buổi sáng. Bất cứ điều gì được đánh dấu nên dẫn tới một hành động cụ thể trước cuối ngày — một tấm thiệp, một cuộc gọi, một ly mời ở lần ghé tới.' },
    ],
  },

  {
    id: 'journal',
    eyebrow: 'House',
    titleEn: 'Journal & house notes',
    titleVn: 'Nhật ký & ghi chú nội bộ',
    introEn: 'Where culture, decisions, and stories get written down.',
    introVn: 'Nơi văn hóa, quyết định và câu chuyện được ghi lại.',
    blocks: [
      { kind: 'p',
        en: '[/admin/journal](/admin/journal) is the cultural ledger. Capture what happened, decisions made, member stories. It is not a transactional log — that&apos;s what activity timelines are for. The journal is for the things future-us will want to remember about who we were.',
        vn: '[/admin/journal](/admin/journal) là sổ ghi văn hóa. Ghi lại những gì đã xảy ra, quyết định đã đưa ra, câu chuyện của thành viên. Đây không phải nhật ký giao dịch — đó là việc của dòng thời gian hoạt động. Nhật ký dành cho những điều mà chúng ta của tương lai sẽ muốn nhớ về con người mình từng là.' },
    ],
  },

  {
    id: 'gifting',
    eyebrow: 'Intelligence',
    titleEn: 'Gifting · Unreasonable Hospitality',
    titleVn: 'Quà tặng · Unreasonable Hospitality',
    introEn: '10–15% of each member’s dues earmarked for thoughtful, invisible love.',
    introVn: '10–15% phí của mỗi thành viên được dành riêng cho sự quan tâm chu đáo, thầm lặng.',
    blocks: [
      { kind: 'p',
        en: 'The principle: every member quietly carries a gifting budget — a percentage of what they pay us each year, set aside to surprise them. Birthday card with a bottle, dining experience after a difficult quarter, thank-you for a referral that mattered. The team logs what was given, why, and at what cost. The budget runs anniversary to anniversary so a year of nothing followed by a sudden splurge is visible.',
        vn: 'Nguyên tắc: mỗi thành viên âm thầm mang một ngân sách quà tặng — một phần trăm số tiền họ trả mỗi năm, để dành tạo bất ngờ cho họ. Một tấm thiệp sinh nhật kèm một chai rượu, một trải nghiệm ẩm thực sau một quý khó khăn, một lời cảm ơn cho một lượt giới thiệu có ý nghĩa. Đội ngũ ghi lại đã tặng gì, vì sao, và chi phí bao nhiêu. Ngân sách chạy từ kỷ niệm này đến kỷ niệm kế, nên một năm không có gì rồi đột ngột chi đậm sẽ lộ rõ.' },
      { kind: 'h4', en: 'Setting the budget', vn: 'Đặt ngân sách' },
      { kind: 'p',
        en: '[/admin/tier-budgets](/admin/tier-budgets) — one row per tier with annual dues and a gifting percentage. Multiply them together and you get the per-member annual budget. The founder/GM owns this page; dial 10→15% when calibrating the &quot;invisible love&quot; cap.',
        vn: '[/admin/tier-budgets](/admin/tier-budgets) — mỗi hạng một dòng với phí năm và phần trăm dành cho quà. Nhân chúng với nhau ra ngân sách năm cho mỗi thành viên. Trang này thuộc về nhà sáng lập/GM; chỉnh 10→15% khi hiệu chỉnh mức trần của &quot;tình cảm thầm lặng&quot;.' },
      { kind: 'h4', en: 'Logging a gift', vn: 'Ghi một món quà' },
      { kind: 'ol', items: [
        { en: 'Open [/admin/gifts](/admin/gifts) and hit **＋ Log a gift**.', vn: 'Mở [/admin/gifts](/admin/gifts) và nhấn **＋ Log a gift**.' },
        { en: 'Pick the member, the date, the occasion (birthday / anniversary / thoughtful / apology / recovery / dining moment / referral thanks / other), the category (bottle / experience / dining / etc.), and the cost in VND.',
          vn: 'Chọn thành viên, ngày, dịp (birthday / anniversary / thoughtful / apology / recovery / dining moment / referral thanks / other), danh mục (bottle / experience / dining / v.v.), và chi phí bằng VND.' },
        { en: 'Write the gift description, the source (vendor name if applicable), and — most important — **why we did this**. The dissertation calls this the &quot;expected value&quot; field. It&apos;s the receipt against the loyalty case.',
          vn: 'Viết mô tả món quà, nguồn (tên nhà cung cấp nếu có), và — quan trọng nhất — **vì sao ta làm điều này**. Luận văn gọi đây là trường &quot;expected value&quot;. Đó là biên nhận cho bài toán lòng trung thành.' },
        { en: 'Optionally upload a photo. Pick a member first to enable upload; the file goes to the private `gift-photos` bucket and a signed read URL is generated when the ledger displays it.',
          vn: 'Tùy chọn tải ảnh lên. Chọn thành viên trước để bật tải lên; tệp vào bucket riêng `gift-photos` và một URL đọc có chữ ký được tạo khi sổ hiển thị nó.' },
      ] },
      { kind: 'h4', en: 'Where it shows up', vn: 'Nó hiện ra ở đâu' },
      { kind: 'ul', items: [
        { en: '**The ledger itself** — org-wide list with filters by occasion. A red &quot;unloved members&quot; banner surfaces anyone with budget but no gift this cycle — the alarm bell.',
          vn: '**Chính cuốn sổ** — danh sách toàn tổ chức với bộ lọc theo dịp. Một dải đỏ &quot;unloved members&quot; nêu lên ai còn ngân sách nhưng chưa có quà trong kỳ này — chuông báo động.' },
        { en: '**MX Daily anniversaries panel** — each anniversary row shows a tiny progress bar: how much of that member&apos;s annual budget is spent, with the bar going red if they&apos;ve had zero gifts. Miss Châu sees at a glance who&apos;s overdue for a touch.',
          vn: '**Bảng kỷ niệm MX Daily** — mỗi dòng kỷ niệm hiện một thanh tiến độ nhỏ: đã tiêu bao nhiêu ngân sách năm của thành viên đó, thanh chuyển đỏ nếu họ chưa nhận quà nào. Miss Châu nhìn một cái là biết ai đã quá hạn được quan tâm.' },
        { en: '**Member profile** — coming soon: per-member gifting history with the same budget view.',
          vn: '**Hồ sơ thành viên** — sắp có: lịch sử quà tặng theo từng thành viên với cùng góc nhìn ngân sách.' },
      ] },
      { kind: 'callout', title: { en: 'Invisible love, visible spend', vn: 'Tình cảm thầm lặng, chi tiêu rõ ràng' },
        en: 'The member never sees this page. The point is that the team can track and budget the &quot;random, thoughtful gifting&quot; principle systematically, so it actually happens, evenly, across every member, every year.',
        vn: 'Thành viên không bao giờ thấy trang này. Điểm mấu chốt là đội ngũ có thể theo dõi và lập ngân sách cho nguyên tắc &quot;tặng quà ngẫu nhiên, chu đáo&quot; một cách hệ thống, để nó thật sự diễn ra, đều đặn, cho mọi thành viên, mỗi năm.' },
    ],
  },

  {
    id: 'whisky-tools',
    eyebrow: 'Whisky Library',
    titleEn: 'Whisky tools',
    titleVn: 'Công cụ whisky',
    introEn: 'Match a member to a dram — Suggest a pour, the Flavour Finder, the flavour radar.',
    introVn: 'Ghép một thành viên với một ly rượu — Suggest a pour, Flavour Finder, biểu đồ radar hương vị.',
    blocks: [
      { kind: 'p',
        en: 'A set of tools for putting the right whisky in front of a member, all grounded in the club&apos;s flavour data (the 13-family taxonomy) rather than guesswork.',
        vn: 'Một bộ công cụ để đặt đúng chai whisky trước mặt thành viên, tất cả dựa trên dữ liệu hương vị của câu lạc bộ (hệ phân loại 13 nhóm) thay vì phỏng đoán.' },
      { kind: 'h4', en: 'Suggest a pour', vn: 'Suggest a pour' },
      { kind: 'p',
        en: 'On a member&apos;s record ([/admin/mis](/admin/mis) → open the member) there&apos;s a **Suggest a pour** panel. Hit **◆ Suggest →** and it recommends bottles from that member&apos;s own taste profile. If their palate isn&apos;t mapped yet, you can tap a flavour shape and suggest from that instead — it always recommends from real bottles in the library, never invents one.',
        vn: 'Trong hồ sơ một thành viên ([/admin/mis](/admin/mis) → mở thành viên) có bảng **Suggest a pour**. Nhấn **◆ Suggest →** và nó gợi ý các chai dựa trên hồ sơ khẩu vị của chính thành viên đó. Nếu khẩu vị của họ chưa được lập, bạn có thể chạm chọn một hình dạng hương vị và gợi ý từ đó — nó luôn gợi ý từ các chai có thật trong thư viện, không bao giờ bịa ra.' },
      { kind: 'h4', en: 'Flavour Finder & the radar', vn: 'Flavour Finder & biểu đồ radar' },
      { kind: 'p',
        en: 'The [Flavour Finder](/members/whisky/finder) matches a dram to a described taste — members can self-serve it, or you can run it with them. Each bottle in the [Whisky Library](/members/whisky) has a **flavour radar** showing its profile across the families — a quick visual of whether a bottle is, say, peaty and coastal or sweet and sherried.',
        vn: '[Flavour Finder](/members/whisky/finder) ghép một ly rượu với khẩu vị được mô tả — thành viên có thể tự dùng, hoặc bạn cùng làm với họ. Mỗi chai trong [Whisky Library](/members/whisky) có một **biểu đồ radar hương vị** thể hiện hồ sơ của nó qua các nhóm — một hình ảnh nhanh cho biết một chai là, chẳng hạn, khói than và mặn biển hay ngọt và sherry.' },
      { kind: 'callout', title: { en: 'When to reach for it', vn: 'Khi nào nên dùng' },
        en: 'A member unsure what to drink, or a guest you don&apos;t know well — open their record and hit Suggest a pour, or run the Finder together. It turns &quot;what do you fancy?&quot; into two or three confident, on-taste options.',
        vn: 'Một thành viên chưa biết uống gì, hoặc một vị khách bạn chưa hiểu rõ — mở hồ sơ của họ và nhấn Suggest a pour, hoặc cùng dùng Finder. Nó biến câu &quot;bạn thích gì?&quot; thành hai hoặc ba lựa chọn tự tin, đúng gu.' },
    ],
  },

  {
    id: 'what-members-see',
    eyebrow: 'Reference',
    titleEn: 'What members see',
    titleVn: 'Thành viên thấy những gì',
    introEn: 'The member portal — so you can guide a member and know the boundaries.',
    introVn: 'Cổng thành viên — để bạn hướng dẫn thành viên và biết giới hạn.',
    blocks: [
      { kind: 'p',
        en: 'Members with a login (see **Member logins & onboarding**) have their own portal. Knowing what&apos;s there helps you answer their questions.',
        vn: 'Thành viên có tài khoản (xem **Member logins & onboarding**) có cổng riêng của họ. Biết những gì ở đó giúp bạn trả lời câu hỏi của họ.' },
      { kind: 'ul', items: [
        { en: 'The **Whisky Library** — the bottles as an A–Z shelf, searchable, each with its flavour radar; and the **Flavour Finder**.',
          vn: '**Whisky Library** — các chai dưới dạng kệ A–Z, tìm kiếm được, mỗi chai kèm biểu đồ radar hương vị; và **Flavour Finder**.' },
        { en: 'For an onboarded member, their **own** personal layer: their **palate** (a written taste summary + radar), their **visits**, and **gifts** they&apos;ve received from the club.',
          vn: 'Với một thành viên đã onboard, lớp cá nhân **của riêng** họ: **khẩu vị** (một bản tóm tắt khẩu vị bằng chữ + radar), các **lần ghé**, và **quà tặng** họ đã nhận từ câu lạc bộ.' },
        { en: 'Events & notices (including member-visible house entries), fixtures, spaces, the menus, house rules.',
          vn: 'Sự kiện & thông báo (bao gồm các mục nội bộ được hiển thị cho thành viên), lịch thi đấu, không gian, thực đơn, nội quy.' },
      ] },
      { kind: 'callout', title: { en: 'The boundaries', vn: 'Các giới hạn' },
        en: 'A member sees **only their own** data — never another member&apos;s taste, visits or gifts. And members **can&apos;t book themselves** — booking is staff-only, so if a member wants a table they ask you, and you book it on the calendar.',
        vn: 'Một thành viên chỉ thấy dữ liệu **của riêng họ** — không bao giờ thấy khẩu vị, lần ghé hay quà tặng của thành viên khác. Và thành viên **không thể tự đặt chỗ** — đặt chỗ chỉ do nhân viên làm, nên nếu một thành viên muốn một bàn họ sẽ nhờ bạn, và bạn đặt trên lịch.' },
    ],
  },

  {
    id: 'troubleshooting',
    eyebrow: 'Reference',
    titleEn: 'Troubleshooting',
    titleVn: 'Xử lý sự cố',
    introEn: 'Things that look broken but usually are not.',
    introVn: 'Những thứ trông như hỏng nhưng thường thì không.',
    blocks: [
      { kind: 'h4', en: 'I sent an invitation but no email arrived', vn: 'Tôi đã gửi thư mời nhưng không có email nào đến' },
      { kind: 'p',
        en: 'Check the invitation status pill on the prospect&apos;s profile. If it says &quot;sent&quot; but the recipient didn&apos;t get it, look for the link via **Copy link** and share it manually. Resend can be slow during high-volume periods; check spam too. If a different error appears in the activity log, escalate to the engineer.',
        vn: 'Kiểm tra nhãn trạng thái thư mời trên hồ sơ của khách. Nếu nó ghi &quot;sent&quot; mà người nhận không nhận được, lấy liên kết qua **Copy link** và gửi thủ công. Resend có thể chậm vào lúc cao điểm; kiểm tra cả hộp spam. Nếu một lỗi khác hiện trong nhật ký hoạt động, chuyển cho kỹ sư.' },
      { kind: 'h4', en: 'A kiosk tap shows &quot;orphaned&quot;', vn: 'Một cú chạm kiosk hiện &quot;orphaned&quot;' },
      { kind: 'p',
        en: 'The card has never been linked to a member. Open [/admin/cards](/admin/cards), find the orphan, link it.',
        vn: 'Thẻ chưa bao giờ được liên kết với thành viên. Mở [/admin/cards](/admin/cards), tìm thẻ orphan, liên kết nó.' },
      { kind: 'h4', en: 'A prospect&apos;s PS(t) is locked at 0', vn: 'PS(t) của một khách bị kẹt ở 0' },
      { kind: 'p',
        en: 'They have no preferences captured yet, or all preferences are archived. Open the profile, add or revalidate at least one preference.',
        vn: 'Họ chưa có sở thích nào được ghi nhận, hoặc mọi sở thích đã được lưu trữ. Mở hồ sơ, thêm hoặc revalidate ít nhất một sở thích.' },
      { kind: 'h4', en: 'Lockers wall is empty', vn: 'Tường tủ rượu trống trơn' },
      { kind: 'p',
        en: 'The grid needs to be seeded. Click **＋ Seed grid** on the Lockers page and tell it your rows × cols. Existing assignments are preserved.',
        vn: 'Lưới cần được khởi tạo. Nhấn **＋ Seed grid** trên trang Lockers và nhập số hàng × cột. Các phần đã gán được giữ nguyên.' },
    ],
  },
]

export default function TrainingPage() {
  const { t } = useLang()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([SECTIONS[0].id]))
  const [q, setQ] = useState('')
  const [lang, setLang] = useState<Lang>('en')

  const toggle = (id: string) => {
    setOpenIds(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const expandAll = () => setOpenIds(new Set(SECTIONS.map(s => s.id)))
  const collapseAll = () => setOpenIds(new Set())

  const filtered = q.trim()
    ? SECTIONS.filter(s => (s.titleEn + ' ' + s.titleVn + ' ' + s.introEn + ' ' + s.introVn + ' ' + s.eyebrow).toLowerCase().includes(q.toLowerCase()))
    : SECTIONS

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>House</div>
        <h1 style={pageTitle}>{t('Training', 'Đào tạo')}</h1>
        <p style={lede}>
          {t('The team handbook for the admin portal. Browse top-to-bottom on your first day, then come back for specific tasks. Sections collapse — open what you need.', 'Cẩm nang của đội ngũ dành cho cổng quản trị. Đọc từ trên xuống dưới trong ngày đầu, rồi quay lại khi cần làm việc cụ thể. Các mục có thể thu gọn — mở phần bạn cần.')}
        </p>
      </div>

      {/* Language toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['en', 'vn'] as Lang[]).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.04em', padding: '6px 20px', borderRadius: 20, cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: lang === l ? '1px solid transparent' : '1px solid rgba(229,212,194,0.2)',
              background: lang === l ? 'rgba(229,212,194,0.12)' : 'transparent',
              color: lang === l ? '#E5D4C2' : '#B2AA98',
            }}
          >
            {l === 'en' ? 'EN' : 'VN'}
          </button>
        ))}
      </div>

      {lang === 'vn' && (
        <div style={draftBanner}>
          Bản dịch tiếng Việt đang được rà soát — nếu chưa chắc, hãy đối chiếu bản tiếng Anh. · Vietnamese translation under review.
        </div>
      )}

      <div style={toolbarRow}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('Search sections…', 'Tìm mục…')}
          style={{ ...inputStyle, maxWidth: 360 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={expandAll} style={btnGhost}>{t('Expand all', 'Mở tất cả')}</button>
          <button onClick={collapseAll} style={btnGhost}>{t('Collapse all', 'Thu gọn tất cả')}</button>
        </div>
      </div>

      {/* TOC */}
      <div style={tocBlock}>
        <div style={tocLabel}>{t('Sections', 'Các mục')}</div>
        <div style={tocGrid}>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} style={tocLink}>
              <span style={tocEyebrow}>{s.eyebrow}</span>
              <span>{dec(lang === 'vn' ? s.titleVn : s.titleEn)}</span>
            </a>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(s => {
          const open = openIds.has(s.id)
          return (
            <div key={s.id} id={s.id} style={sectionCard}>
              <button onClick={() => toggle(s.id)} style={sectionHeader}>
                <div>
                  <div style={sectionEyebrow}>{s.eyebrow}</div>
                  <div style={sectionTitleText}>{dec(lang === 'vn' ? s.titleVn : s.titleEn)}</div>
                  <div style={sectionIntro}>{dec(lang === 'vn' ? s.introVn : s.introEn)}</div>
                </div>
                <div style={chevron}>{open ? '−' : '＋'}</div>
              </button>
              {open && <div style={sectionBody}>{renderBlocks(s.blocks, lang)}</div>}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={emptyText}>{t('No sections match', 'Không có mục nào khớp')} &quot;{q}&quot;.</div>
        )}
      </div>
    </>
  )
}

// ── styles ────────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const draftBanner: React.CSSProperties = {
  background: 'rgba(212,184,90,0.10)', border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 6, padding: '10px 14px', marginBottom: 16,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', letterSpacing: '0.02em', lineHeight: 1.6,
}
const toolbarRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 12, flexWrap: 'wrap', marginBottom: 16,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none', flex: 1,
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 14px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
const tocBlock: React.CSSProperties = {
  padding: 16,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.06)', borderRadius: 8,
}
const tocLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 10,
}
const tocGrid: React.CSSProperties = {
  display: 'grid', gap: 6,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}
const tocLink: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  padding: '8px 10px', textDecoration: 'none',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 6,
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const tocEyebrow: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#B2AA98',
}
const sectionCard: React.CSSProperties = {
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8,
  overflow: 'hidden',
}
const sectionHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  width: '100%', padding: '18px 22px',
  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
}
const sectionEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const sectionTitleText: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
  color: '#E5D4C2', margin: '4px 0 4px',
}
const sectionIntro: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.8, lineHeight: 1.6, maxWidth: 700,
}
const chevron: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 18,
  color: '#D4B85A', padding: '0 4px',
}
const sectionBody: React.CSSProperties = {
  padding: '0 22px 22px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', lineHeight: 1.75, letterSpacing: '0.02em',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
