import genes from '@/public/data/genes.json'
import { notFound } from 'next/navigation'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import IsoformList from './_components/isoform-list'

const getData = async (symbol: string): Promise<Gene | undefined> => {
  const gene = (genes as Gene[]).find((gene) => gene.symbol === symbol)
  if (!gene) {
    return gene
  }
  return {
    ...gene,
    isoforms: await Promise.all(
      gene.isoforms.map(async (isoform) => {
        try {
          const fileName = `${isoform.ENST}.txt`
          const basePath = path.join(process.cwd(), 'public', 'data')
          const [codingSequence, proteinSequence] = await Promise.all([
            await fs.readFile(
              path.join(basePath, 'coding_sequences', fileName),
              'utf8'
            ),
            await fs.readFile(
              path.join(basePath, 'protein_sequences', fileName),
              'utf8'
            ),
          ])
          return {
            ...isoform,
            codingSequence,
            proteinSequence,
          }
        } catch (error) {
          console.error(error)
          return isoform
        }
      })
    ),
  }
}

export default async function GeneSymbolPage({
  params,
}: {
  params: { symbol: string }
}) {
  const gene = await getData(params.symbol)

  if (!gene) {
    notFound()
  }

  return (
    <div>
      <h1 className="text-xl font-bold">{gene.symbol}</h1>
      <dl className="mt-1 text-lg text-gray-500 dark:text-gray-400">
        <dt className="hidden">Gene name:</dt>
        <dd>{gene.name}</dd>
        <dt className="hidden">ENSG:</dt>
        <dd>{gene.ENSG}</dd>
        <dt className="hidden">Chromosome:</dt>
        <dd className="inline">Chromosome {gene.chromosome}</dd>
      </dl>

      {gene.diseaseAssociations?.length ? (
        <div className="text-lg text-gray-500 dark:text-gray-400">
          <div>Diseases Associated</div>
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
