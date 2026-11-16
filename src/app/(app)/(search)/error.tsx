'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      boundary="search"
      title={appCopy.errorBoundary.search.title}
      description={appCopy.errorBoundary.search.description}
      secondaryAction={
        <Button asChild variant="outline">
          <Link href="/">{commonCopy.actions.goHome}</Link>
        </Button>
      }
    />
  )
}
