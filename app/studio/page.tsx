import { createClient } from '@supabase/supabase-js'
import NavOverlay from '@/components/NavOverlay'
import StudioIndex, { type Collaboration, type CollabImage } from '@/components/StudioIndex'

// ═══════════════════════════════════════════════════════════════════════════
// /studio — THE ROOM. Not an exhibition.
// ───────────────────────────────────────────────────────────────────────────
// This page is about The Studio itself: the gallery floor, what it is, and what
// has hung in it. An exhibition gets its OWN page at /studio/[slug], because a
// gallery's landing page is not a monograph on whoever is showing this quarter
// — and because with eight collaborations a single scrolling page is unusable.
export const revalidate = 300

const anon = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

export const metadata = {
  title: 'The Studio — The Rampant Club',
  description: 'The club’s gallery floor. A quarterly rotating art space, made with the artist.',
}

export default async function StudioPage() {
  const sb = anon()
  const { data: collabs } = await sb.from('collaborations')
    .select('*').in('status', ['live', 'past']).order('sort')
  const ids = (collabs || []).map(c => c.id)
  const { data: images } = ids.length
    ? await sb.from('collaboration_images').select('*').in('collaboration_id', ids).order('sort')
    : { data: [] }

  return (
    <>
      <NavOverlay variant="public" />
      <StudioIndex
        collaborations={(collabs || []) as Collaboration[]}
        images={(images || []) as CollabImage[]}
      />
    </>
  )
}
