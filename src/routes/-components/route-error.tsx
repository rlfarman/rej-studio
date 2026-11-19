import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

/**
 * Error boundary UI. `standalone` for the root route, where the layout itself
 * failed; otherwise it fills the page slot and the sidebar and header stay.
 */
export function RouteError({
  error,
  standalone = false,
}: ErrorComponentProps & { standalone?: boolean }) {
  const router = useRouter()
  return (
    <ErrorState
      standalone={standalone}
      error={error}
      boundary={standalone ? 'root' : 'page'}
      // Resets the boundary and re-runs the matched routes' loaders.
      retry={() => void router.invalidate()}
      title={appCopy.errorBoundary.title}
      description={appCopy.errorBoundary.description}
      detail={appCopy.errorBoundary.reassurance}
      secondaryAction={
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link to="/" />}
        >
          {commonCopy.actions.goHome}
        </Button>
      }
    />
  )
}
