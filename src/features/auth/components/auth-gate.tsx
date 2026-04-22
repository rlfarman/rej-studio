import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session'
import { LoginForm } from '@/features/auth/components/login-form'

// Auth is engaged when BASIC_AUTH_PASSWORD is set. In dev, setting
// BYPASS_AUTH=true skips the gate entirely.
function authGateActive(): boolean {
  if (!process.env.BASIC_AUTH_PASSWORD) return false
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.BYPASS_AUTH === 'true'
  ) {
    return false
  }
  return true
}

/**
 * Reads the session cookie and either renders `children` (authenticated or
 * gate disabled) or the login form. Kept as its own async component so the
 * root layout can wrap it in a Suspense boundary — required under Next.js 16
 * Cache Components, which disallows `cookies()` / `headers()` outside a
 * Suspense boundary.
 */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  if (!authGateActive()) return <>{children}</>

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await verifySession(token)
  if (session) return <>{children}</>

  const pathname = (await headers()).get('x-pathname') ?? undefined
  const returnTo =
    pathname && pathname !== '/login' && !pathname.startsWith('/api/')
      ? pathname
      : undefined
  return <LoginForm returnTo={returnTo} />
}
