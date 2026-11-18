import { useEffect, useSyncExternalStore } from 'react'

import { prefetchGeneIndex } from '../api/search-worker-client'

/*
 * Whether the gene index is in memory, shared by every palette on the page
 * (the header's and the home page's) because the download is shared too.
 * One flag, set once, so a search typed before the index lands can say what
 * it is waiting for instead of showing a bare spinner.
 */
let indexReady = false
const readyListeners = new Set<() => void>()

function markIndexReady() {
  if (indexReady) return
  indexReady = true
  for (const listener of readyListeners) listener()
}

function subscribeReady(listener: () => void) {
  readyListeners.add(listener)
  return () => readyListeners.delete(listener)
}

/**
 * True once the index has finished downloading and indexing in this session.
 * False means "not yet", not "never": a failed load leaves it false and the
 * search itself reports the failure.
 */
export function useGeneIndexReady(): boolean {
  return useSyncExternalStore(
    subscribeReady,
    () => indexReady,
    () => false,
  )
}

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
        prefetchGeneIndex()
          .then(markIndexReady)
          .catch(() => {
            // The search reports it, when there is one.
          })
      }),
    [],
  )
}
