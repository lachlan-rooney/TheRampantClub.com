import { redirect } from 'next/navigation'

// Sports Fixtures merged into the unified "What's On" page (Events & Fixtures).
// Old links / bookmarks land there, on the sport-filterable timeline.
export default function FixturesRedirect() {
  redirect('/members/events')
}
