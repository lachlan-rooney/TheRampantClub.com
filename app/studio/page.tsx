import { createClient } from '@supabase/supabase-js'
import NavOverlay from '@/components/NavOverlay'
import StudioShowcase, { type Collaboration, type CollabImage } from '@/components/StudioShowcase'

// ═══════════════════════════════════════════════════════════════════════════
// THE STUDIO — the club's gallery floor, one collaboration at a time.
// ───────────────────────────────────────────────────────────────────────────
// Server-rendered. Public read is allowed by RLS for status live/past only, so
// a draft exhibition cannot leak before it opens — the anon key sees exactly
// what a visitor should see, and nothing is filtered in the page.
//
// DATA, NOT CODE. The third collaboration is a row in `collaborations`. Nothing
// on this page knows either artist's name.
export const revalidate = 300

const anon = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

export const metadata = {
  title: 'The Studio — The Rampant Club',
  description: 'The club’s gallery floor. One collaboration at a time.',
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
      <StudioShowcase
        collaborations={(collabs || []) as Collaboration[]}
        images={(images || []) as CollabImage[]}
      />
    </>
  )
}
