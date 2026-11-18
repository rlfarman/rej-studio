/**
 * The browser entry, found by TanStack Start at `src/client.tsx` (it falls
 * back to its own copy of exactly this when the file is absent — see
 * `resolveStartEntryPlan` in @tanstack/start-plugin-core).
 *
 * It exists only to start Sentry: the hydration below is Start's default.
 */
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

import { initBrowserSentry } from '@/lib/sentry'

// Before hydration, so a crash while the first page renders is reported.
// Nothing is imported or sent without VITE_SENTRY_DSN.
initBrowserSentry()

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
