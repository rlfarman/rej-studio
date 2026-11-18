import { describe, expect, it, vi } from 'vite-plus/test'

import { Route } from './index'

/**
 * The route loader must not make the page wait for the search. Searching
 * downloads the ~1 MB gene index, and a loader that returns that promise
 * keeps the whole route pending: no title, no search box, no species
 * filter, for as long as the index takes.
 */

type LoaderContext = {
  context: {
    queryClient: { prefetchQuery: (options: unknown) => Promise<unknown> }
  }
  deps: { query: string; species: string }
}

const loader = Route.options.loader as unknown as (
  context: LoaderContext,
) => unknown

function run(
  query: string,
  prefetchQuery: LoaderContext['context']['queryClient']['prefetchQuery'],
) {
  return loader({
    context: { queryClient: { prefetchQuery } },
    deps: { query, species: 'both' },
  })
}

describe('/genes loader', () => {
  it('starts the search but does not wait for it', () => {
    // A search that never settles: the loader must still be done.
    const prefetchQuery = vi.fn(() => new Promise<unknown>(() => {}))

    const result = run('kras', prefetchQuery)

    expect(prefetchQuery).toHaveBeenCalledTimes(1)
    expect(result).toBeUndefined()
  })

  it('does not search for an empty query', () => {
    const prefetchQuery = vi.fn(() => Promise.resolve(null))

    expect(run('', prefetchQuery)).toBeUndefined()
    expect(prefetchQuery).not.toHaveBeenCalled()
  })
})
