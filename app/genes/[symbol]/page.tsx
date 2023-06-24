import GeneTable from '@/components/gene-table'
import genes from '@/public/data/genes.json'
import { notFound } from 'next/navigation'

export default function Page({ params }: { params: { symbol: string } }) {
  const gene = (genes as Gene[]).find((gene) => gene.symbol === params.symbol)

  if (!gene) {
    notFound()
  }

  return (
    <div className="pt-4">
      <div>
        <h1 className="text-xl">
          <strong>{gene.symbol}</strong>
        </h1>
        <dl className="text-sm">
          <dt className="hidden">Gene name:</dt>
          <dd>{gene.name}</dd>
          <dt className="hidden">ENSG:</dt>
          <dd>{gene.ENSG}</dd>
          <dt className="inline">Chromosome:</dt>{' '}
          <dd className="inline">{gene.chromosome}</dd>
        </dl>
        {gene.diseaseAssociations?.length ? (
          <>
            <div className="text-sm">Diseases Associated:</div>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {gene.diseaseAssociations?.map((disease) => (
                <li key={disease}>{disease}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <hr className="my-8 h-px border-0 bg-gray-300 dark:bg-gray-700" />
      <GeneTable gene={gene} />
    </div>
  )
}
