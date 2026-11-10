import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import NavOverlay from '@/components/NavOverlay'
import StudioGuide, { type GuideCollab, type GuidePiece, type GuideSense } from '@/components/StudioGuide'

// /studio/<slug>/guide — ONE EXHIBITION'S GUIDE, permanently.
//
// PUBLIC AND NO LOGIN, which is not a relaxation of anything: /studio and
// /studio/[slug] are already public server components reading through the anon
// key, and a guest scanning a code in the room cannot be asked to sign in.
// What keeps a DRAFT show private is the RLS policy on collaboration_pieces —
// live and past only — not the obscurity of the URL, which is the slug plus a
// guessable word.
//
// The anon key is used deliberately rather than the service role: it means
// this page is subject to that policy and cannot accidentally serve an
// unopened exhibition.
export const revalidate = 60

const anon = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

const FIELDS = 'id,slug,artist_name,artist_name_vn,title_en,title_vn,accent,opens_on,closes_on,hero_path,bio_en,bio_vn,food_en,food_vn,drinks_en,drinks_vn'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data } = await anon().from('collaborations')
    .select('artist_name,title_en').eq('slug', slug).in('status', ['live', 'past']).maybeSingle()
  const name = [data?.title_en, data?.artist_name].filter(Boolean).join(' — ')
  return {
    title: name ? `Gallery guide · ${name}` : 'Gallery guide · The Studio',
    description: 'A self-guided walk through the exhibition, piece by piece.',
  }
}

export default async function StudioGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = anon()
  const { data: collaboration } = await sb.from('collaborations')
    .select(FIELDS).eq('slug', slug).in('status', ['live', 'past']).maybeSingle()
  if (!collaboration) notFound()

  const { data: pieces } = await sb.from('collaboration_pieces')
    .select('*').eq('collaboration_id', collaboration.id).order('sort')

  // A request of its own: db/collaboration_senses.sql may not have been run,
  // and selecting it alongside the pieces would fail the whole page over a
  // table that only adds detail to five tabs.
  const { data: senses } = await sb.from('collaboration_senses')
    .select('sense, body_en, body_vn').eq('collaboration_id', collaboration.id)

  return (
    <>
      {/* THE SAME MENU AS EVERY OTHER PUBLIC PAGE. The guide shipped without
          it, on the reasoning that a guest scanning a code in the room wants
          to read and not to navigate. That was wrong in one specific way: the
          EN/VN switch lives inside this menu everywhere else on the site, so a
          guest who already knows where the language control is found nothing
          where they looked. /menus is the precedent — nav AND an on-page
          toggle. Both are the same LangToggle on the same context, so they
          cannot disagree. hideLogo, as on /studio and /studio/[slug]. */}
      <NavOverlay variant="public" hideLogo />
      <StudioGuide
        collaboration={collaboration as GuideCollab}
        pieces={(pieces || []) as GuidePiece[]}
        senses={(senses || []) as GuideSense[]}
      />
    </>
  )
}
