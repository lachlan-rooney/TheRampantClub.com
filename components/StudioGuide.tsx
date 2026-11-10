'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang, pick } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'
import { SENSES } from '@/lib/studio/senses'

// ═══════════════════════════════════════════════════════════════════════════
// THE SELF-GUIDED GALLERY GUIDE — a guest, their own phone, the room in order.
// ───────────────────────────────────────────────────────────────────────────
// Scanned from a booklet in The Studio. Someone is standing in front of the
// work holding this, so every decision below is made for that person and not
// for a desktop review of it:
//
// · SAGE, NOT THE CLUB'S BOTTLE GREEN. The Studio inverts the site on purpose
//   (see components/StudioExhibition) and the guide is a continuation of the
//   room, not a club page about the room. Same ground, same ink, same faces.
// · THE EXHIBITION'S OWN ACCENT. collaborations.accent is per-show — #3F5546
//   for Rizal Fathoni, #8C5A3C for Quỳnh Anh Lê — and it is what makes the
//   guide feel like THIS exhibition. Used for the rule and the piece number
//   only; never for body text, where a brown or a green on sage would be a
//   legibility problem in gallery lighting.
// · ONE PIECE PER SCREEN, UNHURRIED. No grid. A guide that shows three pieces
//   at once invites a guest to scroll past the one they are standing at.
// · "3 of 10" ON EVERY PIECE. A guest walking a room needs to know whether
//   they have missed something, and that is the one piece of information a
//   printed wall label cannot give them.
// · PHONE FIRST, 390px THE BAR. Images at one width, lazily loaded, decoded
//   async; no horizontal scroll at any width.
//
// ⚠ NOTHING HERE INVENTS CONTENT. Titles, artists, years, media, dimensions
//   and descriptions come from collaboration_pieces, which a human fills in at
//   /admin/studio. An empty guide says so, in both languages, rather than
//   dressing a placeholder as a gallery label.

const SAGE = '#B0C18E'
const INK  = '#052E20'
const SERIF = "'Rampant Sans', serif"
const MONO  = "'Google Sans Code', 'DM Mono', monospace"

export interface GuideCollab {
  id: string; slug: string; artist_name: string; artist_name_vn: string | null
  title_en: string | null; title_vn: string | null; accent: string | null
  opens_on: string | null; closes_on: string | null
  hero_path: string | null
  bio_en: string | null; bio_vn: string | null
  food_en: string | null; food_vn: string | null
  drinks_en: string | null; drinks_vn: string | null
}
// What THIS exhibition does with a sense, as opposed to the room's standing
// method. Keyed by the sense's English name, lowercased, from senses.ts.
export interface GuideSense { sense: string; body_en: string | null; body_vn: string | null }

export interface GuidePiece {
  id: string; sort: number
  title_en: string | null; title_vn: string | null
  artist_name: string | null; year: string | null
  medium_en: string | null; medium_vn: string | null
  dimensions: string | null; image_path: string | null
  description_en: string | null; description_vn: string | null
  provenance: string | null
  // Where proceeds from this piece go, if it is raising funds. Optional on the
  // type as well as in the database, so the guide renders on an installation
  // where db/collaboration_pieces_beneficiary.sql has not been run.
  beneficiary_en?: string | null; beneficiary_vn?: string | null
  beneficiary_logo_path?: string | null; beneficiary_url?: string | null
}

// One <p> per paragraph. A statement arrives with its blank lines intact (the
// admin route keeps them deliberately — see the PROSE set in its tidy()), and
// a single run of text in a <p> would throw that structure away at the last
// step after it survived every earlier one.
const paras = (text: string) => text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)

// THE CANAPÉS ARE WRITTEN AS LABELS. "Foie Gras Terrine | Mango | Brioche"
// is the same pipe-separated form as "2026 | 110 × 130 × 4 CM | ACRYLIC & OIL
// ON CANVAS", so they are set the same way: the pipe line in the display face,
// the paragraph under it in mono. A block with no pipe is just prose and is
// rendered as such, so a note or a closing line still works.
const asLabelled = (text: string) => {
  const out: { label?: string; body: string[] }[] = []
  for (const block of paras(text)) {
    const isLabel = block.includes(' | ') && block.length < 120 && !block.includes('. ')
    if (isLabel) out.push({ label: block, body: [] })
    else if (out.length && out[out.length - 1].body.length === 0 && out[out.length - 1].label) out[out.length - 1].body.push(block)
    else if (out.length && out[out.length - 1].label) out[out.length - 1].body.push(block)
    else out.push({ body: [block] })
  }
  return out
}

