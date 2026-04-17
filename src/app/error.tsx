'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to Sentry if configured. Dynamic import keeps the bundle
    // clean when Sentry isn't enabled.
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: { digest: error.digest },
        })
      })
      .catch(() => {
        // Sentry not installed or DSN not configured — ignore.
      })
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {appCopy.errorBoundary.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-muted-foreground mb-1 text-base">
              {appCopy.errorBoundary.description}
            </p>
            <p className="text-muted-foreground mb-6 text-sm">
              {appCopy.errorBoundary.reassurance}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => reset()}>
                {commonCopy.actions.tryAgain}
              </Button>
              <Link href="/">
                <Button variant="outline">{commonCopy.actions.goHome}</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
