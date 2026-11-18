import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PageTitle } from '@/components/page-title'
import { appCopy } from '@/copy/app'
import { geneSearchCopy } from '@/features/gene-search/copy'
import { GeneSearchPageForm } from '@/features/gene-search/components/gene-search-page-form'
import { GeneSearchResults } from '@/features/gene-search/components/gene-search-results'
import { geneSearchPageQuery } from '@/features/gene-search/corpus/queries'
import { searchPageLink } from '@/features/gene-search/utils/search-href'
import { speciesFilterSchema } from '@/lib/bio/species'
import { SearchError } from '../-components/genes/search-error'
import { searchText } from '../-components/search-params'

const copy = geneSearchCopy.searchPage

const searchSchema = z.object({
  q: searchText,
  species: speciesFilterSchema.optional().catch(undefined),
})

/**
 * One search box, one results list, both driven by the URL so results are
 * shareable and back/forward work.
 */
export const Route = createFileRoute('/genes/')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    query: search.q?.trim() ?? '',
    species: search.species ?? 'both',
  }),
  // Starts the search but deliberately does not wait for it. Searching runs
  // against the ~1 MB gene index, so returning the prefetch kept the route
  // pending for as long as the index took to download — no title, no search
  // box, no species filter, just a spinner. The results list renders its own
  // "Searching…" in place instead, and reports a failure with a retry.
  loader: ({ context: { queryClient }, deps: { query, species } }) => {
    if (query) {
      void queryClient.prefetchQuery(geneSearchPageQuery(query, species))
    }
  },
  head: () => ({
    meta: [
      { title: appCopy.metadata.title(copy.metadataTitle) },
      { name: 'description', content: copy.metadataDescription },
    ],
  }),
  component: GeneSearchPage,
  errorComponent: SearchError,
})

function GeneSearchPage() {
  const { query, species } = Route.useLoaderDeps()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <PageTitle as="h1" className="text-balance">
        {query ? copy.resultsTitle(query) : copy.title}
      </PageTitle>
      <GeneSearchPageForm query={query} species={species} />
      {query ? (
        <GeneSearchResults query={query} species={species} />
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="mr-1">{geneSearchCopy.command.examplesLabel}</span>
          {geneSearchCopy.exampleGenes.map((symbol) => (
            <Link
              key={symbol}
              {...searchPageLink(symbol, species)}
              className="rounded-full border px-3 py-1 font-mono text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {symbol}
            </Link>
          ))}
        </p>
      )}
    </div>
  )
}
