import { searchGenes } from '@/features/gene-search/api/genes'
import { GeneSearchShell } from '@/app/_components/gene-search-shell'
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
  openGraph: {
    title: 'Search Genes',
    description:
      'Search by gene symbol, name, or disease across human and mouse genomes.',
    url: '/genes',
    images: [
      {
        url: '/api/og?title=Search+by+symbol%2C%0Aname%2C+or+disease&section=Gene+Search&description=Human+%26+Mouse+%C2%B7+Full-text+search+%C2%B7+Pre-optimized+sequences&url=rejstudio.com/genes',
        width: 1200,
        height: 630,
        alt: 'Gene Search — REJ Studio',
      },
    ],
  },
}

type GeneSearchParams = Promise<{
  [key: string]: string | string[] | undefined
}>

// Params read in a Suspense-wrapped child so the landing shell (the search
// input + empty state) prerenders as static HTML. Every visit without a `?q=`
// hits the CDN; only querying pays the server round-trip.
async function GeneSearchBody({
  searchParams,
}: {
  searchParams: GeneSearchParams
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
      <GeneSearchShell searchGenes={searchGenes} defaultQuery={query} />
      {trimmedQuery.length > 0 && (
        <Suspense
          key={`${query}-${species}`}
          fallback={<GeneSearchResultsLoading />}
        >
          <GeneSearchResults query={query} species={species} />
        </Suspense>
      )}
    </HydrationBoundary>
  )
}

export default function GeneSearchPage({
  searchParams,
}: {
  searchParams: GeneSearchParams
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <h1 className="sr-only">Search genes</h1>
      <Suspense fallback={<GeneSearchShell searchGenes={searchGenes} />}>
        <GeneSearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
