# Floor logos — drop them here and they appear

The kiosk board shows the logo for the room its tablet stands in. Nothing else is
needed: name the file after the floor slug and it renders. If the file is absent the
board simply shows no logo — never a broken image.

    library-bar.svg        (or .png)   Floor 1 · The Library Bar
    studio.svg             (or .png)   Floor 2 · The Studio
    dining-room.svg        (or .png)   Floor 3 · The Dining Room
    rampant-room.svg       (or .png)   Floor 4 · The Rampant Room
    source-origin-lab.svg  (or .png)   Floor 5 · Source & Origin Lab

SVG is preferred — the tablets are high-DPI and the board scales the logo with the
viewport. Cream (#E5D4C2) or white on transparent reads best against the dark green
ground; a logo with a baked-in light background will show as a pale block.
