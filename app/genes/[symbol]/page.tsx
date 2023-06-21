import genes from '@/public/data/genes.json'
import classnames from 'classnames'
import { notFound } from 'next/navigation'
import { useEffect } from 'react'

const TABLE_HEAD_CELL_CLASSES = 'px-6 py-3'
const TABLE_BODY_CELL_CLASSES = 'px-6 py-4'

export default function Page({ params }: { params: { symbol: string } }) {
  const gene = (genes as Gene[]).find((gene) => gene.symbol === params.symbol)

  if (!gene) {
    notFound()
  }

  return (
    <div className="container pt-4">
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
      <div className="overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full table-auto text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                ENST
              </th>
              <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                Length
              </td>
              <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                Species
              </td>
              <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                Packagability
              </td>
              <td />
            </tr>
          </thead>
          <tbody>
            {gene.isoforms.map((isoform) => (
              <tr
                key={isoform.ENST}
                className="border-b odd:bg-white even:bg-gray-50 hover:bg-sky-50 dark:border-gray-700 dark:odd:bg-gray-800 dark:even:bg-gray-900"
              >
                <th
                  scope="row"
                  className={classnames(
                    'whitespace-nowrap font-bold text-gray-900 dark:text-white',
                    TABLE_BODY_CELL_CLASSES
                  )}
                >
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
                    className="font-medium text-sky-600 hover:underline dark:text-sky-500"
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
