import { notFound } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getGeneBySymbol } from '@/actions'
import IsoformTable from './_components/isoform-table'

export default async function GeneSymbolPage(props: {
  params: { symbol: string }
}) {
  const { symbol } = props.params
  const gene = await getGeneBySymbol(symbol)

  if (!gene) {
    notFound()
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{gene.symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div className="text-neutral-500 dark:text-neutral-400">
              <div className="text-sm font-semibold">Gene name</div>
              <div>{gene.name}</div>
            </div>
            <div className="text-neutral-500 dark:text-neutral-400">
              <div className="text-sm font-semibold">Ensembl Gene ID</div>
              <div>{gene.ENSG}</div>
            </div>
            <div className="text-neutral-500 dark:text-neutral-400">
              <div className="text-sm font-semibold">Chromosome</div>
              <div>{gene.chromosome}</div>
            </div>
          </div>
          <Separator className="my-4" />
          <h2 className="font-bold">Isoforms</h2>
          <IsoformTable geneId={gene.id} />
        </CardContent>
      </Card>
    </div>
  )
}
