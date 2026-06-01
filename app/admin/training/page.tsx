'use client'

import { useState } from 'react'
import Link from 'next/link'

// Admin / House / Training
//
// Living team handbook for the CRM (MIS) and the rest of the admin portal.
// Sections are collapsible so the team can land here and drill into whatever
// they need. Update sections in this file — it's a single source of truth.

interface SectionDef {
  id: string
  title: string
  eyebrow: string
  intro: string
  body: React.ReactNode
}

// Hoisted style constants — referenced inside SECTIONS so they must be
// declared before the array.
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

const SECTIONS: SectionDef[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    eyebrow: 'Orientation',
    intro: 'What the CRM is, who it is for, and how to think about it.',
    body: (
      <>
        <p>
          The admin portal at <Code>/admin</Code> is the team&apos;s working surface — it&apos;s where we manage prospects, members, the whisky library, the floor, and everything in between. It is <em>not</em> a public-facing site; only signed-in admins reach it.
        </p>
        <p>
          The sidebar is grouped by job-to-be-done:
        </p>
        <ul style={ulStyle}>
          <li><strong>Floor</strong> — what you need when you&apos;re at the club: tonight&apos;s brief, the MX Daily checklist, notices, quick reference.</li>
          <li><strong>Intelligence</strong> — the CRM itself: the Pipeline (prospects), the User roster, Member Cards (NFC), Agreements (signed PDFs).</li>
          <li><strong>Whisky Library</strong> — Inventory, Lockers, Fixtures.</li>
          <li><strong>House</strong> — House Rules, Journal, Press, this Training doc.</li>
        </ul>
        <Callout title="Golden rule">
          Everything you do in the admin portal is logged. Activity timelines on members and prospects are the team&apos;s collective memory — write clear, professional notes; assume the GM, the MX, and the founder will all read them.
        </Callout>
      </>
    ),
  },

  {
    id: 'pipeline',
    title: 'Pipeline (prospects)',
    eyebrow: 'Intelligence',
    intro: 'How to add a prospect, move them through the stages, and convert them into a member.',
    body: (
      <>
        <p>
          The Pipeline at <Link href="/admin/mis/pipeline" style={linkStyle}>/admin/mis/pipeline</Link> is the kanban for everyone who isn&apos;t a member yet. Cards move left-to-right through six active stages, plus three off-ramps for prospects who don&apos;t convert.
        </p>
        <h4 style={h4}>Active stages</h4>
        <Stages
          items={[
            ['Lead', 'A name on the radar. No commitment, no contact yet.'],
            ['Initial Contact', 'We have reached out, or they have reached out to us. First impression formed.'],
            ['Interview Scheduled', 'A face-to-face is on the calendar.'],
            ['Interview Complete', 'Interview happened; we are deciding.'],
            ['Application Received', 'Signing invitation has been sent; awaiting their signature.'],
            ['Onboarded', 'They have signed; they are an active member.'],
          ]}
        />
        <h4 style={h4}>Off-ramps</h4>
        <Stages
          items={[
            ['Declined', 'We chose not to extend an invitation.'],
            ['Withdrawn', 'They withdrew themselves.'],
            ['On Hold', 'Paused — revisit later, do not delete.'],
          ]}
        />
        <h4 style={h4}>Daily flow</h4>
        <ol style={olStyle}>
          <li>Open the Pipeline first thing. Glance at the <em>Needs attention</em> dashboard at the top — stale leads, interviews this week, actions due.</li>
          <li>Add new prospects via the <strong>＋ Add prospect</strong> button. Minimum required: full name. Capture source, referred-by, and contact info if you have them.</li>
          <li>For interviews: open the prospect, fill in the <em>Interview</em> section. After the interview, use the rubric to score 1–5 on each dimension. The overall score appears live.</li>
          <li>When ready to admit: hit <strong>✉ Send signing invitation</strong> — see the next section.</li>
        </ol>
        <Callout title="Quick actions on cards">
          Hover any card in the kanban. You&apos;ll see three icons: <strong>→</strong> moves to the next stage, <strong>✉</strong> toggles letter-sent, <strong>×</strong> archives. Use these to fly through stage updates.
        </Callout>
      </>
    ),
  },

  {
    id: 'signing-loop',
    title: 'Signing loop',
    eyebrow: 'Intelligence',
    intro: 'How a prospect becomes a fully Active member: send the link, they sign, status flips.',
    body: (
      <>
        <p>
          The signing loop turns an approved prospect into a member with a signed agreement on file — automatically. You no longer need to manually convert prospects to members.
        </p>
        <h4 style={h4}>Step by step</h4>
        <ol style={olStyle}>
          <li>Open the prospect&apos;s detail page.</li>
          <li>In the sidebar, click <strong>✉ Send signing invitation</strong>.</li>
          <li>Pick the tier (Founding / Legacy / Pioneer / Corporate / Honorary), confirm the email (auto-detected from contact info), add mobile if you have it.</li>
          <li>Hit <strong>Send invitation</strong>. Behind the scenes:
            <ul style={ulStyle}>
              <li>A <Code>member_no</Code> is minted (or the existing provisional one is reused).</li>
              <li>A <Code>members</Code> row is created with status <Code>Pending Signature</Code>.</li>
              <li>A signing invitation is created with a unique link.</li>
              <li>An email goes out via Resend.</li>
              <li>The prospect flips to <em>Application Received</em>.</li>
            </ul>
          </li>
          <li>The sidebar now shows invitation status — sent date, viewed/view-count, reminder count. You can <strong>Resend email</strong>, <strong>Copy link</strong>, or <strong>Revoke</strong>.</li>
          <li>When they sign, everything closes the loop: member flips to <em>Active</em> with today&apos;s join date, prospect flips to <em>Onboarded</em>, and a signed PDF lands in storage.</li>
        </ol>
        <Callout title="When to use Force convert">
          The <em>★ Force convert without signing</em> override creates an Active member with no agreement on file. Only use this when a paper agreement has been signed offline and you&apos;re catching up the system.
        </Callout>
      </>
    ),
  },

  {
    id: 'members',
    title: 'Members (MIS)',
    eyebrow: 'Intelligence',
    intro: 'The member roster, the PS(t) score, preferences, and revalidation.',
    body: (
      <>
        <p>
          <Link href="/admin/mis" style={linkStyle}>/admin/mis</Link> is the member intelligence dashboard. Every member has a profile showing their preferences, scoring history, and activity. The headline number is <strong>PS(t)</strong> — the time-decayed preference score.
        </p>
        <h4 style={h4}>What PS(t) means</h4>
        <p>
          PS(t) = S₀ × C × e^(−λt) × F × R × M, clamped 0..5. In plain English: a preference&apos;s power fades over time unless you revalidate it. A member who said &quot;loves Bowmore&quot; 18 months ago and hasn&apos;t reordered will have a much lower PS(t) than someone who reordered last week.
        </p>
        <ul style={ulStyle}>
          <li><strong>S₀</strong> — base strength (1–5) when the preference was first captured.</li>
          <li><strong>C</strong> — confidence factor (was this said directly, observed, or inferred?).</li>
          <li><strong>λ</strong> — decay rate. Longer-lived preferences (a love of Highland malts) decay slower than transient ones (a phase with rye).</li>
          <li><strong>F</strong> — frequency multiplier (how often they reorder).</li>
          <li><strong>R</strong> — recency boost (last engagement).</li>
          <li><strong>M</strong> — multiplier from confirmed re-statements (revalidations).</li>
        </ul>
        <h4 style={h4}>Revalidating preferences</h4>
        <p>
          When a member reconfirms a preference (they ordered it again, mentioned it again, gave you new feedback), use the <strong>Revalidate</strong> button. This bumps R and M and refreshes the timestamp, so PS(t) climbs back up.
        </p>
        <h4 style={h4}>Adding preferences from interviews</h4>
        <p>
          During or after an interview, upload the transcript on the prospect&apos;s profile and the system extracts structured preferences using Claude. Review each extracted preference, edit if needed, accept. They land on the provisional member&apos;s profile.
        </p>
      </>
    ),
  },

  {
    id: 'lockers',
    title: 'Lockers',
    eyebrow: 'Whisky Library',
    intro: 'Visual map of the physical locker wall. Assign members, track bottles and fill levels.',
    body: (
      <>
        <p>
          <Link href="/admin/lockers" style={linkStyle}>/admin/lockers</Link> mirrors the physical wall. Each tile is a real locker; the position on the screen matches the position on the wall (row + column).
        </p>
        <h4 style={h4}>Tile colours</h4>
        <ul style={ulStyle}>
          <li><span style={{ color: '#7AB07A' }}>Green</span> — occupied (assigned to a member).</li>
          <li><span style={{ color: '#D4B85A' }}>Gold</span> — reserved (held but not yet active).</li>
          <li><span style={{ color: '#B2AA98' }}>Muted</span> — empty.</li>
          <li><span style={{ color: '#C27070' }}>Red-tinted</span> — retired (broken, removed, do not assign).</li>
        </ul>
        <h4 style={h4}>Assigning a locker</h4>
        <ol style={olStyle}>
          <li>Click any empty tile.</li>
          <li>In the drawer, search for the member by name or number. Click them — assignment is instant.</li>
          <li>Optionally set a custom display label (e.g. &quot;Bowmore Society — corner&quot;).</li>
        </ol>
        <h4 style={h4}>Tracking contents</h4>
        <ol style={olStyle}>
          <li>Open the locker. Scroll to <em>Contents</em>.</li>
          <li>Add a bottle: name, distillery, age, ABV, fill %.</li>
          <li>Drag the fill slider whenever a bottle is poured down. Anything ≤ 25% shows up on the dashboard as a top-up opportunity.</li>
        </ol>
        <Callout title="Tip">
          Use the <em>Notes</em> field for things the team should know — lock combinations, fragile glass, members who like a specific glass paired with their bottle.
        </Callout>
      </>
    ),
  },

  {
    id: 'cards',
    title: 'Member cards (NFC)',
    eyebrow: 'Intelligence',
    intro: 'Linking physical NFC cards to member profiles.',
    body: (
      <>
        <p>
          <Link href="/admin/cards" style={linkStyle}>/admin/cards</Link> is where physical NFC cards get bound to member records. Once linked, a tap at any kiosk pulls up the member instantly.
        </p>
        <ol style={olStyle}>
          <li>Open the card admin page.</li>
          <li>Tap a fresh card at the kiosk (it shows up as orphaned).</li>
          <li>From the admin page, link it to the right member by selecting them.</li>
        </ol>
        <p>
          Cards carry stored credit (in VND). Top-ups happen via the transaction endpoint; the kiosk shows current balance after every tap.
        </p>
      </>
    ),
  },

  {
    id: 'tonight',
    title: 'Tonight',
    eyebrow: 'Floor',
    intro: 'Pre-shift brief: who is coming in, what they prefer, what to remember.',
    body: (
      <>
        <p>
          <Link href="/admin/tonight" style={linkStyle}>/admin/tonight</Link> is the manager&apos;s first stop of the evening. Bookings cross-referenced with member intelligence: top preferences, last-visit notes, birthday/anniversary flags.
        </p>
        <h4 style={h4}>How to use it</h4>
        <ul style={ulStyle}>
          <li>Print or screen-mirror to the back-of-house monitor.</li>
          <li>Brief the team — call out anyone with a milestone, anyone with an open complaint, anyone the GM has asked the team to give special attention.</li>
          <li>After service, jot any new preferences or notes against the member.</li>
        </ul>
      </>
    ),
  },

  {
    id: 'harmony',
    title: 'Harmony Log',
    eyebrow: 'Floor',
    intro: 'End-of-shift narrative. Type what happened; Claude proposes structured updates.',
    body: (
      <>
        <p>
          <Link href="/admin/harmony" style={linkStyle}>/admin/harmony</Link> is where the team closes out a shift. You type one paragraph about the night — names, drinks, conversations, complaints, walk-ins, charges — and Claude reads it back and proposes a list of structured updates. You tick what to keep, hit Apply, and everything fans out to the right MIS tables.
        </p>
        <h4 style={h4}>Daily flow</h4>
        <ol style={olStyle}>
          <li>End of shift, open <Link href="/admin/harmony/new" style={linkStyle}>/admin/harmony/new</Link>.</li>
          <li>Fill the shift metadata (date is pre-filled to today; pick early / evening / late / all-day).</li>
          <li>Type the narrative. Be specific with names and drinks. Don&apos;t worry about format — write like you&apos;d brief the GM in person.</li>
          <li>Hit <strong>Save &amp; Process</strong>. You land on the detail page and the extraction stream kicks off automatically.</li>
          <li>Review the checklist on the right. Each row shows the proposed update — a tier, an icon, the member hint, and a one-line summary. Untick anything you don&apos;t want; click × to reject.</li>
          <li>Hit <strong>Apply N →</strong>. Accepted rows fan out into the live tables.</li>
        </ol>
        <h4 style={h4}>What Claude proposes</h4>
        <ul style={ulStyle}>
          <li><strong>Visits</strong> — one row per identified member, written to <Code>visits</Code> at <Code>phase=&apos;accord&apos;</Code> so they enter the Guardian Angel lifecycle. Open the visit detail to add a <Code>data_for_next_overture</Code> note and close out.</li>
          <li><strong>Preferences</strong> — bottles loved, requested, asked about → land in <Code>preference_candidates</Code> for a human review pass. Accepted ones become real preferences via <Link href="/admin/mis/candidates" style={linkStyle}>/admin/mis/candidates</Link>.</li>
          <li><strong>Bottle pours</strong> — depletes a bottle in the member&apos;s locker. &quot;finished&quot; → 0%; otherwise drops one quarter unless you specify a fill.</li>
          <li><strong>Prospects</strong> — walk-ins mentioned as potential members. Mints a new P-xxx at the Lead stage, links the referrer if hinted.</li>
          <li><strong>Complaints</strong> — friction items. If the narrative says &quot;we fixed it&quot;, they&apos;re marked resolved on the spot.</li>
          <li><strong>Card charges</strong> — explicit amounts charged tonight. Inserts into <Code>card_transactions</Code> and decrements the live balance.</li>
        </ul>
        <Callout title="Member resolution">
          The team writes names how they normally would (&quot;Smith&quot;, &quot;Tran&quot;, &quot;Sarah&quot;). The apply step matches them against the live roster. If exactly one member matches, the update goes through. If zero or many match, the row is marked <em>failed</em> with the reason — open the log to see why and fix manually.
        </Callout>
        <Callout title="Re-process is safe">
          Hitting <strong>↻ Re-process</strong> wipes the pending extractions (already-applied rows are preserved) and re-runs Claude on the same narrative. Useful if you edit the narrative after seeing what was missed.
        </Callout>
      </>
    ),
  },

  {
    id: 'mx-daily',
    title: 'MX Daily',
    eyebrow: 'Floor',
    intro: 'The Member Experience Manager&apos;s daily checklist — birthdays, lapsed members, complaints.',
    body: (
      <>
        <p>
          <Link href="/admin/mx-daily" style={linkStyle}>/admin/mx-daily</Link> bundles the Member Experience Manager&apos;s four daily checks into one screen:
        </p>
        <ol style={olStyle}>
          <li><strong>Tonight&apos;s brief</strong> — abridged version of the Tonight page.</li>
          <li><strong>Birthdays + milestones</strong> — anyone with a birthday this week or hitting an N-year membership anniversary.</li>
          <li><strong>Lapsed radar</strong> — Active members who haven&apos;t visited in 30/60/90 days.</li>
          <li><strong>Complaint queue</strong> — anything flagged as friction in the last 14 days.</li>
        </ol>
        <p>
          Pair this with the morning coffee. Anything flagged should generate one specific action by end of day — a card, a call, a comp pour at next visit.
        </p>
      </>
    ),
  },

  {
    id: 'journal',
    title: 'Journal & house notes',
    eyebrow: 'House',
    intro: 'Where culture, decisions, and stories get written down.',
    body: (
      <>
        <p>
          <Link href="/admin/journal" style={linkStyle}>/admin/journal</Link> is the cultural ledger. Capture what happened, decisions made, member stories. It is not a transactional log — that&apos;s what activity timelines are for. The journal is for the things future-us will want to remember about who we were.
        </p>
      </>
    ),
  },

  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    eyebrow: 'Reference',
    intro: 'Things that look broken but usually are not.',
    body: (
      <>
        <h4 style={h4}>I sent an invitation but no email arrived</h4>
        <p>
          Check the invitation status pill on the prospect&apos;s profile. If it says &quot;sent&quot; but the recipient didn&apos;t get it, look for the link via <strong>Copy link</strong> and share it manually. Resend can be slow during high-volume periods; check spam too. If a different error appears in the activity log, escalate to the engineer.
        </p>
        <h4 style={h4}>A kiosk tap shows &quot;orphaned&quot;</h4>
        <p>
          The card has never been linked to a member. Open <Link href="/admin/cards" style={linkStyle}>/admin/cards</Link>, find the orphan, link it.
        </p>
        <h4 style={h4}>A prospect&apos;s PS(t) is locked at 0</h4>
        <p>
          They have no preferences captured yet, or all preferences are archived. Open the profile, add or revalidate at least one preference.
        </p>
        <h4 style={h4}>Lockers wall is empty</h4>
        <p>
          The grid needs to be seeded. Click <strong>＋ Seed grid</strong> on the Lockers page and tell it your rows × cols. Existing assignments are preserved.
        </p>
      </>
    ),
  },
]

