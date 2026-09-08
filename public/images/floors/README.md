# Floor logos — drop them here and they appear

The kiosk board shows the logo for the room its tablet stands in. Nothing else is
needed: name the file after the floor slug and it renders. If the file is absent the
board simply shows no logo — never a broken image.

    library-bar.png        Floor 1 · The Library Bar     — open book + monocle
    studio.png             Floor 2 · The Studio          — artist's paintbrush
    dining-room.png        Floor 3 · The Dining Room     — dinner plate
    rampant-room.png       Floor 4 · The Rampant Room    — cut-crystal tumbler
    source-origin-lab.png  Floor 5 · Source & Origin Lab — conical flask

All five confirmed by Lachlan. The paintbrush and the plate were originally read
the wrong way round — a paintbrush at that size resembles a lit candle, and the
plate edge-on resembles a plinth. Check the object, not the silhouette.

The office lion (holding a folder) is not a floor — it is the admin portal mark,
at /images/logo-office-cream.png.

These were supplied as Canva SVGs wrapping a raster of club-green art on OPAQUE
BLACK. Dropped straight onto the board they would have been a black slab with
near-invisible art, since the board's ground is the same green. They were recovered
by treating brightness as coverage to rebuild the alpha, then painted cream
(#E5D4C2). Any replacement should be cream-on-transparent for the same reason.

SVG is preferred — the tablets are high-DPI and the board scales the logo with the
viewport. Cream (#E5D4C2) or white on transparent reads best against the dark green
ground; a logo with a baked-in light background will show as a pale block.
