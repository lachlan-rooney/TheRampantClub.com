# The House Style

The design system behind The Rampant Club's public site, member portal, kiosk
and admin — written down so it can be applied deliberately rather than copied by
eye, and so a second brand (Lactone Labs, DRAMFINDER) can take the *method*
without taking the *identity*.

Written 2026-09-13, against the system as it stands after the September rebuild.

---

## 0. How to read this

Every rule is marked:

| Mark | Meaning |
| --- | --- |
| **▸ SYSTEM** | Portable theory. Take it anywhere. This is the part that makes the work look considered. |
| **▸ OURS** | The Rampant Club's identity. Do **not** carry it into another brand — replace it with that brand's own answer to the same question. |

The distinction matters commercially as well as aesthetically. A white-label
spinoff that reuses the *grammar* is a studio with a house method. One that
reuses the *lion, the green and the typeface* is the same club wearing a
different name, and it will read that way to anyone who sees both.

The single most useful idea in this document is in §1: **one ground, one ink.**
Most of the rest follows from it.

---

## 1. Colour — one ground, one ink

**▸ SYSTEM.** A surface declares a *ground* (its background) and an *ink* (its
foreground). Everything on that surface is the ink at some opacity, or the
ground at some opacity. There is no third neutral, no grey ramp, no "card
background" two shades off the page.

In code this is literally two values — `components/public/kit.tsx`:

```tsx
<PublicPage ground="#052E20" ink="#E5D4C2">
```

…which paints `html`, `body` and the page, and exposes `--pk-ink` for
descendants. Every hairline, every muted label, every disabled state is then
`currentColor` at an opacity:

| Use | Value |
| --- | --- |
| Body text | ink at `.86–.88` |
| Secondary / meta | ink at `.55–.62` |
| Hairline rule | ink at `.14` |
| Hover rule | the accent, full strength |

**Why it works.** Opacity of one ink can never clash with itself. A palette of
five greys can, and does, the moment someone adds a sixth.

### The accent

**▸ SYSTEM.** *One* accent, used for exactly three jobs: the active state, the
hover state, and the one thing on a screen you want touched next. Never for
decoration, never for a second-level heading, never as a gradient.

