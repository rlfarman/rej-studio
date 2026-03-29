import type { Isoform } from '@/types/isoform'
import Button from '@/components/button'
import CopyButtons from './copy-buttons'
import Link from 'next/link'

interface IsoformCardProperties {
  isoform: Isoform
  symbol: string
  hasPrecomputed: boolean
}

export default function IsoformCard({
  symbol,
  isoform,
  hasPrecomputed,
}: IsoformCardProperties) {
  return (
    <div
      key={isoform.ENST}
      className="block rounded-lg border border-neutral-200 bg-white px-6 pb-4 pt-6 shadow dark:border-neutral-700 dark:bg-neutral-800"
    >
      <h2 className="text-lg font-semibold">{isoform.ENST}</h2>
      <CopyButtons isoform={isoform} />
      <table className="mt-2 w-full max-w-xl table-auto text-left">
        <thead className="text-sm text-neutral-500 dark:text-neutral-400">
          <tr>
            <th scope="col" className="break-words font-normal">
              Length (bp)
            </th>
            <th scope="col" className="break-words font-normal">
              Length (aa)<sup>*</sup>
            </th>
            <th scope="col" className="break-words font-normal">
              Species
            </th>
            <th scope="col" className="break-words font-normal">
              Packagability
            </th>
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
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        <sup>*</sup> Amino acid length includes the stop codon and may
        overestimate the translated protein length by 1.
      </p>
      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        {hasPrecomputed ? (
          <Button
            href={`/data/precomputed/REJ_${symbol}_${isoform.ENST}.zip`}
            download
          >
            Download predesigned sequences
          </Button>
        ) : (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            No predesigned sequences available
          </span>
        )}
        <Link
          href={`/design-tool/${symbol}_${isoform.ENST}`}
          className="block font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          Open with design tool
        </Link>
      </div>
    </div>
  )
}
