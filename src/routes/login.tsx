import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { z } from 'zod'

import { appCopy } from '@/copy/app'
import { LoginForm } from '@/features/auth/components/login-form'
import { authCopy } from '@/features/auth/copy'

import { searchText } from './-components/search-params'

const searchSchema = z.object({
  return_to: searchText,
  error: z.enum(['passcode', 'limit']).optional().catch(undefined),
})

/**
 * The passcode page. The Worker's gate sends every signed-out page load here
 * (src/server/auth/gate.ts), and the root layout renders it without the
 * sidebar and header. It is prerendered as its own page (vite.config.ts) so
 * it arrives as a login form rather than the app's shell.
 */
export const Route = createFileRoute('/login')({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: appCopy.metadata.title(authCopy.login.pageTitle) },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: LoginPage,
})

const noopSubscribe = () => () => {}

function LoginPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // Why the last attempt was sent back, read once: the URL loses it below,
  // and the message has to stay until the next attempt reloads the page.
  const [error] = useState(search.error)
  // The page is prerendered without a query string, so what depends on it
  // (where to go back to, the wrong-passcode message) appears only once the
  // browser has hydrated the prerendered markup.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  // Out of the address bar, so a reload or a bookmark doesn't bring back a
  // wrong-passcode message for an attempt nobody just made.
  useEffect(() => {
    if (search.error === undefined) return
    void navigate({
      search: (prev) => ({ ...prev, error: undefined }),
      replace: true,
      resetScroll: false,
    })
  }, [search.error, navigate])
  return (
    <LoginForm
      returnTo={hydrated ? search.return_to : undefined}
      error={hydrated ? error : undefined}
    />
  )
}
