import { DnaLoader } from '@/components/bio/dna-loader'
import { appCopy } from '@/copy/app'

/**
 * Fallback for the page slot of the app shell, shown while a page that
 * reads request data outside its own Suspense boundaries streams in. The
 * sidebar and header around it stay in the static shell.
 */
export function PageLoading() {
  return (
    <div
      role="status"
      aria-label={appCopy.loading.page}
      className="flex min-h-[50vh] items-center justify-center"
    >
      <DnaLoader className="h-10 w-[120px]" />
    </div>
  )
}
