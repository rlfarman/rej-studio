'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function ErrorPage({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="mb-4 text-lg">An unexpected error has occurred.</p>
            <Button onClick={() => reset()} className="mr-2">
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
