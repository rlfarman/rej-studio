import { notFound } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getGeneBySymbol } from '@/actions/genes'
import { getIsoformsByGene } from '@/actions/isoforms'
import IsoformTable, { IsoformTableLoading } from './_components/isoform-table'
import { Suspense } from 'react'
import { FavoriteGeneButton } from './_components/favorite-gene-button'
import { Metadata } from 'next'
import { cache } from 'react'

type Props = {
  params: Promise<{ symbol: string }>
}

const getCachedGeneBySymbol = cache(getGeneBySymbol)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const symbol = (await params).symbol
  const gene = await getCachedGeneBySymbol(symbol)

  return {
    title: `${gene?.symbol ?? symbol} | REJ Studio`,
    description: `View all isoforms for ${gene?.name ?? symbol} and download pre-optimized sequences or customize your own.`,
  }
}

export default async function GeneSymbolPage({ params }: Props) {
  const { symbol } = await params
  const gene = await getCachedGeneBySymbol(symbol)

  if (!gene) {
    notFound()
  }

  const isoforms = await getIsoformsByGene(gene.id)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <h1 className="font-mono text-2xl font-bold leading-none">{gene.symbol}</h1>
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
            <div className="font-mono">{gene.ENSG}</div>
          </div>
          {gene.chromosome && (
            <div>
              <div className="text-muted-foreground text-sm font-semibold">
                Chromosome
              </div>
              <div className="font-mono">{gene.chromosome}</div>
            </div>
          )}
        </div>
        <Separator className="my-4" />
        <h2 className="font-bold">Isoforms</h2>
        <Suspense fallback={<IsoformTableLoading />}>
          <IsoformTable isoforms={isoforms} />
        </Suspense>
      </CardContent>
    </Card>
  )
}
