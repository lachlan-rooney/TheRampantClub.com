import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import MembershipSigning from '@/components/MembershipSigning'

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

  return (
    <MembershipSigning
      token={token}
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