const dateRange = (a: string | null, b: string | null) => {
  if (!a) return null
  const f = (d: string) => new Date(d + 'T12:00:00+07:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
  return b && b !== a ? `${f(a)} — ${f(b)}` : f(a)
}

export default function StudioGuide({ collaboration: c, pieces, senses = [] }: {
  collaboration: GuideCollab; pieces: GuidePiece[]; senses?: GuideSense[]
}) {
  const { lang, t } = useLang()
  const accent = c.accent || INK
  const total = pieces.length

  // WHICH PIECE AM I LOOKING AT. The progress bar at the top needs to follow
  // the scroll, and an IntersectionObserver is the only way to know that
  // without listening to every scroll event on a phone's main thread.
  const [at, setAt] = useState(0)
  // Which sense is open. One at a time, and closed to begin with — the tabs
  // are an offer, not five paragraphs between the guest and the first work.
  const [sense, setSense] = useState<number | null>(null)
  // The strip animates in once, when it is scrolled to. Observed rather than
  // run on mount: on mount it is below the fold and the whole point is that
  // the guest sees the movement.
  const sensesRef = useRef<HTMLElement | null>(null)
  const [sensesIn, setSensesIn] = useState(false)
  useEffect(() => {
    const el = sensesRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSensesIn(true); io.disconnect() }
    }, { threshold: .35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const marks = useRef<(HTMLElement | null)[]>([])
  useEffect(() => {
    if (!total) return
    const io = new IntersectionObserver(entries => {
      // The piece covering the MIDDLE of the screen is the one being read.
      const best = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (best) setAt(Number((best.target as HTMLElement).dataset.i))
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .25, .5, 1] })
    marks.current.forEach(el => el && io.observe(el))
    return () => io.disconnect()
  }, [total])

  const exhibitionTitle = pick(lang, c.title_en, c.title_vn)
  const artist = pick(lang, c.artist_name, c.artist_name_vn)

  return (
    <main style={{ background: SAGE, color: INK, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sg { max-width: 760px; margin: 0 auto; padding: 0 20px 96px; }
        /* 20px gutters at 390px, which is the design bar. Nothing inside may
           exceed 100% — a wide label or a long dimension string is the usual
           cause of a sideways scroll on a phone. */
        .sg * { max-width: 100%; box-sizing: border-box; }
        /* ⚠ THE BLEED HAS TO OPT OUT OF THE GUARD ABOVE. That rule is what
           keeps a long dimension string from pushing the page sideways, but it
           also capped the full-bleed figure at the 350px content box, so the
           artwork stopped 20px short of the right edge and the bleed looked
           like a mistake instead of a decision. */
        .sg-fig, .sg-fig img, .sg-hero, .sg-hero img { max-width: none; }

        .sg-bar { position: sticky; top: 0; z-index: 5; background: ${SAGE};
                  padding: 12px 0 10px; border-bottom: 1px solid ${INK}22; }
        /* ⚠ THE BURGER SITS ON TOP OF THIS BAR. NavOverlay's trigger is
           position:fixed at 18,18 and 40px square, so it covers x18–58 of
           whatever is underneath — and the EN half of this toggle was at
           x21–54. The control rendered perfectly and could not be tapped,
           which is the same shape of fault as the admin menu that drew under
           its own scrim. elementFromPoint is the thirty-second proof, and the
           verifier now runs it on both halves. Space reserved, not z-index
           raised: winning a stacking fight with the site nav would just make
           the menu untappable instead. */
        /* ⚠ THE BURGER SITS ON TOP OF THIS BAR. NavOverlay's trigger is fixed
           at 18,18 and 40px square, so it covers x18–58 of whatever is under
           it. The space is reserved on the LEFT only — the row's contents then
           run from there to the right edge, instead of the whole row being
           pushed in and the track stopping short of the screen. */
        .sg-bar-in { display: flex; align-items: center; gap: 10px; padding-left: 46px; }
        @media (min-width: 900px) { .sg-bar-in { padding-left: 54px; } }
        .sg-count { font-family: ${MONO}; font-size: 11px; letter-spacing: .08em;
                    white-space: nowrap; color: ${INK}; opacity: .72;
                    font-variant-numeric: tabular-nums; }
        /* min-width 0 so the track can actually shrink and grow inside the
           flex row rather than being held open by its own content box. */
        .sg-track { flex: 1 1 auto; min-width: 0; height: 2px; background: ${INK}1f;
                    border-radius: 2px; overflow: hidden; }
        .sg-fill { height: 100%; background: ${accent}; transition: width .35s ease; }

        /* THE PORTRAIT, FULL BLEED, FIRST. Breaks the 20px gutter the same
           way the artwork does, so the page opens on Rizal rather than on
           type. */
        .sg-hero { margin: 0 -20px; }
        .sg-hero img { display: block; width: 100%; height: auto; }
        @media (min-width: 800px) { .sg-hero { margin: 0; } }

        /* CENTRED, because the lockup is a mark and a mark with a signature in
           it hangs badly off a left edge. The prose beneath it used to step
           back to the left; it runs down the same centre line now. */
        .sg-head { padding: 30px 0 10px; text-align: center; }
        .sg-title { display: block; margin: 0; }
        .sg-lockup { display: block; width: min(300px, 80%); height: auto; margin: 0 auto; }
        /* Set at the Studio page's own title scale. It was 19–25px under the
           lockup and read as a caption; this is the artist's name. */
        .sg-artist { font-family: ${SERIF}; font-weight: 400; line-height: .98;
                     font-size: clamp(30px, 8vw, 58px); margin: 18px 0 0; }
        .sg-dates { font-family: ${MONO}; font-size: 11.5px; margin: 12px 0 0; opacity: .66; }
        .sg-intro { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 22px 0 0;
                    max-width: 56ch; }
        /* ── THE BIOGRAPHY IS FOLDED AWAY ────────────────────────────────
           collaborations.bio_en is nearly 3,000 characters. Rendered open it
           filled seven phone screens before piece one — and this is read by
           somebody standing in front of piece one. It is the artist's own
           text, so none of it is cut; it is one tap away instead, and the
           work comes first. */
        .sg-bio { margin: 20px 0 0; }
        .sg-bio summary { font-family: ${MONO}; font-size: 11px; letter-spacing: .14em;
                          text-transform: uppercase; cursor: pointer; padding: 10px 0;
                          border-top: 1px solid ${INK}26; border-bottom: 1px solid ${INK}26;
                          list-style: none; opacity: .75; }
        .sg-bio summary::-webkit-details-marker { display: none; }
        .sg-bio summary::after { content: ' +'; }
        .sg-bio[open] summary::after { content: ' −'; }
        .sg-bio p { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 20px 0 0;
                    max-width: 56ch; }
        /* ── WHAT CENTRES AND WHAT DOES NOT ──────────────────────────────
           THE BODY PROSE CENTRES. The labels do not: a title, its facts
           line, the piece number and the section headings all read off a
           left edge, which is how a gallery sets a label and how /studio
           sets its type. Centre those too and the page reads as a
           certificate rather than a wall.

           ⚠ EVERY CENTRED BLOCK NEEDS BOTH HALVES. text-align centres the
           LINES inside a box; a 60ch box inside the 760px column still
           sits hard left without auto side margins, so on a desktop the
           centring would look like it had half worked. One without the other
           is the bug to watch for here.

           The rule itself is at the FOOT of this stylesheet, not here. */
        .sg-rule { height: 1px; background: ${INK}26; margin: 34px 0 0; border: 0; }

        /* ── A PIECE ───────────────────────────────────────────────────────
           The image is the hero and it is never cropped: a painting decides
           its own aspect ratio, so the frame takes whatever shape the work is.
           That is the Studio's rule on /studio/[slug] and it holds here. */
        .sg-piece { padding: 52px 0 0; scroll-margin-top: 76px; }
        .sg-no { font-family: ${MONO}; font-size: 11px; letter-spacing: .16em;
                 color: ${accent}; font-weight: 700; }
        /* FULL BLEED. In the booklet the work runs edge to edge off the page
           and the text sits under it. The reading column is 760px and the
           image breaks out of it — the 20px gutter is cancelled on both sides
           rather than the column widened, so the type keeps its measure. */
        .sg-fig { margin: 16px -20px 0; }
        .sg-fig img { display: block; width: 100%; height: auto; background: ${INK}0f; }
        @media (min-width: 800px) { .sg-fig { margin-left: 0; margin-right: 0; } }
        .sg-nofig { margin: 16px 0 0; border: 1px dashed ${INK}3d; aspect-ratio: 4 / 3;
                    display: grid; place-items: center; font-family: ${MONO};
                    font-size: 11px; opacity: .55; text-align: center; padding: 20px; }
        /* THE GALLERY LABEL, set as a gallery sets one: the title in the
           display face, everything factual beneath it in mono, each fact on
           its own line. A run-on label is unreadable at arm's length. */
        /* ── THE LABEL, SET THE WAY THE BOOKLET SETS IT ──────────────────
           Title on its own line, then the facts pipe-separated on the next:
              A SERIES OF BODY
              2026 | 15.5 × 53 CM | ACRYLIC & OIL ON COTTON PAPER
           Both uppercase, both in the display face, both the same weight —
           the booklet gives the facts the same voice as the title rather than
           demoting them to small print, and that is what makes it read as a
           gallery and not a catalogue. */
        .sg-label { margin: 20px 0 0; }
        .sg-pt { font-family: ${SERIF}; font-weight: 400; font-size: clamp(26px, 7vw, 38px);
                 line-height: 1.06; margin: 0; text-transform: uppercase; }
        .sg-pf { font-family: ${SERIF}; font-weight: 400; font-size: clamp(17px, 4.6vw, 24px);
                 line-height: 1.22; margin: 6px 0 0; text-transform: uppercase; opacity: .9; }
        /* Only where a piece is not by the exhibition's own artist. On the
           booklet's pages it never appears, because it never needs to. */
        .sg-pa { font-family: ${MONO}; font-size: 12px; margin: 8px 0 0; opacity: .78; }
        /* MONO 14 / LINE-HEIGHT 2, the measurements StudioExhibition uses for
           an artist's statement. The guide is a continuation of that page and
           must read like it, not approximately like it. Real paragraphs with
           a 20px gap rather than white-space: pre-line — pre-line gives a
           blank LINE between paragraphs, which at line-height 2 is a 28px
           hole, and it cannot be tuned separately from the leading. */
        .sg-desc { margin: 18px 0 0; max-width: 60ch; }
        .sg-desc p { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 0 0 20px; }
        /* ⚠ THE JUSTIFICATION IS GONE AND MUST NOT COME BACK. It used to set
           the statements justified above 700px, the way the printed page
           does. text-align holds ONE value, so that rule now silently
           cancels the centring on exactly the blocks carrying the artist's
           statements — the longest text on the page. */
        .sg-desc p:last-child { margin-bottom: 0; }
        .sg-prov { font-family: ${MONO}; font-size: 11px; line-height: 1.7; margin: 14px 0 0;
                   padding-top: 12px; border-top: 1px solid ${INK}1f; opacity: .6; max-width: 60ch; }

        .sg-menu-item { margin: 22px 0 0; }

        /* ── THE FIVE SENSES ───────────────────────────────────────────────
           A strip of marks, not a second block of prose. Closed by default:
           the guest came to look at paintings, and five open paragraphs
           between the intro and piece one would be the biography mistake
           again. Horizontally scrollable at phone width rather than wrapped
           to two rows, so the five read as one set. */
        .sg-senses { margin: 26px 0 0; }
        .sg-senses-h { font-family: ${SERIF}; font-weight: 400; line-height: 1.04;
                       font-size: clamp(24px, 6.4vw, 38px); margin: 0 0 16px; }
        /* ⚠ FIVE THAT ALWAYS FIT, NOT FIVE THAT SCROLL. They were
           flex: 1 0 auto with a 66px floor, which at 390px overflowed the
           350px content box — so the strip scrolled sideways and the outer
           tabs were cut off at the screen edge on load, which reads as a
           broken layout rather than as something to swipe. 1 1 0 with a zero
           basis makes them share whatever width there is. */
        .sg-tabs { display: flex; gap: 5px; }
        .sg-tab { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column;
                  align-items: center; gap: 5px; padding: 11px 4px 9px; cursor: pointer;
                  background: transparent; border: 1px solid ${INK}22; border-radius: 8px;
                  color: ${INK}; transition: background .2s ease, border-color .2s ease;
                  /* ── A NUDGE, ONCE, WHEN THEY COME INTO VIEW ──────────────
                     Five quiet outlined boxes do not read as controls. They
                     lift in turn as the strip arrives, which says "these do
                     something" without a line of copy telling the guest so. */
                  opacity: 0; transform: translateY(8px); }
        .sg-senses.is-in .sg-tab { animation: sg-tab-in .5s cubic-bezier(.16,.84,.44,1) forwards; }
        .sg-senses.is-in .sg-tab:nth-child(1) { animation-delay: .00s }
        .sg-senses.is-in .sg-tab:nth-child(2) { animation-delay: .07s }
        .sg-senses.is-in .sg-tab:nth-child(3) { animation-delay: .14s }
        .sg-senses.is-in .sg-tab:nth-child(4) { animation-delay: .21s }
        .sg-senses.is-in .sg-tab:nth-child(5) { animation-delay: .28s }
        @keyframes sg-tab-in { to { opacity: 1; transform: none } }
        /* ⚠ REDUCED MOTION MUST STILL SHOW THEM. An animation that only fades
           in is invisible to anyone who has turned animation off, and these
           start at opacity 0 — the tabs would simply never appear. */
        @media (prefers-reduced-motion: reduce) {
          .sg-tab, .sg-senses.is-in .sg-tab { opacity: 1; transform: none; animation: none; }
        }
        .sg-tab.is-on { background: ${INK}0f; border-color: ${accent}; }
        .sg-tab-mark path { stroke: ${INK}; fill: none; stroke-width: 1.5;
                            stroke-linecap: round; stroke-linejoin: round; }
        .sg-tab.is-on .sg-tab-mark path { stroke: ${accent}; }
        .sg-tab-art { width: 34px; height: 34px; object-fit: contain; }
        .sg-tab-name { font-family: ${MONO}; font-size: 9px; letter-spacing: .04em;
                       text-transform: uppercase; white-space: nowrap; }
        .sg-sense-panel { margin: 14px 0 0; padding: 16px 0 0; border-top: 1px solid ${INK}26; }
        .sg-sense-h { font-family: ${SERIF}; font-weight: 400; font-size: 26px;
                      text-transform: uppercase; line-height: 1.06; }
        .sg-sense-line { font-family: ${MONO}; font-size: 14px; line-height: 2; margin: 6px 0 0;
                         max-width: 56ch; }
        .sg-sense-block { margin: 22px 0 0; }
        .sg-sense-sub { font-family: ${MONO}; font-size: 10px; letter-spacing: .2em;
                        text-transform: uppercase; opacity: .6; }
        .sg-benefit { margin: 20px 0 0; padding: 16px 0 0; border-top: 2px solid ${accent}; }
        /* ⚠ SIZED FOR A SEAL, NOT A WORDMARK. The first rule here capped the
           height at 58px, which is right for a line of type like Duncan
           Taylor's and wrong for a circular seal — the Borneo mark is square
           and carries two rings of text, and at 58px neither ring is readable.
           Height leads; the width cap only stops a very wide mark running on. */
        .sg-benefit-logo { display: block; width: auto; height: auto;
                           max-height: 104px; max-width: 190px; margin: 0 auto 14px; }
        .sg-benefit-text { font-family: ${MONO}; font-size: 12.5px; line-height: 1.85; margin: 0;
                           max-width: 54ch; }
        .sg-empty { padding: 60px 0; font-family: ${MONO}; font-size: 13px; line-height: 1.9;
                    max-width: 52ch; opacity: .78; }
        .sg-lion { display: block; width: 86px; height: auto; margin: 40px auto 0; }
        .sg-lockup { display: block; width: min(300px, 76%); height: auto; }
        /* The lockup replaces type inside the h1, so the h1's own type metrics
           must not add space around an image. */
        .sg-title { display: block; }

        .sg-marks { display: flex; flex-direction: column; align-items: center;
                    gap: 26px; margin: 22px 0 0; }
        .sg-mark { display: block; height: auto; width: auto; }
        /* Sized by OPTICAL weight, not to a common width. Duncan Taylor is a
           6.4:1 line of type and LR Growth is a 1.5:1 block; matching their
           widths would make one shout and the other vanish. */
        .sg-mark-dt { max-width: 196px; }
        .sg-mark-lr { max-width: 112px; }
        /* The pixel logotype is a delicate, open letterform — at the width
           that balances Duncan Taylor's serif it reads as a faint texture
           rather than a name, so it gets the extra width its drawing needs. */
        .sg-mark-ll { max-width: 170px; }
        .sg-wordmark { display: block; width: min(280px, 74%); height: auto; margin: 38px auto 0; }
        .sg-foot { margin: 80px 0 0; padding-top: 28px; border-top: 1px solid ${INK}26;
                   font-family: ${MONO}; font-size: 11.5px; line-height: 1.9; text-align: center; }
        .sg-more { color: ${INK}; display: inline-block; margin-top: 26px; }
        .sg-credit-label { font-family: ${MONO}; font-size: 10px; letter-spacing: .22em;
                           text-transform: uppercase; opacity: .6; }

        @media (prefers-reduced-motion: reduce) { .sg-fill { transition: none; } }

        /* ══ THE BODY PROSE, DOWN THE MIDDLE ═══════════════════════════════
           Every block of reading on the page, and nothing that is a label.
           ONE rule rather than a line added to each block, so a new piece of
           prose is centred by being named here and cannot be half-done.

           ⚠ IT IS DECLARED LAST ON PURPOSE. Each of these blocks sets its
           own margin SHORTHAND above (margin: 18px 0 0 and so on), and a
           shorthand resets the side margins to 0 — so the same rule written
           further up this sheet would centre the lines and leave the box
           itself hard left in the 760px column. Equal specificity, later
           wins. Do not move it up. */
        .sg-intro,
        .sg-bio p,
        .sg-desc,
        .sg-prov,
        .sg-sense-line,
        .sg-benefit-text,
        .sg-empty { text-align: center; margin-left: auto; margin-right: auto; }
      ` }} />

      <div className="sg">
        {/* The switch first, because a Vietnamese guest should not have to read
            an English page to find out the page has Vietnamese. */}
        <div className="sg-bar">
          {/* COUNT, THEN THE TRACK, THEN THE SWITCH AT THE RIGHT EDGE. The
              toggle used to sit first, which pushed the bar's whole contents
              in behind the fixed burger and left the track stopping short of
              the screen. The 48px reserved for the burger is now dead space on
              the left rather than a gap in the middle of the row. */}
          <div className="sg-bar-in">
            {total > 0 && (
              <>
                <div className="sg-count">
                  {String(Math.min(at + 1, total)).padStart(2, '0')}/{String(total).padStart(2, '0')}
                </div>
                <div className="sg-track" aria-hidden="true">
                  <div className="sg-fill" style={{ width: `${((at + 1) / total) * 100}%` }} />
                </div>
              </>
            )}
            <LangToggle compact tone="light" />
          </div>
        </div>

        {/* The portrait runs full bleed at the very top — the exhibition's own
            hero, the way the Studio page opens on the work rather than on
            words. */}
        {c.hero_path && (
          <div className="sg-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.hero_path} alt="" aria-hidden="true" />
          </div>
        )}

        <header className="sg-head">
          {/* NO EYEBROW. "Gallery guide · The Studio" sat above the lockup and
              told a guest standing in The Studio where they were. */}
          {exhibitionTitle && (
            <h1 className="sg-title">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/studio/brand/octave-x-toni.webp" alt={exhibitionTitle} className="sg-lockup" />
            </h1>
          )}
          <div className="sg-artist">{artist}</div>
          {dateRange(c.opens_on, c.closes_on) && (
            <div className="sg-dates">{dateRange(c.opens_on, c.closes_on)}</div>
          )}
          {pick(lang, c.bio_en, c.bio_vn) && (
            <details className="sg-bio">
              <summary>{t('About the artist', 'Về nghệ sĩ')}</summary>
              {paras(pick(lang, c.bio_en, c.bio_vn)).map((para, i) => <p key={i}>{para}</p>)}
            </details>
          )}
          <p className="sg-intro" style={{ opacity: .62 }}>
            {total > 0
              ? t(`${total} pieces, in the order you will walk past them. Take your time.`,
                   `${total} tác phẩm, theo thứ tự bạn sẽ đi qua. Hãy thong thả.`)
              : ''}
          </p>
          <hr className="sg-rule" />
        </header>

        {/* ══ THE FIVE SENSES ══════════════════════════════════════════════
            The room is built to answer the work — the light it is seen in,
            what reaches your hand and your glass, what you hear, and the air.
            /studio already says that, and the marks and the wording already
            live in lib/studio/senses, so this reuses them rather than drawing
            a second set that would drift from the first.

            The exhibition's own food and drink hang off TASTE, because that is
            where a guest looks for them. Everything else carries the room's
            method, which is the honest content: it is how The Studio works
            every time, not something composed for this show.

            ⚠ SCENT HAS NO PER-EXHIBITION COPY AND NO COLUMN TO PUT IT IN. The
            aroma is composed with the artist for each show, so the general
            line is all there is to say here. It is not guessed at — the same
            rule that kept this line blank in senses.ts until Lachlan wrote it. */}
        <section ref={sensesRef} className={`sg-senses ${sensesIn ? 'is-in' : ''}`}
                 aria-label={t('The five senses', 'Năm giác quan')}>
          <h2 className="sg-senses-h">
            {t('Explore this exhibit through your five senses',
               'Khám phá triển lãm qua năm giác quan')}
          </h2>
          <div className="sg-tabs" role="tablist">
            {SENSES.map((sn, i) => {
              const on = sense === i
              return (
                <button key={sn.en} role="tab" aria-selected={on} aria-controls={`sense-${i}`}
                        className={`sg-tab ${on ? 'is-on' : ''}`}
                        onClick={() => setSense(on ? null : i)}>
                  {sn.art
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={sn.art} alt="" aria-hidden="true" className="sg-tab-art" />
                    : (
                      <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true" className="sg-tab-mark">
                        <path d={sn.path} />
                      </svg>
                    )}
                  <span className="sg-tab-name">{lang === 'vn' ? sn.vn : sn.en}</span>
                </button>
              )
            })}
          </div>

          {sense !== null && (
            <div className="sg-sense-panel" id={`sense-${sense}`} role="tabpanel">
              <div className="sg-sense-h">{lang === 'vn' ? SENSES[sense].vn : SENSES[sense].en}</div>
              {/* THE ROOM'S METHOD — true of every exhibition, from senses.ts. */}
              {SENSES[sense].line && <p className="sg-sense-line">{SENSES[sense].line}</p>}

              {/* AND WHAT THIS ONE DOES. Separated by a label rather than run
                  on, because the two say different kinds of thing: one is how
                  The Studio always works, the other is a decision made with
                  this artist. Absent until somebody writes it — the aroma is
                  composed per show and must never be guessed at. */}
              {(() => {
                const own = senses.find(x => x.sense === SENSES[sense].en.toLowerCase())
                const body = pick(lang, own?.body_en ?? null, own?.body_vn ?? null)
                if (!body) return null
                return (
                  <div className="sg-sense-block">
                    <div className="sg-sense-sub">{t('In this exhibition', 'Trong triển lãm này')}</div>
                    <div className="sg-desc">{paras(body).map((b, j) => <p key={j}>{b}</p>)}</div>
                  </div>
                )
              })()}

              {/* Taste carries this exhibition's own menu. */}
              {SENSES[sense].en === 'Taste' && (
                <>
                  {pick(lang, c.food_en, c.food_vn) && (
                    <div className="sg-sense-block">
                      <div className="sg-sense-sub">{t('The canapés', 'Món khai vị')}</div>
                      {asLabelled(pick(lang, c.food_en, c.food_vn)).map((item, i) => (
                        <div key={i} className="sg-menu-item">
                          {item.label && <div className="sg-pf">{item.label}</div>}
                          <div className="sg-desc">{item.body.map((b, j) => <p key={j}>{b}</p>)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {pick(lang, c.drinks_en, c.drinks_vn) && (
                    <div className="sg-sense-block">
                      <div className="sg-sense-sub">{t('The cocktails', 'Cocktail')}</div>
                      <div className="sg-desc">
                        {paras(pick(lang, c.drinks_en, c.drinks_vn)).map((b, j) => <p key={j}>{b}</p>)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {total === 0 ? (
          // HONEST, AND IN BOTH LANGUAGES. The alternative — placeholder labels
          // under a real artist's name on a public URL — would be a lie told in
          // a gallery's voice.
          <div className="sg-empty">
            {t('The guide for this exhibition is being written. The pieces will appear here as they are catalogued.',
               'Phần hướng dẫn cho triển lãm này đang được soạn. Các tác phẩm sẽ xuất hiện ở đây khi được ghi chú xong.')}
          </div>
        ) : pieces.map((p, i) => {
          const title = pick(lang, p.title_en, p.title_vn)
          const medium = pick(lang, p.medium_en, p.medium_vn)
          const desc = pick(lang, p.description_en, p.description_vn)
          // The piece's own artist where a group show gives it one; the
          // exhibition's artist otherwise. A label never says nothing.
          const by = p.artist_name || artist
          return (
            <section key={p.id} id={`piece-${i + 1}`} data-i={i} className="sg-piece"
                     ref={el => { marks.current[i] = el }}
                     aria-label={`${i + 1} of ${total}${title ? ` — ${title}` : ''}`}>
              <div className="sg-no">{String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>

              {p.image_path ? (
                <figure className="sg-fig">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_path} alt={title || t('Artwork', 'Tác phẩm')}
                       loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                       sizes="(max-width: 760px) 100vw, 720px" />
                </figure>
              ) : (
                <div className="sg-nofig">{t('Image to come', 'Hình ảnh sẽ được bổ sung')}</div>
              )}

              <div className="sg-label">
                {title && <h2 className="sg-pt">{title}</h2>}
                {/* Pipe-separated, and only the parts that exist — an empty
                    medium must not leave " | | " hanging on the label. */}
                {[p.year, p.dimensions, medium].some(Boolean) && (
                  <div className="sg-pf">
                    {[p.year, p.dimensions, medium].filter(Boolean).join(' | ')}
                  </div>
                )}
                {/* Named only when it is NOT the exhibition's own artist. */}
                {p.artist_name && p.artist_name !== artist && (
                  <div className="sg-pa">{p.artist_name}</div>
                )}
              </div>

              {desc && (
                <div className="sg-desc">
                  {paras(desc).map((para, j) => <p key={j}>{para}</p>)}
                </div>
              )}
              {p.provenance && <p className="sg-prov">{p.provenance}</p>}

              {/* WHERE THE MONEY GOES. Set apart from the statement with a
                  rule and the exhibition's accent, because it is the club
                  speaking rather than the artist — running it on as another
                  paragraph would read as part of his text. The logo sits
                  beside it when there is one; a charity credit in plain type
                  looks like a disclaimer. */}
              {pick(lang, p.beneficiary_en ?? null, p.beneficiary_vn ?? null) && (
                <div className="sg-benefit">
                  {p.beneficiary_logo_path && (
                    p.beneficiary_url
                      ? <a href={p.beneficiary_url} target="_blank" rel="noreferrer noopener">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.beneficiary_logo_path} alt="" loading="lazy" className="sg-benefit-logo" />
                        </a>
                      /* eslint-disable-next-line @next/next/no-img-element */
                      : <img src={p.beneficiary_logo_path} alt="" loading="lazy" className="sg-benefit-logo" />
                  )}
                  <p className="sg-benefit-text">
                    {pick(lang, p.beneficiary_en ?? null, p.beneficiary_vn ?? null)}
                  </p>
                </div>
              )}
            </section>
          )
        })}

        {/* ══ THE CREDITS ══════════════════════════════════════════════════
            The booklet's back matter, as names rather than marks. Of the five
            marks it carries only Duncan Taylor's crest is in this repo, and it
            is gold on transparent — drawn for a dark ground, and on sage it
            all but disappears (tried, measured, removed). Two logos reproduced
            and three set as type would also read as an oversight about the
            three. So all of them are type, in the display face, which on this
            ground is the legible answer and the consistent one. Drop sage- or
            ink-ready marks into public/images/brand and they can have the
            treatment instead.

            The booklet's acknowledgement page is deliberately NOT here. It
            thanks people for "every element of the evening", and this guide
            is read for three months after that evening. */}
        <footer className="sg-foot">
          <div className="sg-credit-label">{t('Powered by', 'Được hỗ trợ bởi')}</div>
          {/* STACKED DOWN THE CENTRE, one per line. Side by side they had to be
              sized against each other and the row still broke differently at
              every width; in a column each mark is sized only against itself. */}
          <div className="sg-marks">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/studio/brand/lactone-labs.webp" alt="Lactone Labs"
                 loading="lazy" className="sg-mark sg-mark-ll" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/studio/brand/lr-growth.webp" alt="LR Growth Solutions"
                 loading="lazy" className="sg-mark sg-mark-lr" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/studio/brand/duncan-taylor.webp" alt="Duncan Taylor Scotch Whisky"
                 loading="lazy" className="sg-mark sg-mark-dt" />
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/studio/brand/studio-wordmark.webp" alt="The Studio @ The Rampant Club"
               loading="lazy" className="sg-wordmark" />

          <Link href={`/studio/${c.slug}`} className="sg-more">
            {t('More about this exhibition', 'Tìm hiểu thêm về triển lãm này')} →
          </Link>

          {/* The lion closes the page, centred and last — the mark the room
              signs off with, not a decoration at the top competing with the
              exhibition's own lockup. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/studio/brand/studio-lion.webp" alt="" aria-hidden="true" className="sg-lion" />
        </footer>
      </div>
    </main>
  )
}
