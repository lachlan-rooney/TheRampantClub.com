import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function createSigningLink(prospect: {
  fullName: string
  email: string
  mobile?: string
  referredBy?: string
  profession?: string
  category?: string
}) {
  const token = randomUUID()

  const { error } = await supabaseAdmin.from('signing_invitations').insert({
    token,
    full_name: prospect.fullName,
    email: prospect.email,
    mobile: prospect.mobile || null,
    referred_by: prospect.referredBy || null,
    profession: prospect.profession || null,
    category: prospect.category || null,
  })

  if (error) throw error

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  return `${baseUrl}/sign/${token}`
}

export { supabaseAdmin }
