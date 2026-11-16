'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <ErrorState
      standalone
      error={error}
      retry={retry}
      title={appCopy.errorBoundary.title}
      description={appCopy.errorBoundary.description}
      detail={appCopy.errorBoundary.reassurance}
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
