// Renders account UI with the account state already known, so no test
// fetches /api/account.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vite-plus/test'

import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AccountUser } from '@/lib/account/account'

export const ADA: AccountUser = {
  id: 'ada-id',
  email: 'ada@example.com',
  name: '',
  image: null,
}

export type AccountFixture =
  | 'signed-out'
  | 'signed-in'
  | 'unavailable'
  /** The passcode gate answered 401 (`fetchAccount`). */
  | 'locked'

function accountState(
  fixture: AccountFixture,
  { google = false }: { google?: boolean } = {},
) {
  if (fixture === 'locked') return { locked: true }
  return {
    locked: false,
    available: fixture !== 'unavailable',
    providers: { email: fixture !== 'unavailable', google },
    user: fixture === 'signed-in' ? ADA : null,
  }
}

export function renderWithAccount(
  ui: ReactNode,
  fixture: AccountFixture | 'loading',
  options: { google?: boolean } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (fixture !== 'loading') {
    client.setQueryData(['account'], accountState(fixture, options))
  }
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <SidebarProvider>{ui}</SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...view, client }
}

/** Answers `/api/account` with `fixture` from now on (a refetch after sign-in). */
export function serveAccount(fixture: AccountFixture) {
  const fetch = vi.fn(async () =>
    // What the gate answers once the passcode session has run out.
    fixture === 'locked'
      ? new Response(null, { status: 401 })
      : Response.json(accountState(fixture)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