export default function TrainingPage() {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([SECTIONS[0].id]))
  const [q, setQ] = useState('')

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
    ? SECTIONS.filter(s => (s.title + ' ' + s.intro + ' ' + s.eyebrow).toLowerCase().includes(q.toLowerCase()))
    : SECTIONS

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>House</div>
        <h1 style={pageTitle}>Training</h1>
        <p style={lede}>
          The team handbook for the admin portal. Browse top-to-bottom on your first day, then come back for specific tasks. Sections collapse — open what you need.
        </p>
      </div>

      <div style={toolbarRow}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search sections…"
          style={{ ...inputStyle, maxWidth: 360 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={expandAll} style={btnGhost}>Expand all</button>
          <button onClick={collapseAll} style={btnGhost}>Collapse all</button>
        </div>
      </div>

      {/* TOC */}
      <div style={tocBlock}>
        <div style={tocLabel}>Sections</div>
        <div style={tocGrid}>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} style={tocLink}>
              <span style={tocEyebrow}>{s.eyebrow}</span>
              <span>{s.title}</span>
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
                  <div style={sectionTitleText}>{s.title}</div>
                  <div style={sectionIntro}>{s.intro}</div>
                </div>
                <div style={chevron}>{open ? '−' : '＋'}</div>
              </button>
              {open && <div style={sectionBody}>{s.body}</div>}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={emptyText}>No sections match &quot;{q}&quot;.</div>
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
