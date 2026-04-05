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
import { Suspense } from 'react'
import { FavoriteGeneButton } from '@/features/gene-search/components/favorite-gene-button'
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
    title: `${gene?.symbol ?? symbol} | REJ Studio`,
    description: `View all isoforms for ${gene?.name ?? symbol} and download pre-optimized sequences or customize your own.`,
  }
}

export default async function GeneSymbolPage(props: Props) {
  const gene = await resolveGene(props)

  if (!gene) {
    notFound()
  }

  const { isoform: highlightedIsoformId } = await props.searchParams
  const isoforms = await getIsoformsByGene(gene.id)

  const speciesAvailable = [
    ...new Set(isoforms.map((i) => i.species)),
  ] as Species[]

  return (
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
        </div>
        <Separator className="my-4" />
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Isoforms</h2>
        <IsoformSummary isoforms={isoforms} />
        <Suspense fallback={<IsoformTableLoading />}>
          <IsoformTable
            isoforms={isoforms}
            highlightedIsoformId={highlightedIsoformId}
          />
        </Suspense>
        <IsoformLengthChart isoforms={isoforms} />
        <IsoformIdentityMatrix isoforms={isoforms} />
      </CardContent>
    </Card>
  )
}
