import { noop, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { z } from 'zod'

import { SpeciesIcon } from '@/components/bio/species-icon'
import { PageTitle } from '@/components/page-title'
import { TrackOnMount } from '@/components/track-on-mount'
import { Badge } from '@/components/ui/badge'
import { appCopy } from '@/copy/app'
import {
  associationsQuery,
  findBySymbol,
} from '@/features/disease-associations/api/associations'
import { GenePhenotypes } from '@/features/disease-associations/components/gene-phenotypes'
import { geneSearchCopy } from '@/features/gene-search/copy'
import { FavoriteGeneButton } from '@/features/gene-search/components/favorite-gene-button'
import { IsoformIdentityMatrix } from '@/features/gene-search/components/isoform-identity-matrix'
import { IsoformLengthChart } from '@/features/gene-search/components/isoform-length-chart'
import { IsoformSummary } from '@/features/gene-search/components/isoform-summary'
import IsoformTable from '@/features/gene-search/components/isoform-table'
import { geneBySymbolQuery } from '@/features/gene-search/corpus/queries'
import { ISOFORM_SORT_KEYS } from '@/features/gene-search/utils/isoform-sort'
import {
  SPECIES_DISPLAY_NAME,
  isSpecies,
  speciesFilterSchema,
} from '@/lib/bio/species'
import { GeneLoading } from '../-components/genes/gene-loading'
import { GeneNotFound } from '../-components/genes/gene-not-found'
import { SearchError } from '../-components/genes/search-error'
import { searchOneOf, searchText } from '../-components/search-params'

const searchSchema = z.object({
  species: speciesFilterSchema.optional().catch(undefined),
  /** The isoform to open and highlight (from search, a chart, a link). */
  isoform: searchText,
  /** The isoform table's sort; see utils/isoform-sort.ts. */
  sort: searchOneOf(ISOFORM_SORT_KEYS),
  dir: searchOneOf(['asc', 'desc']),
})

export const Route = createFileRoute('/genes/$symbol')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ species: search.species }),
  loader: async ({
    context: { queryClient },
    params: { symbol },
    deps: { species },
  }) => {
    // Disease associations are human-only. They load alongside the gene
    // (unless the URL already says mouse), so a human gene page doesn't
    // wait for them afterwards; a mouse gene leaves them in the cache.
    const associations =
      species === 'mouse'
        ? null
        : queryClient.ensureQueryData(associationsQuery)
    // Phenotypes are extra: the gene page shows without them.
    associations?.catch(noop)

    const data = await queryClient.ensureQueryData(
      geneBySymbolQuery(symbol, species),
    )
    if (!data) throw notFound()
    // Symbols are looked up case-insensitively, so /genes/tp53 finds TP53;
    // any other casing redirects to the canonical one, so there's a single
    // address per gene (bookmarks, favorites, recents).
    if (data.gene.symbol !== symbol) {
      throw redirect({
        to: '/genes/$symbol',
        params: { symbol: data.gene.symbol },
        search: true,
        replace: true,
      })
    }
    if (data.gene.species === 'human') await associations?.catch(noop)
    return { name: data.gene.name }
  },
  head: ({ params, loaderData }) => ({
    meta: [
      { title: appCopy.metadata.title(params.symbol) },
      {
        name: 'description',
        content: geneSearchCopy.genePage.metadataDescription(
          loaderData?.name ?? params.symbol,
        ),
      },
    ],
  }),
  component: GenePage,
  pendingComponent: GeneLoading,
  errorComponent: SearchError,
  notFoundComponent: GeneNotFoundPage,
})

function GeneNotFoundPage() {
  const { symbol } = Route.useParams()
  return <GeneNotFound symbol={symbol} />
}

function GenePage() {
  const { symbol } = Route.useParams()
  const { species, isoform: highlightedIsoformId } = Route.useSearch()
  const { data } = useSuspenseQuery(geneBySymbolQuery(symbol, species))
  // Associations are human-only; key by symbol since a gene may resolve to
  // mouse and mouse Ensembl IDs (ENSMUSG...) never match human data.
  const isHuman = data?.gene.species === 'human'
  const { data: associations } = useQuery({
    ...associationsQuery,
    enabled: isHuman,
  })
  // The loader has thrown notFound() for a missing gene.
  if (!data) return null

  const { gene, isoforms } = data
  const associationRow =
    isHuman && associations
      ? findBySymbol(associations, gene.symbol)
      : undefined

  return (
    <div className="flex flex-col gap-5 pt-6 md:pt-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <PageTitle>{gene.symbol}</PageTitle>
          <FavoriteGeneButton gene={gene} />
        </div>
        <p className="text-sm text-muted-foreground md:text-base">
          {gene.name}
        </p>
        <div className="flex items-center gap-3">
          {/* py-1/-my-1 grows the tap target to 24px without moving the row. */}
          <a
            href={`https://ensembl.org/id/${gene.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-my-1 inline-flex min-h-6 items-center gap-1.5 rounded-sm py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {gene.id}
            <ExternalLink className="size-3" />
          </a>
          {isSpecies(gene.species) && (
            <>
              <span className="text-border">·</span>
              <Badge
                variant="secondary"
                className="inline-flex items-center gap-1.5 text-xs"
              >
                <SpeciesIcon species={gene.species} className="size-3.5" />
                {SPECIES_DISPLAY_NAME[gene.species]}
              </Badge>
            </>
          )}
        </div>
      </header>
      <TrackOnMount
        key={gene.id}
        event={{
          event: 'isoform_view',
          gene_symbol: gene.symbol,
          gene_id: gene.id,
          isoform_count: isoforms.length,
        }}
      />
      <div className="flex flex-col gap-3">
        <IsoformSummary geneSymbol={gene.symbol} isoforms={isoforms} />
        <IsoformTable
          // A different gene starts with its own expanded rows.
          key={gene.id}
          isoforms={isoforms}
          highlightedIsoformId={highlightedIsoformId}
        />
      </div>
      {associationRow && <GenePhenotypes row={associationRow} />}
      <div className="mt-6 flex min-w-0 flex-col gap-10">
        <IsoformLengthChart isoforms={isoforms} />
        {/* The matrix grows with isoform count; scroll it rather than let
            it widen the page on small screens. */}
        <div className="min-w-0 overflow-x-auto">
          <IsoformIdentityMatrix isoforms={isoforms} />
        </div>
      </div>
    </div>
  )
}
