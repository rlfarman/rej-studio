import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'

/** The design tool's own boundary: it points back to search, not home. */
export function DesignToolError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <ErrorState
      error={error}
      retry={() => void router.invalidate()}
      boundary="design-tool"
      title={appCopy.errorBoundary.designTool.title}
      description={appCopy.errorBoundary.designTool.description}
      secondaryAction={
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link to="/genes" />}
        >
          {appCopy.errorBoundary.designTool.backToSearch}
        </Button>
      }
    />
  )
}
