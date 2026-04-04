'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center font-mono text-5xl font-bold tracking-tight">
            404
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-muted-foreground mb-1 text-lg">
              This sequence doesn&apos;t map to anything.
            </p>
            <p className="text-muted-foreground mb-6 text-sm">
              The page you&apos;re looking for may have been spliced out.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => router.back()}>Go Back</Button>
              <Link href="/">
                <Button variant="outline">Go Home</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
