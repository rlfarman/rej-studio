import { useEffect, type ReactNode } from 'react'

import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { createLogger } from '@/lib/logger'
import { reportError } from '@/lib/sentry'

const log = createLogger('error-boundary')

interface ErrorStateProps {
  /** Whatever was thrown; client components can throw non-Error values. */
  error: unknown
  /** Resets the boundary and renders it again. */
  retry: () => void
  /** Which error boundary caught it, for the log and Sentry. */
  boundary?: string
  /**
   * Small label above the title. Defaults to "Unexpected error"; a boundary
   * that can tell a load failure from a bug says so instead.
   */
  eyebrow?: string
  title: string
  description: string
  detail?: string
  /** Secondary action shown next to "Try again". */
  secondaryAction?: ReactNode
  standalone?: boolean
}

/**
 * Error-boundary UI shared by every error boundary: logs the error and
 * reports it to Sentry, then renders the common status layout with a retry
 * action.
 */
export function ErrorState({
  error,
  retry,
  boundary,
  eyebrow = appCopy.errorBoundary.eyebrow,
  title,
  description,
  detail,
  secondaryAction,
  standalone = false,
}: ErrorStateProps) {
  useEffect(() => {
    log.error('error boundary caught an error', error, {
      ...(boundary && { boundary }),
    })
    // A no-op without VITE_SENTRY_DSN, so local dev and CI stay silent.
    reportError(error, boundary ? { boundary } : undefined)
  }, [error, boundary])

  return (
    <StatusPage
      tone="error"
      standalone={standalone}
      eyebrow={eyebrow}
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
