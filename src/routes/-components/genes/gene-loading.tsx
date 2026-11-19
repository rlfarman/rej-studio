import { Skeleton } from '@/components/ui/skeleton'
import { appCopy } from '@/copy/app'

const SKELETON_ROWS = 6

/**
 * Shown while a gene page's data loads: the page's header and isoform table
 * as Skeletons, like the design tool's and disease table's fallbacks, so the
 * page fills in where it will appear rather than replacing a spinner. Same
 * top padding as the gene page itself.
 */
export function GeneLoading() {
  return (
    <div
      role="status"
      aria-label={appCopy.loading.geneAria}
      className="flex flex-col gap-5 pt-6 md:pt-10"
    >
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-9 w-32 md:h-10" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div aria-hidden className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
