import Link from 'next/link'
import { Metadata } from 'next'
import { Suspense } from 'react'
import {
  GeneSearchResults,
  GeneSearchResultsLoading,
} from '@/features/gene-search/components/gene-search-results'
import { GeneSearchPageForm } from '@/features/gene-search/components/gene-search-page-form'
import { searchPageHref } from '@/features/gene-search/utils/search-href'
import { geneSearchCopy } from '@/features/gene-search/copy'
import { PageTitle } from '@/components/page-title'
import { isSpeciesFilter } from '@/lib/bio/species'
import type { SpeciesFilter } from '@/lib/bio/species'

const copy = geneSearchCopy.searchPage

export const metadata: Metadata = {
  title: copy.metadataTitle,
  description: copy.metadataDescription,
  alternates: { canonical: '/genes' },
  openGraph: {
    title: copy.metadataTitle,
    description: copy.ogDescription,
    url: '/genes',
    images: [
      {
        url: '/api/og?title=Search+by+symbol%2C%0Aname%2C+or+alias&section=Gene+Search&description=Human+%26+Mouse+%C2%B7+Full-text+search+%C2%B7+Pre-optimized+sequences&url=rejstudio.com/genes',
        width: 1200,
        height: 630,
        alt: copy.ogImageAlt,
      },
    ],
  },
}

/**
 * One search box, one results list. The list is server-rendered from the
 * URL, so results are shareable and the page works before hydration.
 */
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

// The query comes from the URL (request-time data), so it's read inside
// Suspense: the page shell prerenders and navigations stay instant.
export default function GeneSearchPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<GeneSearchPageShell />}>
      <GeneSearchPageContent searchParams={searchParams} />
    </Suspense>
  )
}

function GeneSearchPageShell() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <PageTitle as="h1" className="text-balance">
        {copy.title}
      </PageTitle>
      <GeneSearchPageForm query="" species="both" />
    </div>
  )
}

async function GeneSearchPageContent({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim() : ''
  const speciesParam =
    typeof params.species === 'string' ? params.species : 'both'
  const species: SpeciesFilter = isSpeciesFilter(speciesParam)
    ? speciesParam
    : 'both'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
      <PageTitle as="h1" className="text-balance">
        {query ? copy.resultsTitle(query) : copy.title}
      </PageTitle>
      <GeneSearchPageForm query={query} species={species} />
      {query ? (
        <Suspense
          key={`${query}-${species}`}
          fallback={<GeneSearchResultsLoading />}
        >
          <GeneSearchResults query={query} species={species} />
        </Suspense>
      ) : (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1">{geneSearchCopy.command.examplesLabel}</span>
          {geneSearchCopy.exampleGenes.map((symbol) => (
            <Link
              key={symbol}
              href={searchPageHref(symbol, species)}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring text-foreground rounded-full border px-3 py-1 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {symbol}
            </Link>
          ))}
        </p>
      )}
    </div>
  )
}
