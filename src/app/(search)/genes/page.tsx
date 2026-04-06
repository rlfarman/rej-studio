import { searchGenes } from '@/features/gene-search/api/genes'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import {
  GeneSearchResults,
  GeneSearchResultsLoading,
} from '@/features/gene-search/components/gene-search-results'
import { isSpeciesFilter } from '@/lib/bio/species'
import type { SpeciesFilter } from '@/lib/bio/species'
import { Metadata } from 'next'
import { Suspense } from 'react'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'

export const metadata: Metadata = {
  title: 'Search Genes',
  description:
    'Search by gene symbol, name, or disease across human and mouse genomes. Browse isoforms and download optimized sequences.',
  alternates: { canonical: '/genes' },
}

export default async function GeneSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q : ''
  const speciesParam =
    typeof params.species === 'string' ? params.species : 'both'
  const species: SpeciesFilter = isSpeciesFilter(speciesParam)
    ? speciesParam
    : 'both'

  // Prefetch search results on the server so the React Query cache is warm
  // when the client-side useGeneSearch hook hydrates. This means navigating
  // back to the same search query is instant (cache hit, no waterfall).
  const queryClient = new QueryClient()
  const trimmedQuery = query.trim()
  if (trimmedQuery.length > 0) {
    await queryClient.prefetchQuery({
      queryKey: ['gene-search', trimmedQuery, species],
      queryFn: () => searchGenes(trimmedQuery, species),
    })
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-4">
        <GeneSearch searchGenes={searchGenes} defaultQuery={query} />
        {trimmedQuery.length > 0 && (
          <Suspense
            key={`${query}-${species}`}
            fallback={<GeneSearchResultsLoading />}
          >
            <GeneSearchResults query={query} species={species} />
          </Suspense>
        )}
      </div>
    </HydrationBoundary>
  )
}
