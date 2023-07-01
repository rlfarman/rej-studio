import IsoformListLoading from './_components/isoform-list-loading'

export default function Loading() {
  return (
    <div>
      <div role="status" className="max-w-xs animate-pulse">
        <div className="mb-2.5 h-5 w-48 max-w-[96px] rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <div className="mb-2.5 h-3.5 max-w-[256px] rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <div className="mb-2.5 h-3.5 max-w-[192px] rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <div className="mb-2.5 h-3.5 max-w-[192px] rounded-full bg-gray-300 dark:bg-gray-700"></div>
        <span className="sr-only">Loading...</span>
      </div>
      <IsoformListLoading />
    </div>
  )
}
