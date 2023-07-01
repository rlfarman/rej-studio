import CopyButtons from './copy-buttons'

interface IsoformCardProperties {
  isoform: Isoform
  geneSymbol: string
}

export default function IsoformCard({
  geneSymbol,
  isoform,
}: IsoformCardProperties) {
  return (
    <div
      key={isoform.ENST}
      className="block rounded-lg border border-gray-200 bg-white px-6 pb-4 pt-6 shadow  dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="text-lg font-semibold">{isoform.ENST}</h2>
      <CopyButtons isoform={isoform} />
      <table className="mt-2 w-full max-w-xl table-auto text-left text-sm text-gray-500 dark:text-gray-400">
        <thead className="text-sm">
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
            <td> {isoform.species}</td>
            <td>{isoform.packagability}</td>
          </tr>
        </tbody>
      </table>
      <div className="pt-4">
        <a
          href={`/data/precomputed/REJ_${geneSymbol}_${isoform.ENST}.zip`}
          download
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          Download RNA end-joined sequences
        </a>
      </div>
    </div>
  )
}
