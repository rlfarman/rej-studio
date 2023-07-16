export default function IsoformListLoading() {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="block rounded-lg border border-gray-200 bg-white px-6 pb-4 pt-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="animate-pulse ">
          <div className="mb-3 h-5 w-full max-w-[12rem] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="mb-2 h-3 w-full max-w-[8rem] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="mb-2 h-3.5 w-full max-w-[12rem] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="mb-2 h-3 w-full max-w-[8rem] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="mb-2 h-3.5 w-full max-w-[12rem] rounded-full bg-gray-200 dark:bg-gray-700" />
          <table className="mt-4 w-full max-w-xl table-auto text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="text-sm">
              <tr>
                <td scope="col" className="break-words">
                  <div className="h-3.5 w-48 max-w-[5rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
                <td scope="col" className="break-words">
                  <div className="h-3.5 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
                <td scope="col" className="break-words">
                  <div className="h-3.5 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
                <td scope="col" className="break-words">
                  <div className="h-3.5 w-48 max-w-[6rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[4rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
                <td>
                  <div className="mt-1 h-4 w-48 max-w-[2rem] rounded-full bg-gray-200 dark:bg-gray-700" />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="flex items-center gap-4">
            <div className="mt-4 h-5 w-full max-w-[16rem] rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 h-5 w-full max-w-[10rem] rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    </div>
  )
}
