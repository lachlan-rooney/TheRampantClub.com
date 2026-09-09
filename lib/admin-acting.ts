import { cookies } from 'next/headers'
import { ACTING_COOKIE, signActor, verifyActor } from '@/lib/acting-identity'

// Request-context wrapper around the signed acting identity. The crypto lives in
// lib/acting-identity.ts so it can be tested without a request.
export { signActor, verifyActor, ACTING_COOKIE as ADMIN_STAFF_COOKIE }

/** The acting team_members.id for this request, or null if not proven. */
export async function actingStaffId(): Promise<string | null> {
  return verifyActor((await cookies()).get(ACTING_COOKIE)?.value)
}
