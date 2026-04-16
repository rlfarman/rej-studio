'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { geneSearchCopy } from '@/features/gene-search/copy'

const errorCopy = geneSearchCopy.errorBoundary

export default function SearchError({
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
          tags: { digest: error.digest, boundary: 'search' },
        })
      })
      .catch(() => {})
  }, [error])

  return (
    <div className="flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl font-bold">
            {errorCopy.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6 text-sm">
            {errorCopy.message}
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => reset()}>{errorCopy.tryAgain}</Button>
            <Link href="/">
              <Button variant="outline">{errorCopy.goHome}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