**▸ OURS.** Bottle green `#052E20`, cream `#E5D4C2`, gold `#D4B85A`, sage
`#B0C18E` (the Studio's own ground). The four are declared once in
`kit.tsx` and imported everywhere; nothing else is allowed to invent a colour.

### The veils come off

**▸ SYSTEM, and the hardest-won rule here.** No full-screen overlays over your
own ground — no vignette, no "paper grain", no time-of-day tint. The homepage
carried three, and together they dragged the authored cream from
`rgb(229,212,194)` to `rgb(208,196,179)`, and its warmth (R−B) from 35 to 28.
The page read *dull*, not *atmospheric*, and no one could say why because each
veil was individually defensible.

The homepage is now plain block colour, measured at exactly the authored values.

Two method notes worth carrying:

1. **Never derive a layer's cost by subtracting deviations.** Compositing is not
   additive and a blend mode changes how everything beneath it combines. Only
   endpoints — all on, all off, one alone — are trustworthy.
2. **Never sample one pixel of a noise texture.** Average an area, or you have
   measured where the grain happened to be dark.

---

## 2. Type — two faces, ten stops

**▸ SYSTEM.** Two typefaces, and a reason for each:

- **A display face** for names and headings. Set *large*, left-aligned, tight
  (`line-height: .92–.98`). It should feel like signage, not like a heading tag.
- **A monospace** for everything a person reads or operates: body copy, labels,
  metadata, buttons. Mono at a generous line-height (`1.9–2.0`) reads as
  *considered* rather than *technical*, and it makes bilingual text line up.

**There is no third face.** A third face is how a system starts looking like a
template.

**▸ SYSTEM.** Ten size stops, declared once as CSS variables in
`app/layout.tsx`, and every new size snaps to one of them:

```
--fs-micro 10 · --fs-eyebrow 11 · --fs-body 12 · --fs-meta 14 · --fs-card 16
--fs-h3 20 · --fs-h2-sm 24 · --fs-h2 28 · --fs-h1 32 · --fs-hero 48
```

with three of them shrinking under 768px. Headings that must scale with the
viewport use `clamp()` against those anchors, e.g. the member masthead:
`clamp(46px, 7.6vw, 104px)`.

**▸ SYSTEM.** `font-display: block` on self-hosted faces, with `preload`. A
display face that flashes a fallback and then re-flows is worse than a page that
paints 80ms later — particularly when the fallback has different letterforms.

**▸ OURS.** *Rampant Sans* (bespoke, caps-only — so the club's own name sets as
`THE RAMPANT CLUB`, and an artist's name as `QUỲNH ANH LÊ`, which is a decision
to make consciously before someone sees their own name in caps), *Google Sans
Code* as the mono, *Pinyon Script* for two buttons.

> **Licensing, for any spinoff:** a bespoke face is licensed to the brand that
> commissioned it. Lactone Labs needs its own display face. The *system* — one
> display, one mono, ten stops, mono-for-everything-operable — carries over
> intact and is what actually does the work.

---

## 3. Structure — hairlines, not cards

**▸ SYSTEM.** Rows are separated by a 1px rule at ink-14%. Not a card, not a
border-box, not a shadow, not a rounded container. A list of five things is five
rows and six rules; the last one closes the list.

```css
.row      { display: grid; grid-template-columns: 22px minmax(0,1fr); gap: 16px;
            padding: 16px 0; border-top: 1px solid rgba(ink,.14); }
.row:last-child { border-bottom: 1px solid rgba(ink,.14); }
```

**Why:** cards are a way of avoiding a decision about hierarchy. Rules force the
hierarchy into the type, where it belongs. The portal guide is the clearest
before/after in this codebase — it was badges, pills and a rounded card, and is
now rules and type (`components/PortalGuide.tsx`).

**▸ SYSTEM.** One measure: `max-width: 1180px`, `padding: 0 24px` (20px under
860px). One masthead pattern: a large title, an optional subtitle in the display
face, a lede at `max-width: 560–600px`, and art in the empty half.

**▸ SYSTEM.** Buttons are text with a 1px underline and a sliding arrow, not
filled rectangles:

```css
.cta { border: none; background: none; border-bottom: 1px solid currentColor;
       padding: 0 0 6px; font: 12px/1 mono; letter-spacing: .12em;
       text-transform: uppercase; }
.cta:hover .go { transform: translateX(7px); }
```

The arrow moving on hover is the entire affordance. It costs one rule and it is
the detail people describe as "expensive".

**▸ SYSTEM.** Eyebrows (`OUR STORY ·  01 —`) are filler unless they carry real
information. We removed most of ours — chapter numerals, section labels, floor
numbers — and the pages got better. Keep an eyebrow only where it says something
the heading cannot: a step count, a date, a status.

---

## 4. Motion — arrive, drift, and get out of the way

**▸ SYSTEM.** Three motions, and no others:

| Motion | Spec | Where |
| --- | --- | --- |
| **Rise** | `opacity 0→1`, `translateY(22px)→0`, `.9s cubic-bezier(.16,.84,.44,1)` | Content arriving on scroll (`IntersectionObserver`, fires once) |
| **Drift** | `rotate ±3deg`, `translateY(-10px)`, `8s ease-in-out infinite alternate` | Illustrations only, never text or UI |
| **Slide** | `translateX(7px)`, `.35s ease` | The arrow on a hover |

One easing curve — `cubic-bezier(.16,.84,.44,1)` — everywhere. A system with
three easings reads as three systems.

**▸ SYSTEM.** `@media (prefers-reduced-motion: reduce)` kills all three, in the
same stylesheet that declares them. Not a global override file: next to the
rule, so it cannot be forgotten.

**▸ SYSTEM — a real trap.** An element with an animation attached is a *stacking
context*, and a `transform` on an ancestor **re-bases every `position: fixed`
descendant**. We shipped a bug where a page-level fade held modals underneath a
tab bar, and another where `position: fixed` modals opened in the wrong place
entirely. Rules:

- Fade with **opacity only** at page level, never transform.
- Drop the animation once it has run (`onAnimationEnd` → set a settled flag).
- A modal that must escape its parent is portalled to `document.body`.

---

## 5. Imagery

**▸ SYSTEM.** Photographs are the brand's own, at **two widths** — 800px for
tiles and inline panels, 1600px for heroes and bleeds — as `.webp`, named
`subject-width.webp`. A helper picks the width, and a prefix decides which set a
name belongs to, so a swap is one line rather than a rewrite of every call site:

```tsx
const photo = (n: string) => n.startsWith('trc/') ? `/images/${n}-1600.webp`
                                                 : `/images/social/${n}.webp`
```

**▸ SYSTEM.** Stock photography is a placeholder with a deadline, and it should
be tracked like debt. Ours is down to 8 slots, all needing the same three
subjects (the building, the lounge, the shelves). Knowing *which* slots and
*which* subjects is what turns "we need better photos" into a shot list.

**▸ SYSTEM.** Photographs get `object-position` per image, not a global
`50% 50%`. A face 62% across the frame is the difference between a portrait and
a crop of someone's ear.

**▸ SYSTEM + a technique worth stealing.** Line illustrations are drawn once for
the light ground, then **re-inked in the browser** for the dark one with an SVG
`feColorMatrix` — no second set of files, no divergence between them
(`components/public/CreamInk.tsx`). Because every pixel in the set is either the
black line or the orange wash, one channel identifies which, and the matrix maps
black→cream while leaving the wash alone. `color-interpolation-filters="sRGB"`,
or the numbers mean something else.

**▸ OURS.** The lion in his several attitudes, the club's ink set, the
photographs themselves.

---

## 6. Language — a bilingual system, not a translated one

**▸ SYSTEM.** These four rules are the ones most worth copying, because most
bilingual products get them wrong:

1. **One language context.** We had three implementations of "what language is
   this?" before consolidating to `lib/lang.tsx`. Three contexts means three
   answers on one screen.
2. **One control.** A single `LangToggle` component, rendered wherever a switch
   is needed. Two controls for one setting diverge visually first and
   behaviourally later — we hand-rolled the same EN/VN pair three separate
   times before this rule stuck.
3. **One registry of names.** `lib/members/surfaces.ts` holds the name of every
   surface in both languages; navigation decides *order and grouping*, never
   *what a thing is called*. Before this, one page was called four different
   things across admin, the members' menu and the page itself.
4. **Show one language at a time — once there is a switch.** Stacking EN over VN
   is correct when there is no control (our public nav still does it). The
   moment a switch exists, the second line repeats what the reader has just
   declined and doubles the height of the menu.

**▸ SYSTEM.** Fall back **per field**, never per record. A notice with a
translated title and an untranslated body shows the translated title over the
English body — not one language for the whole row, and never a hidden row.

**▸ SYSTEM, and a house rule:** member-facing translation is **written by a
person**, never machine-generated. So a translation column is nullable, nothing
is backfilled, and an empty column is the honest state until someone writes the
words (`db/notices_vn.sql` is the worked example — including *why* the
translation is not mandatory: a notice must be postable in thirty seconds by
whoever is on shift).

---

## 7. The vocabulary

`components/public/kit.tsx` is the whole system as code — 227 lines.
Anything built from these parts looks like the house without anyone deciding to
make it so:

| Part | What it is |
| --- | --- |
| `PublicPage` | Ground + ink, painted to the document edges |
| `Rise` | Arrive-on-scroll, once |
| `Masthead` / `SectionHead` | The two heading arrangements |
| `Eyebrow` / `Cta` | The mono label and the underlined action |
| `InkFloat` / `CreamInk` | A drifting illustration, either ground |
| `BleedImage` / `pk-thumb` | Full-bleed and contained photography |
| `Details` | Label/value rows on hairlines |

**▸ SYSTEM.** The tell that a system is real: a new page is *assembled*, not
*styled*. If building a page means writing colours and sizes, the system is a
mood board.

---

## 8. The process rules (these are the system too)

**▸ SYSTEM.** Four working habits that keep the above from eroding:

1. **A comment records whose decision it was and when — it does not re-argue the
   case.** A comment that argues a side gets reversed by the next person who
   argues the other side. One line in this codebase went English-only →
   Vietnamese → English-only → Vietnamese over three sessions, because the note
   on it made a case instead of recording a call.
2. **Ship the reversal with the change.** When something is stood down, the file
   that puts it back goes in the same commit, and each file refuses the wrong
   state (our privacy gate: the publish script refuses if the gate is already
   on; the enable script refuses if the translation is missing).
3. **Verify by rendering, not by reasoning.** Diacritics were confirmed by
   screenshotting a stacked hook over a Y, not by reading the font's cmap. A
   colour claim is a measured pixel average. A layout claim is a bounding box.
   An inline `display: flex` silently beat a media query here, and only a
   measurement caught it.
4. **Name the thing once.** One registry for names, one file per token set, one
   component per control. Every drift bug in this codebase started as a second
   place that knew the same fact.

---

## 9. Taking it to Lactone Labs

**Take the whole of §§1–4 and §6–8.** That is the transferable craft: ground and
ink, two faces and ten stops, hairlines instead of cards, one easing, the
bilingual rules, the process habits. None of it identifies The Rampant Club.

**Replace, do not adapt:**

| Slot | The Rampant Club | Lactone Labs needs |
| --- | --- | --- |
| Ground | `#052E20` bottle green | Its own ground — and one, not a palette |
| Ink | `#E5D4C2` cream | Its own ink, contrast-checked against that ground |
| Accent | `#D4B85A` gold | One accent, three jobs |
| Display face | Rampant Sans (bespoke, licensed to TRC) | Its own licensed display face |
| Mono | Google Sans Code | Any well-drawn mono; this one is fine to reuse |
| Illustration | The house ink set (the lion) | Its own mark and drawings |
| Photography | The club's own | Its own — the two-width convention carries |

**A note on the second brand's ground.** The one change that will make Lactone
Labs look like a different company rather than a recolour: pick a ground with a
different *value*, not just a different hue. Ours is a very dark ground with a
light ink. A light ground with a dark ink, run through exactly these rules, will
read as an entirely separate house — and will prove the system is a method
rather than a look.

**On independent creation.** Keep the two documented separately. This file
describes a method; it deliberately does not contain The Rampant Club's assets,
and a Lactone Labs implementation built from it should cite it rather than copy
club files across. Where the same *code* is genuinely shared — the kit, the lang
context, the fallback logic — share it as a dependency with its own history,
not as a paste. The independent-creation evidence for the flavour work lives
with the Lactone Labs project rather than in this repo; this file is dated and
sits in the club's own history, which makes it evidence too.

---

## Appendix — the numbers, for reference

```
Column      1180px, padding 24px (20px ≤860px)
Rules       1px, ink at 14%
Radius      12px on photographs · 8px on small chrome · 999px on the
            EN/VN pill · 0 on everything that holds content
Easing      cubic-bezier(.16,.84,.44,1)
Rise        .9s, translateY(22px)
Drift       8s alternate, ±3deg, translateY(-10px)
Body        mono 13–14px / line-height 1.9–2.0
Lede        max-width 560–600px
Display     clamp(40px, 7vw, 88px) typical; line-height .92–.98
Breakpoints 860px (layout), 768px (portal chrome), 640px (boards)
Images      -800.webp (tiles/panels) · -1600.webp (heroes/bleeds)
```
