import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'

import { useHydrated } from '@/hooks/use-hydrated'

/**
 * Who is signed in to an account, for the page: read from `/api/account`
 * with a plain fetch (src/server/accounts/handler.ts), so drawing the
 * sign-in state never loads the auth client. Signing in and out load it on
 * demand (./auth-client.ts, through ./actions.ts).
 */

export interface AccountUser {
  id: string
  email: string
  name: string
  image: string | null
}

/** `GET /api/account`'s answer. */
interface AccountState {
  available: boolean
  providers: { email: boolean; google: boolean }
  user: AccountUser | null
}

const ACCOUNT_QUERY_KEY = ['account'] as const

/**
 * The key for a query whose answer depends on who is signed in (the
 * design tool's "My cloud designs"): under the account's own, so signing in
 * or out drops it with the account (`afterAccountChange`).
 */
export function accountScopedKey<const T extends readonly unknown[]>(
  ...parts: T
) {
  return [...ACCOUNT_QUERY_KEY, ...parts] as const
}

/**
 * After signing in or out: forget everything read as the previous account,
 * and read the account again.
 */
export async function afterAccountChange(queryClient: QueryClient) {
  queryClient.removeQueries({
    queryKey: ACCOUNT_QUERY_KEY,
    predicate: (query) => query.queryKey.length > ACCOUNT_QUERY_KEY.length,
  })
  await queryClient.invalidateQueries({
    queryKey: ACCOUNT_QUERY_KEY,
    exact: true,
  })
}

async function fetchAccount(): Promise<AccountState> {
  const response = await fetch('/api/account', {
    headers: { accept: 'application/json' },
  })
  // The passcode session ran out (401): no account can be used either.
  if (response.status === 401) {
    return {
      available: false,
      providers: { email: false, google: false },
      user: null,
    }
  }
  if (!response.ok) throw new Error(`account: HTTP ${response.status}`)
  return (await response.json()) as AccountState
}

const accountQuery = queryOptions({
  queryKey: ACCOUNT_QUERY_KEY,
  queryFn: fetchAccount,
  staleTime: 5 * 60_000,
  retry: 1,
})

export type Account =
  /** Not known yet (and in the prerendered shell, which renders this). */
  | { status: 'loading' }
  /** No accounts on this deployment, or the account service did not answer. */
  | { status: 'unavailable' }
  | { status: 'signed-out'; google: boolean }
  | { status: 'signed-in'; user: AccountUser; google: boolean }

/**
 * The visitor's account state.
 *
 * `loading` until the page has hydrated, not merely until the read lands:
 * the design tool is prerendered, and the account read can finish before
 * React hydrates it. Deciding from the data alone then renders "sign in"
 * over markup prerendered without it — a hydration mismatch that discards
 * the whole tree, and one that appears only when the timing goes that way.
 */
export function useAccount(): Account {
  const hydrated = useHydrated()
  const { data, isPending, isError } = useQuery(accountQuery)
  if (!hydrated || isPending) return { status: 'loading' }
  if (isError || !data.available) return { status: 'unavailable' }
  const google = data.providers.google
  return data.user
    ? { status: 'signed-in', user: data.user, google }
    : { status: 'signed-out', google }
}
