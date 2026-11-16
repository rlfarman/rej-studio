'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      standalone
      error={error}
      reset={reset}
      title={appCopy.errorBoundary.title}
      description={appCopy.errorBoundary.description}
      detail={appCopy.errorBoundary.reassurance}
      secondaryAction={
        <Button asChild variant="outline">
          <Link href="/">{commonCopy.actions.goHome}</Link>
        </Button>
      }
    />
  )
}
