'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function SearchError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      boundary="search"
      title={appCopy.errorBoundary.search.title}
      description={appCopy.errorBoundary.search.description}
      secondaryAction={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          {commonCopy.actions.goHome}
        </Button>
      }
    />
  )
}
