import { cookies, headers } from 'next/headers'
import { connection } from 'next/server'
import { isAuthGateActive } from '@/lib/auth/gate'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'
import { LoginForm } from '@/features/auth/components/login-form'

/**
 * Backstop for the session gate in `src/proxy.ts`, which is what actually
 * protects pages: it redirects to /login before anything renders. This only
 * matters if a page ever slips past the proxy matcher, and it can't fully
 * protect one on its own — Next renders the page segment (and its data) in
 * parallel with this layout.
 *
 * Kept as its own async component so the root layout can wrap it in a
 * Suspense boundary — required under Next.js 16 Cache Components, which
 * disallows `cookies()` / `headers()` outside a Suspense boundary.
 */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  if (!isAuthGateActive()) return <>{children}</>

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  // verifySession checks expiry against Date.now(), which Cache Components
  // only allows once the render is explicitly request-time.
  await connection()
  const session = await verifySession(token)
  if (session) return <>{children}</>

  const pathname = (await headers()).get('x-pathname') ?? undefined
  // The login page renders its own form, which carries the `return_to` the
  // proxy put on the redirect. Replacing it here would drop that.
  if (pathname === '/login') return <>{children}</>
  const returnTo =
    pathname && !pathname.startsWith('/api/') ? pathname : undefined
  return <LoginForm returnTo={returnTo} />
}
