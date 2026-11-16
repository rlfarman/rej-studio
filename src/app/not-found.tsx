'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <StatusPage
      standalone
      eyebrow={appCopy.notFound.eyebrow}
      title={appCopy.notFound.description}
      description={appCopy.notFound.detail}
      actions={
        <>
          <Button nativeButton={false} render={<Link href="/" />}>
            {commonCopy.actions.goHome}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            {commonCopy.actions.goBack}
          </Button>
        </>
      }
    />
  )
}
