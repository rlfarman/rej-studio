import Button from '@/components/button'
import CopyButtons from './copy-buttons'
import Link from 'next/link'

interface IsoformCardProperties {
  isoform: Isoform
  symbol: string
}

export default function IsoformCard({
  symbol,
  isoform,
}: IsoformCardProperties) {
  return (
    <div
      key={isoform.ENST}
      className="block rounded-lg border border-neutral-200 bg-white px-6 pb-4 pt-6 shadow  dark:border-neutral-700 dark:bg-neutral-800"
    >
      <h2 className="text-lg font-semibold">{isoform.ENST}</h2>
      <CopyButtons isoform={isoform} />
      <table className="mt-2 w-full max-w-xl table-auto text-left">
        <thead className="text-sm text-neutral-500 dark:text-neutral-400">
          <tr>
            <td scope="col" className="break-words">
              Length (bp)
            </td>
            <td scope="col" className="break-words">
              Length (aa)
            </td>
            <td scope="col" className="break-words">
              Species
            </td>
            <td scope="col" className="break-words">
              Packagability
            </td>
          </tr>
        </thead>
        <tbody>
          <tr key={isoform.ENST}>
            <td>{isoform.length}</td>
            <td>{isoform.length / 3}</td>
            <td>{isoform.species}</td>
            <td>{isoform.packagability}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-col gap-2 pt-4 md:flex-row md:items-center md:gap-4">
        <Button
          href={`/data/precomputed/REJ_${symbol}_${isoform.ENST}.zip`}
          download
        >
          Download predesigned sequences
        </Button>
        <Link
          href={`/design-tool/${symbol}_${isoform.ENST}`}
          className="block font-medium text-sky-600 underline-offset-2 underline-offset-2 hover:underline dark:text-sky-500"
        >
          Customize with design tool
        </Link>
      </div>
    </div>
  )
}
