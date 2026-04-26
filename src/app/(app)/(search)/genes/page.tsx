import { GeneSearchShell } from '@/app/_components/gene-search-shell'
import { GeneSearchResults } from '@/features/gene-search/components/gene-search-results'
import { isSpeciesFilter } from '@/lib/bio/species'
import type { SpeciesFilter } from '@/lib/bio/species'
import { Metadata } from 'next'

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

  const trimmedQuery = query.trim()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <h1 className="sr-only">Search genes</h1>
      <GeneSearchShell defaultQuery={query} />
      {trimmedQuery.length > 0 && (
        <GeneSearchResults query={query} species={species} />
      )}
    </div>
  )
}
