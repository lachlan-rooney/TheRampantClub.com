'use client'

import { useState, type ComponentProps } from 'react'
import { useLang } from '@/lib/lang'
import TetProgramme from './tet/TetProgramme'
import EmbassySignup from './EmbassySignup'
import { GOLD, GROUND, CREAM } from './palette'

// TWO TABS ON THE KIOSK — the programme, and the mailing list.
//
// Owner, 2026-10-27: "on the kiosk, i need a second tab for email sign up".
//
// A client-side switch rather than a second route: the tablet keeps the page
// it already has, with no reload, no second URL for staff to remember, and no
// chance of a guest landing on the sign-up form with no way back to the casks.
//
// The bar is FIXED TOP-LEFT. The language switch is fixed top-right at z 8000
// (TetProgramme), so these two cannot collide. It is deliberately always
// visible: on a tablet a guest who scrolls to the bottom of a long programme
// must be able to reach the other tab without scrolling back up.

type ProgrammeProps = ComponentProps<typeof TetProgramme>

export default function EmbassyTabs(props: ProgrammeProps) {
  const { t } = useLang()
  const [tab, setTab] = useState<'casks' | 'list'>('casks')

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="et-bar" aria-label={t('Sections', 'Phần')}>
        <button onClick={() => setTab('casks')} aria-pressed={tab === 'casks'}
                className={`et-tab ${tab === 'casks' ? 'is-on' : ''}`}>
          {t('Tết 2027', 'Tết 2027')}
        </button>
        <button onClick={() => setTab('list')} aria-pressed={tab === 'list'}
                className={`et-tab ${tab === 'list' ? 'is-on' : ''}`}>
          {t('Keep in touch', 'Giữ liên lạc')}
        </button>
      </nav>

      {/* Both stay mounted. Unmounting the programme would throw away its
          scroll position and re-run every fetch and animation each time a
          guest glanced at the sign-up form and came back. */}
      <div hidden={tab !== 'casks'}>
        <TetProgramme {...props} />
      </div>
      <div hidden={tab !== 'list'} className="et-list">
        <EmbassySignup />
      </div>
    </>
  )
}

const CSS = `
  .et-bar { position: fixed; top: 18px; left: 18px; z-index: 8000; display: flex; gap: 6px;
            padding: 5px; border-radius: 999px; background: rgba(21,29,42,.92);
            border: 1px solid rgba(210,179,127,.3); backdrop-filter: blur(8px); }
  .et-tab { min-height: 42px; padding: 10px 18px; cursor: pointer; border: none; border-radius: 999px;
            background: none; color: ${CREAM};
            font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px;
            letter-spacing: .1em; text-transform: uppercase;
            -webkit-tap-highlight-color: transparent; white-space: nowrap; }
  .et-tab.is-on { background: ${GOLD}; color: ${GROUND}; font-weight: 600; }

  /* The sign-up tab is its own page: it needs the ground, because the
     programme's PublicPage is hidden when this one is showing. */
  .et-list { background: ${GROUND}; min-height: 100vh;
             padding-top: clamp(78px,10vh,120px); }

  @media (max-width: 560px) { .et-tab { padding: 10px 13px; font-size: 11px; } }
`
