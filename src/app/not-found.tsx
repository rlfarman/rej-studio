'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { appCopy } from '@/lib/copy'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center font-mono text-5xl font-bold tracking-tight">
            {appCopy.notFound.status}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-muted-foreground mb-1 text-lg">
              {appCopy.notFound.message}
            </p>
            <p className="text-muted-foreground mb-6 text-sm">
              {appCopy.notFound.subtext}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => router.back()}>
                {appCopy.notFound.goBack}
              </Button>
              <Link href="/">
                <Button variant="outline">{appCopy.notFound.goHome}</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
