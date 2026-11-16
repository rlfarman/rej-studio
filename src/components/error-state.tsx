'use client'

import { useEffect, type ReactNode } from 'react'

import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

interface ErrorStateProps {
  error: Error & { digest?: string }
  reset: () => void
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
  reset,
  boundary,
  title,
  description,
  detail,
  secondaryAction,
  standalone = false,
}: ErrorStateProps) {
  useEffect(() => {
    // Dynamic import keeps Sentry out of the bundle when it isn't enabled.
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: { digest: error.digest, ...(boundary && { boundary }) },
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
          <Button onClick={() => reset()}>{commonCopy.actions.tryAgain}</Button>
          {secondaryAction}
        </>
      }
    />
  )
}
