import { useEffect, type ReactNode } from 'react'

import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'
import { createLogger } from '@/lib/logger'

const log = createLogger('error-boundary')

interface ErrorStateProps {
  /** Whatever was thrown; client components can throw non-Error values. */
  error: unknown
  /** Resets the boundary and renders it again. */
  retry: () => void
  /** Which error boundary caught it, for the log (and Sentry, at cutover). */
  boundary?: string
  title: string
  description: string
  detail?: string
  /** Secondary action shown next to "Try again". */
  secondaryAction?: ReactNode
  standalone?: boolean
}

/**
 * Error-boundary UI shared by every error boundary: logs the error (Sentry
 * comes back at cutover), then renders the common status layout with a
 * retry action.
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
    // TODO(cutover): report to Sentry for TanStack Start (@sentry/tanstackstart-react)
    // here, tagged with `boundary`, once the DSN is configured on Cloudflare.
    // Until then the error only reaches the browser console.
    log.error('error boundary caught an error', error, {
      ...(boundary && { boundary }),
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
