import { ClipboardIcon } from '@heroicons/react/20/solid'
import classnames from 'classnames'
import copy from 'copy-to-clipboard'
import CopyButtons from './copy-buttons'

const TABLE_HEAD_CELL_CLASSES = 'break-words'

interface GeneTableProperties {
  gene: Gene
}

export default function GeneTable({ gene }: GeneTableProperties) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      {gene.isoforms.map((isoform) => (
        <div
          key={isoform.ENST}
          className="block rounded-lg border border-gray-200 bg-white px-6 pb-4 pt-6 shadow  dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="text-lg font-semibold">{isoform.ENST}</h2>
          <CopyButtons isoform={isoform} />
          <table className="mt-2 w-full max-w-xl table-auto text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-sm">
              <tr>
                <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  Length (bp)
                </td>
                <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  Length (aa)
                </td>
                <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  Species
                </td>
                <td scope="col" className={classnames(TABLE_HEAD_CELL_CLASSES)}>
                  Packagability
                </td>
              </tr>
            </thead>
            <tbody>
              <tr key={isoform.ENST}>
                <td>{isoform.length}</td>
                <td>{isoform.length / 3}</td>
                <td> {isoform.species}</td>
                <td>{isoform.packagability}</td>
              </tr>
            </tbody>
          </table>
          <div className="pt-4">
            <a
              href={`/data/precomputed/REJ_${gene.symbol}_${isoform.ENST}.zip`}
              download
              className="font-medium text-sky-600 hover:underline dark:text-sky-500"
            >
              Download RNA end-joined sequences
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
