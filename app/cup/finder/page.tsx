'use client'

import TouchFinder from '@/components/whisky/TouchFinder'

// ─────────────────────────────────────────────────────────────────────────────
// THE RAMPANT CUP — the Flavour Finder for the event.
// Public, no login, touch/tablet-first. Was a baked 40-bottle file for Ho Tram;
// now it inherits the whole library from the DB. The finder itself lives in
// components/whisky/TouchFinder so the floor tablets (/kiosk/finder) share it.
// ─────────────────────────────────────────────────────────────────────────────

export default function CupFinder() {
  return <TouchFinder eyebrow="The Rampant Cup" />
}
