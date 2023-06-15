import genes from '@/public/data/genes.json'
import { notFound } from 'next/navigation'

const TABLE_HEAD_CELL_CLASSES = 'p-4 pb-3 pl-8 pt-0'
const TABLE_BODY_CELL_CLASSES =
  'border-b border-gray-100 dark:border-gray-700 p-4 pl-8 '

export default function Page({ params }: { params: { symbol: string } }) {
  const gene = (genes as Gene[]).find((gene) => gene.symbol === params.symbol)

  if (!gene) {
    notFound()
  }

  return (
    <div className="container pt-4">
      <div className="text-lg">
        <div>
          <strong>{gene.symbol}</strong>
        </div>
        <div>{gene.name}</div>
        <div>{gene.ENSG}</div>
        <div>Chromosome: {gene.chromosome}</div>
        <div>
          Diseases associated: {gene.diseaseAssociations?.join('; ') ?? 'None'}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="mt-4 w-full table-auto overflow-x-auto text-left">
          <thead className="pt-4">
            <tr>
              <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                ENST
              </th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                Length
              </th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                Species
              </th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                Packagability
              </th>
              <th />
            </tr>
          </thead>
          <tbody className="bg-white dark:text-gray-700">
            {gene.isoforms.map((isoform) => (
              <tr
                key={isoform.ENST}
                className="border-b odd:bg-white even:bg-gray-100 hover:bg-sky-100"
              >
                <th scope="row" className={TABLE_BODY_CELL_CLASSES}>
                  {isoform.ENST}
                </th>
                <td className={TABLE_BODY_CELL_CLASSES}>{isoform.length}</td>
                <td className={TABLE_BODY_CELL_CLASSES}> {isoform.species}</td>
                <td className={TABLE_BODY_CELL_CLASSES}>
                  {isoform.packagability}
                </td>
                <td className={TABLE_BODY_CELL_CLASSES}>
                  <a
                    href={`/data/precomputed/REJ_${gene.symbol}_${isoform.ENST}.zip`}
                    download
                    className="font-medium text-sky-700 hover:underline"
                  >
                    Download sequences
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
