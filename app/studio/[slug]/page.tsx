import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import NavOverlay from '@/components/NavOverlay'
import StudioExhibition, { type Collaboration, type CollabImage } from '@/components/StudioExhibition'

// One exhibition, its own page. Draft rows are invisible to the anon key by
// RLS, so an unpublished collaboration 404s rather than being filtered here.
export const revalidate = 300

const anon = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: c } = await anon().from('collaborations')
    .select('artist_name, title_en').eq('slug', slug).maybeSingle()
  if (!c) return { title: 'The Studio — The Rampant Club' }
  return {
    title: `${c.title_en || c.artist_name} — The Studio, The Rampant Club`,
    description: `${c.artist_name} at The Studio.`,
  }
}

export default async function ExhibitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = anon()
  const { data: c } = await sb.from('collaborations').select('*').eq('slug', slug).maybeSingle()
  if (!c) notFound()
  const { data: images } = await sb.from('collaboration_images')
    .select('*').eq('collaboration_id', c.id).order('sort')

  return (
    <>
      <NavOverlay variant="public" />
      <StudioExhibition
        collaboration={c as Collaboration}
        images={(images || []) as CollabImage[]}
      />
    </>
  )
}
