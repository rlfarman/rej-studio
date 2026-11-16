'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'

export default function DesignToolError({
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
