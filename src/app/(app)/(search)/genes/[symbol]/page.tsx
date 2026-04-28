import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getGeneBySymbol } from '@/features/gene-search/api/genes'
import { getIsoformsByGene } from '@/features/gene-search/api/isoforms'
import IsoformTable, {
  IsoformTableLoading,
} from '@/features/gene-search/components/isoform-table'
import { IsoformSummary } from '@/features/gene-search/components/isoform-summary'
import { IsoformLengthChart } from '@/features/gene-search/components/isoform-length-chart'
import { IsoformIdentityMatrix } from '@/features/gene-search/components/isoform-identity-matrix'
import { Suspense, ViewTransition } from 'react'
import { FavoriteGeneButton } from '@/features/gene-search/components/favorite-gene-button'
import { GeneJsonLd } from '@/features/gene-search/components/gene-jsonld'
import { GeneBreadcrumbJsonLd } from '@/features/gene-search/components/gene-breadcrumb-jsonld'
import { SpeciesSync } from '@/features/gene-search/components/species-sync'
import { TrackOnMount } from '@/components/track-on-mount'
import { GeneDetailTour } from '@/features/onboarding/components/gene-detail-tour'
import { findBySymbol } from '@/features/disease-associations/api/associations'
import { GenePhenotypes } from '@/features/disease-associations/components/gene-phenotypes'
import type { AssociationRow } from '@/features/disease-associations/types'
import { ExternalLink } from 'lucide-react'
import { SpeciesIcon } from '@/components/bio/species-icon'
import { PageTitle } from '@/components/page-title'
import { Metadata } from 'next'
import { cache } from 'react'
import {
  SPECIES_DISPLAY_NAME,
  isSpecies,
  parseSpeciesParam,
  type Species,
} from '@/lib/bio/species'

type Props = {
  params: Promise<{ symbol: string }>
  searchParams: Promise<{ species?: string; isoform?: string }>
}

const getCachedGeneBySymbol = cache(getGeneBySymbol)

async function resolveGene({ params, searchParams }: Props) {
  const { symbol } = await params
  const { species } = await searchParams
  return getCachedGeneBySymbol(symbol, parseSpeciesParam(species))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { symbol } = await props.params
  const { species } = await props.searchParams
  const gene = await resolveGene(props)

  const displaySymbol = gene?.symbol ?? symbol
  const description = `View all isoforms for ${gene?.name ?? symbol} and download pre-optimized sequences or customize your own.`
  const ogUrl = `/api/og/gene/${encodeURIComponent(displaySymbol)}${species ? `?species=${encodeURIComponent(species)}` : ''}`

  return {
    title: displaySymbol,
    description,
    alternates: {
      canonical: `/genes/${displaySymbol}`,
    },
    openGraph: {
      title: displaySymbol,
      description,
      url: `/genes/${displaySymbol}`,
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `${displaySymbol} — REJ Studio`,
        },
      ],
    },
  }
}

/**
 * Async server component that fetches isoforms and renders the full isoform
 * section. Wrapped in Suspense by the parent so the gene header streams
 * immediately while the DB query resolves.
 */
async function IsoformSection({
  gene,
  highlightedIsoformId,
  associationRow,
}: {
  gene: { id: string; symbol: string; name: string }
  highlightedIsoformId?: string
  associationRow?: AssociationRow
}) {
  const isoforms = await getIsoformsByGene(gene.id)

  const speciesAvailable = [
    ...new Set(isoforms.map((i) => i.species)),
  ] as Species[]

  return (
    <>
      <GeneJsonLd
        gene={gene}
        isoformCount={isoforms.length}
        species={speciesAvailable}
      />
      <TrackOnMount
        event={{
          event: 'isoform_view',
          gene_symbol: gene.symbol,
          gene_id: gene.id,
          isoform_count: isoforms.length,
        }}
      />
      <IsoformSummary isoforms={isoforms} />
      <IsoformTable
        isoforms={isoforms}
        highlightedIsoformId={highlightedIsoformId}
      />
      {associationRow && <GenePhenotypes row={associationRow} />}
      <section className="flex flex-col gap-6">
        <IsoformLengthChart isoforms={isoforms} />
        <IsoformIdentityMatrix isoforms={isoforms} />
      </section>
    </>
  )
}

/**
 * Resolves the gene record for the favorite button. Inline with the synchronous
 * `<PageTitle>` so the button streams in next to the symbol once the gene
 * record is available, without blocking the title from painting.
 */
async function FavoriteSlot(props: Props) {
  const gene = await resolveGene(props)
  if (!gene) return null
  return (
    <span data-tour="gene-favorite">
      <FavoriteGeneButton gene={gene} />
    </span>
  )
}

/**
 * Renders gene metadata (name, Ensembl link, species badge). Suspended so the
 * page shell — including the symbol pulled from the URL — paints instantly
 * while the gene query resolves.
 */
async function GeneHeaderMeta(props: Props) {
  const gene = await resolveGene(props)
  if (!gene) notFound()

  return (
    <>
      <SpeciesSync species={gene.species} />
      <GeneBreadcrumbJsonLd gene={gene} />
      <p className="text-muted-foreground text-sm md:text-base">{gene.name}</p>
      <div className="flex items-center gap-3">
        <a
          href={`https://ensembl.org/id/${gene.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
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
    </>
  )
}

/**
 * Resolves the gene record and renders the isoform section. Independently
 * suspended so the slow isoform query doesn't block the gene header from
 * painting.
 */
async function GeneIsoforms(props: Props) {
  const gene = await resolveGene(props)
  if (!gene) notFound()

  const { isoform: highlightedIsoformId } = await props.searchParams
  // Associations are human-only; key by symbol since /genes/<sym> may resolve to
  // mouse by default and mouse Ensembl IDs (ENSMUSG...) never match human data.
  const associationRow =
    gene.species === 'human' ? findBySymbol(gene.symbol) : undefined

  return (
    <IsoformSection
      gene={gene}
      highlightedIsoformId={highlightedIsoformId}
      associationRow={associationRow}
    />
  )
}

function GeneHeaderSkeleton() {
  return (
    <>
      <div
        aria-hidden
        className="bg-muted h-5 w-56 animate-pulse rounded-md md:h-6"
      />
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="bg-muted h-4 w-32 animate-pulse rounded-md"
        />
        <span className="text-border">·</span>
        <div
          aria-hidden
          className="bg-muted h-5 w-20 animate-pulse rounded-md"
        />
      </div>
    </>
  )
}

export default async function GeneSymbolPage(props: Props) {
  const { symbol } = await props.params

  return (
    <>
      <GeneDetailTour />
      <div className="flex flex-col gap-5 pt-6 md:pt-10">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <PageTitle>{symbol}</PageTitle>
            <Suspense fallback={null}>
              <FavoriteSlot {...props} />
            </Suspense>
          </div>
          <Suspense fallback={<GeneHeaderSkeleton />}>
            <GeneHeaderMeta {...props} />
          </Suspense>
        </header>
        <Suspense fallback={<IsoformTableLoading />}>
          <ViewTransition enter="suspense-reveal" default="none">
            <GeneIsoforms {...props} />
          </ViewTransition>
        </Suspense>
      </div>
    </>
  )
}
