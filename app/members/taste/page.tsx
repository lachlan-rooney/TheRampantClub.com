'use client'

import MemberPage from '@/components/MemberPage'
import { useLang } from '@/lib/lang'
import { MONO, SERIF } from '@/components/public/kit'
import PalateNow from '@/components/members/palate/PalateNow'
import PalateJourney from '@/components/members/palate/PalateJourney'
import PalateNotes from '@/components/members/palate/PalateNotes'

// YOUR PALATE — one page, three parts.
//
// Owner, 2026-10-02: "should 'your palate' and your notes not be one page?"
// then, of the third: "and your journey. WTF. 3 tabs of the same shit really."
//
// Three nav entries for one subject, and he was right about how alike they
// were: Your Palate drew a radar of the member's flavour vector, Your Journey
// drew THE SAME radar from the same vector plus the drams and notes behind it,
// and Your Notes listed those notes — which the journey page was already
// listing. A member tapping all three saw their own radar twice and their own
// notes twice.
//
// ── IT IS ONE QUESTION, ASKED THREE WAYS ──────────────────────────────────
// Where your palate stands · how it has moved · what you wrote down. That is
// one page with three sections, in that order, because each explains the one
// before it: the shape, then the drift that produced the shape, then the notes
// that produced the drift.
//
// ── NOTHING WAS REWRITTEN ─────────────────────────────────────────────────
// Each section is the original page's body, moved into
// components/members/palate/ with only its MemberPage wrapper removed. Same
// fetches, same markup, same modal. Merging three working pages by rewriting
// them is how three working pages become one broken one.
//
// /members/notes and /members/journey still exist and redirect here, anchored
// to their own section — a member with either bookmarked, or an email linking
// to one, lands where they expect.

const SECTIONS = [
  { id: 'now',     en: 'Where it stands',   vn: 'Khẩu vị hiện tại' },
  { id: 'journey', en: 'How it has moved',  vn: 'Đã thay đổi thế nào' },
  { id: 'notes',   en: 'What you wrote',    vn: 'Ghi chú của bạn' },
]

export default function MyPalatePage() {
  const { t } = useLang()
  return (
    <MemberPage
      title="Your Palate"
      subtitle="Khẩu Vị Của Bạn"
      description={t('Where your palate stands, how it has moved, and every dram you have written down. Private to you.',
                     'Khẩu vị của bạn hiện tại, đã thay đổi thế nào, và mọi ly rượu bạn đã ghi lại. Chỉ riêng bạn thấy.')}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* The three parts, named at the top. Not tabs — a long page a member
          scrolls, with the jumps there for somebody who came for one of them. */}
      <nav className="pl-jump" aria-label={t('On this page', 'Trong trang này')}>
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`} className="pl-jump-a">{t(s.en, s.vn)}</a>
        ))}
      </nav>

      {SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className="pl-sec">
          <h2 className="pl-h2">
            <span className="pl-n">{String(i + 1).padStart(2, '0')}</span>
            {t(s.en, s.vn)}
          </h2>
          {s.id === 'now' && <PalateNow />}
          {s.id === 'journey' && <PalateJourney />}
          {s.id === 'notes' && <PalateNotes />}
        </section>
      ))}
    </MemberPage>
  )
}

const CSS = `
  .pl-jump { display: flex; gap: 10px 26px; flex-wrap: wrap; margin: 0 0 8px;
             padding-bottom: 22px; border-bottom: 1px solid rgba(229,212,194,.14); }
  .pl-jump-a { font-family: ${MONO}; font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
               color: #E5D4C2; opacity: .6; text-decoration: none; padding: 4px 0;
               transition: opacity .3s ease; }
  .pl-jump-a:hover { opacity: 1; }

  .pl-sec { scroll-margin-top: 96px; padding-top: 44px; }
  .pl-sec + .pl-sec { margin-top: 18px; }
  .pl-h2 { display: flex; align-items: baseline; gap: 16px;
           font-family: ${SERIF}; font-weight: 400; font-size: clamp(24px, 3vw, 34px);
           line-height: 1.05; color: #E5D4C2; margin: 0 0 26px; }
  .pl-n { font-family: ${MONO}; font-size: 11px; letter-spacing: .2em; opacity: .45; }

  @media (pointer: coarse) { .pl-jump-a { padding: 9px 0; } }
`
