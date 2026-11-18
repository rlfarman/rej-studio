import { Link, useRouter } from '@tanstack/react-router'

import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

/** The 404 page, in the page slot with the sidebar and header around it. */
export function NotFoundPage() {
  const router = useRouter()
  return (
    <StatusPage
      eyebrow={appCopy.notFound.eyebrow}
      title={appCopy.notFound.description}
      description={appCopy.notFound.detail}
      actions={
        <>
          <Button size="lg" nativeButton={false} render={<Link to="/" />}>
            {commonCopy.actions.goHome}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.history.back()}
          >
            {commonCopy.actions.goBack}
          </Button>
        </>
      }
    />
  )
}
