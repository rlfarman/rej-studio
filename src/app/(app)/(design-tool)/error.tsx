'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function DesignToolError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: { digest: error.digest, boundary: 'design-tool' },
        })
      })
      .catch(() => {})
  }, [error])

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl font-bold">
            {appCopy.errorBoundary.designTool.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6 text-sm">
            {appCopy.errorBoundary.designTool.description}
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => reset()}>
              {commonCopy.actions.tryAgain}
            </Button>
            <Link href="/genes">
              <Button variant="outline">
                {appCopy.errorBoundary.designTool.backToSearch}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
