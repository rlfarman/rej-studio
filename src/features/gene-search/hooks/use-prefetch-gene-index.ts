import { useEffect } from 'react'

import { prefetchGeneIndex } from '../api/search-worker-client'

/** Runs `task` when the browser is idle, or soon if it has no idle callback. */
function whenIdle(task: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(task, { timeout: 3_000 })
    return () => cancelIdleCallback(handle)
  }
  const handle = setTimeout(task, 200)
  return () => clearTimeout(handle)
}

/**
 * Starts the gene index download once the page is idle, so it is usually
 * there before the first search rather than fetched by it.
 *
 * The full index is ~1 MB compressed and took seconds on a cold fetch; a
 * search typed before it arrived waited for all of it. The search worker
 * downloads, parses and indexes it (../workers/search.worker.ts), so none of
 * that work lands on the main thread.
 *
 * Failures are left for the search itself to report: a prefetch that fails
 * is forgotten (GeneCorpus drops a failed load), and the next search tries
 * again.
 */
export function usePrefetchGeneIndex() {
  useEffect(
    () =>
      whenIdle(() => {
        prefetchGeneIndex().catch(() => {
          // The search reports it, when there is one.
        })
      }),
    [],
  )
}
