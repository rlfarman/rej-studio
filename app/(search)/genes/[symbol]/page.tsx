import { notFound } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getGeneBySymbol } from '@/actions'
import IsoformTable, { IsoformTableLoading } from './_components/isoform-table'
import { getAllGeneSymbols } from './_actions'
import { Suspense } from 'react'

export async function generateStaticParams() {
  const genes = await getAllGeneSymbols()
  return genes.map((gene) => ({
    symbol: gene.symbol,
  }))
}

export default async function GeneSymbolPage({
  params,
  ...rest
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol } = await params
  const gene = await getGeneBySymbol(symbol)

  if (!gene) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-2xl font-bold">
          {gene.symbol}
        </CardTitle>
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
          <div>
            <div className="text-muted-foreground text-sm font-semibold">
              Chromosome
            </div>
            <div className="font-mono">{gene.chromosome}</div>
          </div>
        </div>
        <Separator className="my-4" />
        <h2 className="font-bold">Isoforms</h2>
        <Suspense fallback={<IsoformTableLoading />}>
          <IsoformTable geneId={gene.id} />
        </Suspense>
      </CardContent>
    </Card>
  )
}
