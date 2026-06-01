import { redirect } from 'next/navigation'

// Backwards-compat shim for the old /admin/harmony URL after the rename to
// /admin/recap. Catch-all so bookmarks like /admin/harmony/<id> or
// /admin/harmony/new still resolve.

export default async function HarmonyRedirect({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const tail = slug && slug.length ? `/${slug.join('/')}` : ''
  redirect(`/admin/recap${tail}`)
}
