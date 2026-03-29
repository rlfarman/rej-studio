import { notFound } from 'next/navigation'
import { getGeneWithSequences } from '@/lib/genes'
import IsoformList from './_components/isoform-list'

export default async function GeneSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol } = await params
  const gene = getGeneWithSequences(symbol)

  if (!gene) {
    notFound()
  }

  return (
    <div>
      <h1 className="text-xl font-bold">{gene.symbol}</h1>
      <dl className="mt-1 text-lg text-neutral-500 dark:text-neutral-400">
        <dt className="hidden">Gene name:</dt>
        <dd>{gene.name}</dd>
        <dt className="hidden">ENSG:</dt>
        <dd>{gene.ENSG}</dd>
        <dt className="hidden">Chromosome:</dt>
        <dd className="inline">Chromosome {gene.chromosome}</dd>
      </dl>
      {gene.diseaseAssociations?.length ? (
        <div className="text-neutral-500 dark:text-neutral-400">
          <div className="text-lg">Diseases Associated:</div>
          <ul className="list-outside list-disc space-y-1 pl-4">
            {gene.diseaseAssociations?.map((disease) => (
              <li key={disease}>{disease}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h2 className="mt-4 text-lg font-bold">Isoforms</h2>
      <IsoformList gene={gene} />
    </div>
  )
}
