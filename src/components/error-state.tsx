'use client'

import { useEffect, type ReactNode } from 'react'

import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

interface ErrorStateProps {
  /** Whatever was thrown; client components can throw non-Error values. */
  error: unknown
  /** Next's `retry`: re-fetches and re-renders the boundary's segment. */
  retry: () => void
  /** Sentry tag identifying which error boundary caught it. */
  boundary?: string
  title: string
  description: string
  detail?: string
  /** Secondary action shown next to "Try again". */
  secondaryAction?: ReactNode
  standalone?: boolean
}

/**
 * Error-boundary UI shared by every error.tsx: reports to Sentry when it's
 * configured, then renders the common status layout with a retry action.
 */
export function ErrorState({
  error,
  retry,
  boundary,
  title,
  description,
  detail,
  secondaryAction,
  standalone = false,
}: ErrorStateProps) {
  useEffect(() => {
    // Server Component errors arrive as Errors with a digest that matches
    // the server log entry.
    const digest =
      error instanceof Error &&
      'digest' in error &&
      typeof error.digest === 'string'
        ? error.digest
        : undefined
    // Dynamic import keeps Sentry out of the bundle when it isn't enabled.
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: { digest, ...(boundary && { boundary }) },
        })
      })
      .catch(() => {
        // Sentry not installed or DSN not configured — ignore.
      })
  }, [error, boundary])

  return (
    <StatusPage
      tone="error"
      standalone={standalone}
      eyebrow={appCopy.errorBoundary.eyebrow}
      title={title}
      description={description}
      detail={detail}
      actions={
        <>
          <Button onClick={() => retry()}>{commonCopy.actions.tryAgain}</Button>
          {secondaryAction}
        </>
      }
    />
  )
}
