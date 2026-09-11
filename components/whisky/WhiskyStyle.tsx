'use client'

import { CREAM, GOLD, MONO, SERIF } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE WHISKY PAGES' VOCABULARY — the library, a bottle, the finder, the palate,
// the notes and the journey, set in the public kit's language on the portal's
// green: hairlines, never boxes; names in the display face; mono reading text
// in cream at a size you can read; underlined mono links whose arrow slides.
//
// It sits under MemberPage, which already carries the kit's CSS and the cream
// ink filter. The rules here are global on purpose: a letter of the shelf opens
// in a portal (MemberModal), and the rows inside it must read the same.

const LINE = 'rgba(229,212,194,.16)'

const CSS = `
  /* ── Reading ─────────────────────────────────────────────────────────── */
  .wl-text  { font-family: ${MONO}; font-size: 13.5px; line-height: 1.95; color: ${CREAM}; opacity: .88; max-width: 620px; margin: 0; }
  .wl-meta  { font-family: ${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: ${CREAM}; opacity: .78; }
  .wl-inline { color: ${GOLD}; text-decoration: none; border-bottom: 1px solid rgba(212,184,90,.45); transition: border-color .2s ease; }
  .wl-inline:hover { border-bottom-color: ${GOLD}; }
  .wl-h { font-family: ${SERIF}; font-weight: 400; color: ${CREAM}; margin: 0; line-height: 1.02; }
  .wl-h.is-2 { font-size: clamp(34px, 4.6vw, 62px); line-height: .98; }
  .wl-h.is-3 { font-size: clamp(24px, 2.6vw, 34px); }

  /* ── Links and buttons: mono, uppercase, underlined; the arrow slides ── */
  .wl-link { display: inline-block; color: ${CREAM}; text-decoration: none; background: none; cursor: pointer;
             border: none; border-bottom: 1px solid currentColor; border-radius: 0; padding: 0 0 5px;
             font-family: ${MONO}; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; line-height: 1.5; }
  .wl-link.is-gold { color: ${GOLD}; }
  .wl-link.is-big { font-size: 13px; padding-bottom: 7px; }
  .wl-link.is-quiet { opacity: .8; }
  .wl-link.is-quiet:hover { opacity: 1; }
  .wl-link.is-danger { color: #E89B9B; }
  .wl-link:disabled { cursor: not-allowed; }
  .wl-link .pk-go { margin-left: 2px; }
  .wl-link:hover:not(:disabled) .pk-go { transform: translateX(7px); }

  /* ── Radars given room ───────────────────────────────────────────────
     The shared radar draws its labels at 8 units in a fixed gutter, and caps
     its own width at the size it was drawn for. Here it may grow to its
     column, and the labels come up a size so the family names can be read.
     Draw these radars at size={RADAR} (360): the gutter between the three
     bottom labels grows with the radius, and at the default 300 the larger
     labels touch. The colour hooks (--rc-*) are the radar's own, defaulting
     to the old values everywhere else. */
  .wl-radar { width: 100%; margin: 0 auto;
              --rc-grid: rgba(229,212,194,.15); --rc-axis: rgba(229,212,194,.11);
              --rc-label-dim: rgba(229,212,194,.5); --rc-label-low: rgba(229,212,194,.74);
              --rc-label-unset: rgba(229,212,194,.8); }
  .wl-radar svg { width: 100%; max-width: 100% !important; }
  .wl-radar svg text { font-size: 9.5px; }
  .wl-legend { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px;
               font-family: ${MONO}; font-size: 11.5px; color: ${CREAM}; }
  .wl-legend .wl-sw { width: 16px; height: 2px; display: inline-block; }
  .wl-legend .wl-sw + span { opacity: .86; margin-right: 12px; }

  /* ── A run of pours on hairlines (finder results, recommendations) ─── */
  .wl-pours { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr)); gap: 0 56px; }
  .wl-pour { border-top: 1px solid ${LINE}; padding: 24px 0 34px; min-width: 0; }
  .wl-pour-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px 14px; flex-wrap: wrap; }
  .wl-pour-name { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 2.2vw, 28px); line-height: 1.06; margin: 0; color: ${CREAM}; overflow-wrap: anywhere; }
  .wl-strength { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
  .wl-pour-note { font-family: ${MONO}; font-size: 11.5px; color: ${CREAM}; opacity: .75; margin-top: 8px; }
  .wl-pour .wl-radar { margin-top: 10px; }
  .wl-pour .wl-link { margin-top: 18px; }
  .wl-banner { font-family: ${MONO}; font-size: 13px; line-height: 1.85; color: #D9A866; max-width: 620px; margin: 0 0 22px; }

  /* ── A bottle in a list — the library's row ──────────────────────────
     The row is a container, so the same row can sit in a letter's sheet
     (one column) and across the page (words left, radar right). */
  .wl-list { container-type: inline-size; }
  .wl-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px 56px; align-items: start;
            padding: 28px 0 30px; border-top: 1px solid ${LINE}; color: ${CREAM}; }
  .wl-list > .wl-row:last-child { border-bottom: 1px solid ${LINE}; }
  .wl-row.is-out { opacity: .55; }
  .wl-row-name { font-family: ${SERIF}; font-weight: 400; font-size: clamp(23px, 2.5vw, 32px); line-height: 1.04; margin: 0; overflow-wrap: anywhere; }
  .wl-pick { color: ${GOLD}; font-size: .46em; vertical-align: .42em; margin-right: 12px; }
  .wl-row-origin { margin-top: 12px; }
  .wl-row-spec { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; color: ${CREAM}; opacity: .72; margin-top: 5px; }
  .wl-row-note { font-family: ${MONO}; font-size: 13px; line-height: 1.95; color: ${CREAM}; opacity: .9; max-width: 660px; margin: 16px 0 0; }
  .wl-row-note.is-empty { opacity: .66; }
  .wl-acts { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px 30px; margin-top: 20px; }
  .wl-row-radar { min-width: 0; }
  @container (min-width: 720px) {
    .wl-row.is-open { grid-template-columns: minmax(0, 1fr) minmax(0, 440px); }
  }

  /* ── The members' notes on a bottle ──────────────────────────────── */
  .wl-notes { margin-top: 22px; }
  .wl-notes-list { margin-top: 18px; max-width: 700px; }
  .wl-n { padding: 16px 0 18px; border-top: 1px solid ${LINE}; }
  .wl-n-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .wl-n-who { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: ${CREAM}; }
  .wl-n-who.is-own { color: ${GOLD}; }
  .wl-tag { font-family: ${MONO}; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; margin-left: 12px; }
  .wl-tag.is-shared { color: #9CC79C; }
  .wl-tag.is-private { color: ${CREAM}; opacity: .7; }
  .wl-date { font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: ${CREAM}; opacity: .7; white-space: nowrap; }
  .wl-n-text { font-family: ${MONO}; font-size: 13px; line-height: 1.9; color: ${CREAM}; opacity: .9; white-space: pre-wrap; margin-top: 8px; }
  .wl-photo { display: block; max-width: min(100%, 380px); max-height: 300px; object-fit: cover; margin-top: 14px;
              border-radius: 10px; box-shadow: 0 14px 34px rgba(0,0,0,.32); }
  .wl-fams { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; line-height: 2;
             color: ${GOLD}; margin-top: 10px; }
  .wl-notes-empty { font-family: ${MONO}; font-size: 12.5px; line-height: 1.9; color: ${CREAM}; opacity: .78; padding: 4px 0 14px; }

  /* ── The composer (inside MemberModal) ───────────────────────────── */
  .wl-form { color: ${CREAM}; }
  .wl-field { margin-top: 22px; }
  .wl-field-label { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; opacity: .72; margin-bottom: 10px; }
  .wl-field-label span { opacity: .8; letter-spacing: .06em; text-transform: none; }
  .wl-textarea { display: block; width: 100%; box-sizing: border-box; resize: vertical; outline: none;
                 background: rgba(229,212,194,.04); color: ${CREAM}; border: 1px solid rgba(229,212,194,.24); border-radius: 2px;
                 font-family: ${MONO}; font-size: 14px; line-height: 1.8; padding: 12px 14px; transition: border-color .2s ease; }
  .wl-textarea::placeholder { color: rgba(229,212,194,.5); }
  .wl-textarea:focus { border-color: ${GOLD}; }
  .wl-choices { display: flex; flex-wrap: wrap; gap: 6px 22px; }
  .wl-choice { background: none; border: none; border-bottom: 1px solid transparent; border-radius: 0; cursor: pointer;
               padding: 5px 0 5px; font-family: ${MONO}; font-size: 12px; letter-spacing: .03em; color: ${CREAM}; opacity: .68;
               transition: opacity .2s ease, color .2s ease, border-color .2s ease; }
  .wl-choice:hover { opacity: 1; }
  .wl-choice.is-on { color: ${GOLD}; border-bottom-color: ${GOLD}; opacity: 1; }
  .wl-file { font-family: ${MONO}; font-size: 12px; color: ${CREAM}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
  .wl-form-actions { display: flex; justify-content: flex-end; align-items: baseline; gap: 30px; margin-top: 30px; flex-wrap: wrap; }
  .wl-error { font-family: ${MONO}; font-size: 12px; line-height: 1.7; color: #E89B9B; margin-bottom: 12px; }

  @media (max-width: 600px) {
    .wl-pours { grid-template-columns: minmax(0, 1fr); }
    .wl-textarea { font-size: 16px; }   /* stops iOS zooming into the field */
  }
`

/** Render once per page (the rules are global, so portalled sheets share them). */
export function WhiskyStyle() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />
}

/** The house arrow slides, so a translated string's own trailing "→" (and a
 *  leading ornament) is lifted off for display — the words are untouched. */
export const bare = (s: string) => s.replace(/^[◆↗]\s*/, '').replace(/\s*→\s*$/, '')

/** The drawing size for every radar on these pages (see .wl-radar above). */
export const RADAR = 360

/** The strength of a match, in the colour it has always had. */
export function strengthColor(s: string): string {
  if (s === 'strong') return '#9CC79C'
  if (s === 'good') return '#D4B85A'
  if (s === 'loose') return '#D9A866'
  return 'rgba(229,212,194,.8)'
}
