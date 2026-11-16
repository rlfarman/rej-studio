'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'

export default function DesignToolError({
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
      boundary="design-tool"
      title={appCopy.errorBoundary.designTool.title}
      description={appCopy.errorBoundary.designTool.description}
      secondaryAction={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/genes" />}
        >
          {appCopy.errorBoundary.designTool.backToSearch}
        </Button>
      }
    />
  )
}
