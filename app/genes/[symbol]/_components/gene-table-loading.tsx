import classnames from 'classnames'

const TABLE_HEAD_CELL_CLASSES = 'break-words'

interface GeneTableProperties {
  gene: Gene
}

export default function GeneTable() {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="block rounded-lg border border-gray-200 bg-white px-6 pb-4 pt-6 shadow  dark:border-gray-700 dark:bg-gray-800">
        <div className="animate-pulse ">
          <div className="mb-2 h-5 w-full max-w-[12rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <span className="mb-2 inline-block h-3.5 w-full max-w-[12rem] rounded-full bg-gray-200 dark:bg-gray-700"></span>
            <span className="mb-2 inline-block h-3.5 w-full max-w-[8rem] rounded-full bg-gray-200 dark:bg-gray-700"></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="mb-2 inline-block h-3.5 w-full max-w-[12rem] rounded-full bg-gray-200 dark:bg-gray-700"></span>
            <span className="mb-2 inline-block h-3.5 w-full max-w-[8rem] rounded-full bg-gray-200 dark:bg-gray-700"></span>
          </div>
          <table className="mt-4 w-full max-w-xl table-auto text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-sm">
              <tr>
                <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  <div className="h-3.5 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
                <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  <div className="h-3.5 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
                <td scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                  <div className="h-3.5 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
                <td scope="col" className={classnames(TABLE_HEAD_CELL_CLASSES)}>
                  <div className="h-3.5 w-48 max-w-[6rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[2rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 h-5 w-48 max-w-[16rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    </div>
  )
}
