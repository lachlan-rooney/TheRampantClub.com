'use client'

import NavOverlay from '@/components/NavOverlay'
import SpacesShowcase from '@/components/SpacesShowcase'

// Public mirror of the members' Spaces page. Same building, same photos and
// descriptions — but the members-only menu and events CTAs are hidden (see
// SpacesShowcase). This is the club's public showcase of its floors.
export default function PublicSpacesPage() {
  return (
    <>
      <NavOverlay variant="public" />
      <SpacesShowcase variant="public" />
    </>
  )
}
