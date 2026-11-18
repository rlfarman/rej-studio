import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'

import { StatusPage } from '@/components/status-page'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

/** The 404 page, in the page slot with the sidebar and header around it. */
export function NotFoundPage() {
  const router = useRouter()
  // Only back within the app: someone who arrived from a pasted link would
  // otherwise be sent off the site, wherever they came from.
  const canGoBack = useCanGoBack()
  return (
    <StatusPage
      eyebrow={appCopy.notFound.eyebrow}
      title={appCopy.notFound.title}
      description={appCopy.notFound.detail}
      actions={
        <>
          <Button size="lg" nativeButton={false} render={<Link to="/" />}>
            {commonCopy.actions.goHome}
          </Button>
          {canGoBack && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.history.back()}
            >
              {commonCopy.actions.goBack}
            </Button>
          )}
        </>
      }
    />
  )
}
