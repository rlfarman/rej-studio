import { notFound } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { TrackOnMount } from '@/components/track-on-mount'
import { Metadata } from 'next'
import { cache } from 'react'
import {
  SPECIES_DISPLAY_NAME,
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
  const gene = await resolveGene(props)

  return {
    title: gene?.symbol ?? symbol,
    description: `View all isoforms for ${gene?.name ?? symbol} and download pre-optimized sequences or customize your own.`,
    alternates: {
      canonical: `/genes/${gene?.symbol ?? symbol}`,
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
}: {
  gene: { id: string; symbol: string; name: string }
  highlightedIsoformId?: string
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm font-semibold">
          Species
        </span>
        {speciesAvailable.map((s) => (
          <Badge key={s} variant="secondary">
            {SPECIES_DISPLAY_NAME[s]}
          </Badge>
        ))}
      </div>
      <Separator className="my-4" />
      <h2 className="mb-2 text-lg font-semibold tracking-tight">Isoforms</h2>
      <IsoformTable
        isoforms={isoforms}
        highlightedIsoformId={highlightedIsoformId}
      />
      <div className="mt-8 space-y-6">
        <IsoformSummary isoforms={isoforms} />
        <IsoformLengthChart isoforms={isoforms} />
        <IsoformIdentityMatrix isoforms={isoforms} />
      </div>
    </>
  )
}

export default async function GeneSymbolPage(props: Props) {
  const gene = await resolveGene(props)

  if (!gene) {
    notFound()
  }

  const { isoform: highlightedIsoformId } = await props.searchParams

  return (
    <>
      <GeneBreadcrumbJsonLd gene={gene} />
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <h1 className="font-mono text-2xl leading-none font-bold tracking-tight">
            {gene.symbol}
          </h1>
          <FavoriteGeneButton gene={gene} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="text-muted-foreground text-sm font-semibold">
                Gene name
              </div>
              <div>{gene.name}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm font-semibold">
                Ensembl Gene ID
              </div>
              <div className="font-mono">{gene.id}</div>
            </div>
          </div>
          <Suspense fallback={<IsoformTableLoading />}>
            <ViewTransition enter="suspense-reveal" default="none">
              <IsoformSection
                gene={gene}
                highlightedIsoformId={highlightedIsoformId}
              />
            </ViewTransition>
          </Suspense>
        </CardContent>
      </Card>
    </>
  )
}
