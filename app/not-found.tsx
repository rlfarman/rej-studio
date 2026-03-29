'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="mb-4 text-lg">Page Not Found</p>
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
