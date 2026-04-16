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
import { geneSearchCopy } from '@/features/gene-search/copy'
import { ogImageUrl } from '@/lib/og'

export const metadata: Metadata = {
  title: geneSearchCopy.metadata.title,
  description: geneSearchCopy.metadata.description,
  alternates: { canonical: '/genes' },
  openGraph: {
    title: geneSearchCopy.metadata.title,
    description: geneSearchCopy.metadata.ogDescription,
    url: '/genes',
    images: [
      {
        url: ogImageUrl({
          title: 'Search by symbol,\nname, or disease',
          section: 'Gene Search',
          description:
            'Human & Mouse · Full-text search · Pre-optimized sequences',
          url: 'rejstudio.com/genes',
        }),
        width: 1200,
        height: 630,
        alt: 'Gene Search — REJ Studio',
      },
    ],
  },
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
