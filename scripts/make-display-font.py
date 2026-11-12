"""
RAMPANT SANS DISPLAY — the diamond A, on the A key.

The diamond A (A.ss01) has no Unicode codepoint: it is reachable only through
the OpenType features ss01 and calt, and Canva honours neither. This builds a
SEPARATE font in which pressing A produces it.

⚠ The real font is not touched. This writes new files under a new family name,
so the two can sit side by side in a font menu without either shadowing the
other — and anything already set in Rampant Sans keeps the plain A.

  python3 scripts/make-display-font.py

── HOW, AND WHY THIS WAY ────────────────────────────────────────────────────
The obvious method is to repoint U+0041 in the cmap at the A.ss01 glyph. That
works — it was the first build, and every browser rendered it correctly — but
Canva refused the file, and a cmap that sends a letter to a glyph named for a
stylistic set is the only unusual thing about it.

So this build does the duller thing instead: it copies the diamond OUTLINE into
the glyph called A and leaves the cmap exactly as the foundry shipped it. The
result is a font whose structure is identical to the original — same glyph
names, same character map, same table inventory — differing only in the drawing
of one glyph and in the family name. There is nothing left for a validator to
dislike that it would not also dislike about the original.

The stale DSIG goes too: MN Rampant Sans is digitally signed, and the moment a
byte changes that signature is wrong. A font carrying a signature that does not
match its contents is exactly what a strict uploader rejects.
"""
import os
from copy import deepcopy
from fontTools.ttLib import TTFont

SRC_DIR = '/Users/lachlanrooney/Downloads/rampant-club/public/fonts'
OUT_DIR = '/Users/lachlanrooney/Downloads/rampant-club/public/fonts/display'

FAMILY = 'Rampant Sans Display'
SUBFAMILY = 'Regular'
FULL = f'{FAMILY} {SUBFAMILY}'
PS = 'RampantSansDisplay-Regular'
UNIQUE = f'1.000;TRCA;{PS}'
ALT = 'A.ss01'          # the diamond. 'A.ss02' is the crossbar-less peak.
TARGET = 'A'


def build(src, out, flavour=None):
    f = TTFont(src)
    if ALT not in f.getGlyphOrder():
        raise SystemExit(f'{src}: no glyph called {ALT}')

    # ── 1 · THE OUTLINE, NOT THE MAP ──────────────────────────────────────
    # The glyph called A is redrawn as the diamond. Nothing about which
    # character points at which glyph changes, so every other table — cmap,
    # GSUB, GPOS, GDEF — stays exactly as the foundry compiled it.
    if 'glyf' in f:
        f['glyf'][TARGET] = deepcopy(f['glyf'][ALT])
    elif 'CFF ' in f:
        cs = f['CFF '].cff.topDictIndex[0].CharStrings
        cs[TARGET] = cs[ALT]
    else:
        raise SystemExit(f'{src}: neither glyf nor CFF')

    # The advance width goes with it, or the letter after A sits wrong. In this
    # font the two are the same 564 units, but a build that only works because
    # two numbers happen to match is a build that breaks silently.
    f['hmtx'][TARGET] = f['hmtx'][ALT]

    # ── 2 · A NAME OF ITS OWN ─────────────────────────────────────────────
    # Without this both files claim to BE Rampant Sans and the font menu shows
    # one of them, chosen by whichever the system cached first.
    for rec in f['name'].names:
        i = rec.nameID
        if i == 1:    rec.string = FAMILY
        elif i == 2:  rec.string = SUBFAMILY
        elif i == 3:  rec.string = UNIQUE
        elif i == 4:  rec.string = FULL
        elif i == 6:  rec.string = PS
        elif i == 16: rec.string = FAMILY
        elif i == 17: rec.string = SUBFAMILY

    if 'CFF ' in f:
        cff = f['CFF '].cff
        cff.fontNames[0] = PS
        td = cff.topDictIndex[0]
        if hasattr(td, 'FullName'):   td.FullName = FULL
        if hasattr(td, 'FamilyName'): td.FamilyName = FAMILY

    # ── 3 · THE STALE SIGNATURE ───────────────────────────────────────────
    had_dsig = 'DSIG' in f
    if had_dsig:
        del f['DSIG']

    if flavour:
        f.flavor = flavour
    f.save(out)
    print(f'  {os.path.basename(out):42} A redrawn from {ALT}  DSIG {"removed" if had_dsig else "none"}')


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    print('building Rampant Sans Display:')
    # TTF FIRST AND DELIBERATELY: Canva takes .ttf, .otf and .woff, and a
    # TrueType outline is the one every uploader has always accepted.
    build(f'{SRC_DIR}/MNRampantSans-Regular.ttf', f'{OUT_DIR}/{PS}.ttf')
    build(f'{SRC_DIR}/MNRampantSans-Regular.otf', f'{OUT_DIR}/{PS}.otf')
    build(f'{SRC_DIR}/MNRampantSans-Regular.ttf', f'{OUT_DIR}/{PS}.woff', flavour='woff')
    build(f'{SRC_DIR}/MNRampantSans-Regular.ttf', f'{OUT_DIR}/{PS}.woff2', flavour='woff2')
