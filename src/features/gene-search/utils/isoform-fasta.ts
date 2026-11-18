import { formatFasta } from '@/lib/bio/fasta'

interface FastaIsoform {
  id: string
  codingSequence: string
  codingSequenceLength: number
}

/**
 * One multi-FASTA document with every isoform's CDS, headed
 * `>ENST… GENE CDS=1182bp` so records stay identifiable once the file
 * leaves the app. Ends with a newline, as most tools expect.
 */
export function buildIsoformsFasta(
  geneSymbol: string,
  isoforms: readonly FastaIsoform[],
): string {
  return (
    isoforms
      .map((isoform) =>
        formatFasta(
          `${isoform.id} ${geneSymbol} CDS=${isoform.codingSequenceLength}bp`,
          isoform.codingSequence,
        ),
      )
      .join('\n') + '\n'
  )
}

export function isoformsFastaFilename(geneSymbol: string) {
  return `${geneSymbol}_isoforms_CDS.fasta`
}
