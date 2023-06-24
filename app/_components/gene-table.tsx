import classnames from 'classnames'

const TABLE_HEAD_CELL_CLASSES = 'px-6 py-3'
const TABLE_BODY_CELL_CLASSES = 'px-6 py-4'

interface GeneTableProperties {
  gene: Gene
}

export default function GeneTable({ gene }: GeneTableProperties) {
  return (
    <div className="overflow-x-auto shadow-md sm:rounded-lg">
      <table className="w-full table-auto text-left text-sm text-gray-500 dark:text-gray-400">
        <thead className="bg-gray-50 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
              Transcription ID
            </th>
            <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
              Length (bp)
            </td>
            <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
              Length (aa)
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
              <td className={TABLE_BODY_CELL_CLASSES}>{isoform.length / 3}</td>
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
  )
}
