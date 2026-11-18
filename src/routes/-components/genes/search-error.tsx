import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

/** Error boundary for the gene pages (/genes and /genes/$symbol). */
export function SearchError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <ErrorState
      error={error}
      // Resets the boundary and re-runs the page's loader.
      retry={() => void router.invalidate()}
      boundary="search"
      title={appCopy.errorBoundary.search.title}
      description={appCopy.errorBoundary.search.description}
      secondaryAction={
        <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
          {commonCopy.actions.goHome}
        </Button>
      }
    />
  )
}
