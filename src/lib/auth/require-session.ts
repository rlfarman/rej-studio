import { cookies } from 'next/headers'
import { isAuthGateActive } from '@/lib/auth/gate'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'

/**
 * Throws unless the caller has a valid session (or the gate is off).
 *
 * The proxy already rejects unauthenticated server-action POSTs, but server
 * actions are public HTTP endpoints addressed by action ID, so the ones that
 * spend compute or query the database re-check here instead of relying on
 * the proxy matcher alone.
 */
export async function requireSession(): Promise<void> {
  if (!isAuthGateActive()) return
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!(await verifySession(token))) {
    throw new Error('Authentication required.')
  }
}
