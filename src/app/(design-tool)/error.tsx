'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

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
            Design tool error
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6 text-sm">
            Something went wrong loading the design tool. Your work has not been
            lost.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => reset()}>Try Again</Button>
            <Link href="/genes">
              <Button variant="outline">Back to Search</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
