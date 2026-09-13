import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import MembershipSigning from '@/components/MembershipSigning'
import { renderDocument } from '@/lib/documents/render'

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invitation, error } = await supabase
    .from('signing_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !invitation) {
    console.error('Sign page error:', error, 'Token:', token)
    notFound()
  }

  // Track that the prospect opened the link. Awaited so it actually
  // completes — fire-and-forget in a server component can be killed when
  // the serverless function returns.
  const { error: viewErr } = await supabase
    .from('signing_invitations')
    .update({
      viewed_at: invitation.viewed_at ?? new Date().toISOString(),
      view_count: (invitation.view_count ?? 0) + 1,
    })
    .eq('id', invitation.id)
  if (viewErr) console.warn('Failed to track invitation view:', viewErr)

  // ── THE TERMS COME FROM THE REGISTER, NOT FROM A FILE ────────────────────
  // The signing flow used to render its own copy of the Terms out of
  // data/membership-agreement-content.json — sixteen articles frozen in the
  // repo, while /members/terms read the register. Two copies of one contract,
  // and on 2026-09-13 they diverged for real: members began reading v2.0 (24
  // articles, both schedules) while an applicant would still have signed the
  // old JSON. Now both surfaces read the same row, so they cannot drift again.
  //
  // Rendered SERVER-SIDE: the markdown never reaches the browser, and the
  // renderer has raw HTML off (lib/documents/render.ts).
  const { data: termsVersionId } = await supabase.rpc('current_terms_version', { p_doc_key: 'membership_terms' })
  const { data: termsRow } = termsVersionId
    ? await supabase.from('terms_versions')
        .select('id, version, effective_date, title_en, title_vn, body, body_vn')
        .eq('id', termsVersionId).maybeSingle()
    : { data: null }
  const terms = termsRow ? {
    id: termsRow.id as string,
    version: (termsRow.version as string) || '',
    effectiveDate: (termsRow.effective_date as string) || '',
    titleEn: (termsRow.title_en as string) || 'Terms and Conditions',
    titleVn: (termsRow.title_vn as string) || 'Điều Kiện và Điều Khoản',
    htmlEn: renderDocument(termsRow.body as string),
    // A missing Vietnamese body falls back to the English, never to blank —
    // the same rule /members/terms follows.
    htmlVn: renderDocument((termsRow.body_vn as string) || (termsRow.body as string)),
  } : null

  return (
    <MembershipSigning
      token={token}
      terms={terms}
      prefill={{
        fullName: invitation.full_name || '',
        email: invitation.email || '',
        mobile: invitation.mobile || '',
        referredBy: invitation.referred_by || '',
        profession: invitation.profession || '',
        category: invitation.category || '',
        dateOfBirth: '',
        nationality: '',
        homeAddress: '',
        companyName: '',
      }}
    />
  )
}
