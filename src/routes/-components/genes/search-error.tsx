import {
  Link,
  useParams,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

/**
 * Whether this looks like the gene data failing to arrive rather than a bug
 * in the page. The corpus reader throws `Gene data <path>: HTTP <status>`,
 * and a blocked or dropped request throws the browser's own fetch error,
 * whose wording differs per engine.
 */
function looksLikeLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return /Gene data .*: HTTP|fetch|NetworkError|Load failed/i.test(message)
}

/** Error boundary for the gene pages (/genes and /genes/$symbol). */
export function SearchError({ error }: ErrorComponentProps) {
  const router = useRouter()
  // This one boundary covers the search page and every gene page; only the
  // latter has a symbol, and only there does "Search unavailable" describe
  // the wrong thing.
  const { symbol } = useParams({ strict: false })
  const copy = symbol
    ? {
        title: appCopy.errorBoundary.gene.title(symbol),
        description: appCopy.errorBoundary.gene.description,
      }
    : appCopy.errorBoundary.search

  return (
    <ErrorState
      error={error}
      // Resets the boundary and re-runs the page's loader.
      retry={() => void router.invalidate()}
      boundary="search"
      eyebrow={
        looksLikeLoadFailure(error)
          ? appCopy.errorBoundary.connectionEyebrow
          : undefined
      }
      title={copy.title}
      description={copy.description}
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
