import Button from '@/components/button'
import genes from '@/public/data/genes.json'
import { notFound } from 'next/navigation'

export default function Page({ params }: { params: { symbol: string } }) {
  const gene = (genes as Gene[]).find((gene) => gene.symbol === params.symbol)
  console.log(gene)
  if (!gene) {
    notFound()
  }
  return (
    <div className="container">
      <h1>
        <strong>Gene</strong>
      </h1>
      <div className="mt-3 inline-block w-full rounded bg-white p-4">
        <div>{gene.symbol}</div>
        <div>{gene.name}</div>
        <div>Chromosome: {gene.chromosome}</div>
        <div>ENSG: {gene.ENSG}</div>
        <div>
          Diseases associated: {gene.diseaseAssociations?.join('; ') ?? 'None'}
        </div>
      </div>
      <h2 className="pt-3">
        <strong>Isoforms</strong>
      </h2>
      <div className="mt-3 flex flex-col gap-4">
        {gene.isoforms.map((isoform) => (
          <div key={isoform.ENST} className="inline-block rounded bg-white p-4">
            <h3>{isoform.ENST}</h3>
            <div>Length: {isoform.length}</div>
            <div>Species: {isoform.species}</div>
            <div>Packagability: {isoform.packagability}</div>
            <div className="pt-3">
              <Button
                href={`/data/precomputed/REJ_${gene.symbol}_${isoform.ENST}.zip`}
                download
              >
                Download fasta
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
