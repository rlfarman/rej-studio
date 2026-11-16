import { useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { GeneSearchResult } from '@/features/gene-search/types/search'
import {
  SEARCH_LIMITS,
  type SearchGenesResult,
  type SimilarGene,
} from '@/features/gene-search/types/search'
import type { SpeciesFilter } from '@/lib/bio/species'
import { useSpeciesContext } from '@/stores/species-store'
import { trackEvent } from '@/lib/analytics'
import { geneSearchCopy } from '../copy'
import { searchCorpus } from '../corpus/client'
import { getBrowserCorpus } from '../corpus/gene-data-url'

interface UseGeneSearchProps {
  defaultQuery?: string
}

/** A search response, or the message for an expected failure (4xx/5xx). */
type GeneSearchData = SearchGenesResult & { error: string | null }

const EMPTY_RESULTS: GeneSearchResult[] = []
const EMPTY_SUGGESTIONS: SimilarGene[] = []

/**
 * Run one palette search. Over the API (Postgres backend), `signal` comes from TanStack Query, which aborts
 * the request when the query key changes, so a stale keystroke's search
 * stops instead of queueing ahead of the current one. Expected failures
 * (rate limit, signed out, backend down) resolve with their message; only
 * network failures throw.
 */
async function fetchGeneSearch(
  query: string,
  species: SpeciesFilter,
  signal: AbortSignal,
): Promise<GeneSearchData> {
  // With a static corpus the search runs right here, against an index
  // downloaded once; no request per keystroke, so nothing to rate-limit.
  // A failure to fetch the index throws, which reads as a network error.
  const corpus = getBrowserCorpus()
  if (corpus) {
    const result = await searchCorpus(corpus, {
      q: query,
      species,
      limit: SEARCH_LIMITS.palette,
    })
    return { ...result, error: null }
  }

  const params = new URLSearchParams({
    q: query,
    species,
    limit: String(SEARCH_LIMITS.palette),
  })
  const res = await fetch(`/api/genes/search?${params}`, {
    signal,
    headers: { accept: 'application/json' },
  })
  const body: unknown = await res.json().catch(() => null)

  if (res.ok && body) return { ...(body as SearchGenesResult), error: null }

  const message =
    body && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : geneSearchCopy.searchErrors.network
  return { results: [], truncated: false, suggestions: [], error: message }
}

export function useGeneSearch({ defaultQuery }: UseGeneSearchProps = {}) {
  const queryClient = useQueryClient()
  const [query, setQueryState] = useState(defaultQuery ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(defaultQuery ?? '')
  const debounce = useDebouncedCallback(setDebouncedQuery, 250)
  const { species } = useSpeciesContext()

  const setQuery = (next: string) => {
    setQueryState(next)
    debounce(next)
  }

  // For a picked value (an example gene) there are no further keystrokes to
  // wait for, so skip the debounce and search right away.
  const searchNow = (next: string) => {
    debounce.cancel()
    setQueryState(next)
    setDebouncedQuery(next)
  }

  const trimmed = debouncedQuery.trim()
  const enabled = trimmed.length > 0
  const queryKey = ['gene-search', trimmed, species] as const

  const { data, isFetching, isError, isPlaceholderData } = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchGeneSearch(trimmed, species, signal),
    enabled,
    // A failed search shouldn't be served from cache when the user comes
    // back to the same query; results are good for 30s.
    staleTime: (q) => (q.state.data?.error ? 0 : 30_000),
    // Keep the previous query's results mounted while a new query loads, so
    // the list doesn't blank out between keystrokes. Pairs with a delayed
    // inline loader in the input to avoid flash-of-loading on fast queries.
    placeholderData: keepPreviousData,
  })

  // Track completed searches (fires once per unique query+species+results).
  const lastTrackedQuery = useRef('')
  useEffect(() => {
    if (!data || data.error || !trimmed) return
    if (trimmed === lastTrackedQuery.current) return
    lastTrackedQuery.current = trimmed
    trackEvent({
      event: 'gene_search',
      query: trimmed,
      species,
      result_count: data.results.length,
    })
  }, [data, trimmed, species])

  // Distinguish between: network error (isError), an expected server-side
  // failure (data.error), and genuine empty results (data.results empty).
  const error = isError
    ? geneSearchCopy.searchErrors.network
    : (data?.error ?? null)

  // Fire and forget: a failed refetch surfaces through the query's isError,
  // read above, and invalidateQueries does not reject unless asked to
  // (throwOnError).
  const retry = () => {
    void queryClient.invalidateQueries({ queryKey })
  }

  const pendingQuery = query.trim()

  return {
    query,
    setQuery,
    searchNow,
    // True once the current query has its own results — not the previous
    // query's, which `keepPreviousData` keeps on screen while it loads.
    hasSearched: enabled && data !== undefined && !isPlaceholderData,
    searchResults: data?.results ?? EMPTY_RESULTS,
    truncated: data?.truncated ?? false,
    suggestions: data?.suggestions ?? EMPTY_SUGGESTIONS,
    // Covers the debounce window too, so the UI can show "Searching…" the
    // moment the user types instead of after the request starts.
    isLoading:
      pendingQuery.length > 0 && (pendingQuery !== trimmed || isFetching),
    error,
    retry,
  }
}
