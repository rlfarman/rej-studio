import { downloadBlob } from '@/lib/download-file'
import { toast } from '@/lib/toast'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.isoformTable

/**
 * An isoform's pre-optimized sequence package, served same-origin by the
 * Worker (`src/server/pre-optimized.ts`), which passes it through from the
 * package bucket.
 */
export function preOptimizedZipUrl(isoformId: string) {
  return `/api/pre-optimized/${isoformId}`
}

export function preOptimizedZipFilename(isoformId: string) {
  return `${isoformId}_v1.0.zip`
}

/**
 * Downloads the package, or says why not in a toast.
 *
 * Fetched rather than followed, because a plain link to a missing file
 * would leave the page for an error body; the links keep their `href` for
 * copying and opening elsewhere. The packages are small, so holding one in
 * memory as a blob costs nothing worth streaming around.
 */
export async function downloadPreOptimizedZip(isoformId: string) {
  let blob: Blob
  try {
    const response = await fetch(preOptimizedZipUrl(isoformId))
    if (!response.ok) {
      toast.error(
        response.status === 404
          ? copy.downloadMissing(isoformId)
          : copy.downloadFailed,
      )
      return
    }
    blob = await response.blob()
  } catch {
    toast.error(copy.downloadFailed)
    return
  }
  downloadBlob(preOptimizedZipFilename(isoformId), blob)
}
