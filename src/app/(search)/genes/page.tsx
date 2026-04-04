import { searchGenes } from '@/features/gene-search/api/genes'
import { GeneSearch } from '@/features/gene-search/components/gene-search'
import {
  GeneSearchResults,
  GeneSearchResultsLoading,
} from '@/features/gene-search/components/gene-search-results'
import { isSpeciesFilter } from '@/lib/species'
import type { SpeciesFilter } from '@/lib/species'
import { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Search Genes | REJ Studio',
  description: 'Search for genes to optimize with the REJ Studio design tool.',
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

  return (
    <div className="flex flex-col gap-4">
      <GeneSearch searchGenes={searchGenes} defaultQuery={query} />
      {query.trim().length > 0 && (
        <Suspense
          key={`${query}-${species}`}
          fallback={<GeneSearchResultsLoading />}
        >
          <GeneSearchResults query={query} species={species} />
        </Suspense>
      )}
    </div>
  )
}
