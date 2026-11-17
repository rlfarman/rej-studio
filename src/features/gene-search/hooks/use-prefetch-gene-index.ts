import { useEffect } from 'react'

import { getBrowserCorpus } from '../corpus/gene-data-url'

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
 * search typed before it arrived waited for all of it. Once it is in, the
 * full-text postings are built in a second idle slot: that is ~200 ms of
 * main-thread work the first full-text search would otherwise do while the
 * person types.
 *
 * Failures are left for the search itself to report: a prefetch that fails
 * is forgotten (GeneCorpus drops a failed load), and the next search tries
 * again.
 */
export function usePrefetchGeneIndex() {
  useEffect(() => {
    let cancelWarm: (() => void) | undefined
    const cancelLoad = whenIdle(() => {
      getBrowserCorpus()
        .loadIndex()
        .then((index) => {
          cancelWarm = whenIdle(() => index.warm())
        })
        .catch(() => {
          // The search reports it, when there is one.
        })
    })
    return () => {
      cancelLoad()
      cancelWarm?.()
    }
  }, [])
}
