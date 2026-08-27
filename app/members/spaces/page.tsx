'use client'

import SpacesShowcase from '@/components/SpacesShowcase'

// Members' view — full CTAs, including the members-only menu + events links.
// Shares every pixel with the public /spaces page except those gated links.
export default function SpacesPage() {
  return <SpacesShowcase variant="internal" />
}
