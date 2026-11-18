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
      .map((isoform) => buildIsoformFasta(geneSymbol, isoform))
      .join('\n') + '\n'
  )
}

/**
 * One isoform's CDS, with the same header the multi-FASTA uses. A single
 * record leaves the app more often than the whole set does — one transcript
 * per file, in a folder of its siblings — so it carries its gene and its
 * length rather than the bare transcript id.
 */
export function buildIsoformFasta(
  geneSymbol: string,
  isoform: FastaIsoform,
): string {
  return formatFasta(
    `${isoform.id} ${geneSymbol} CDS=${isoform.codingSequenceLength}bp`,
    isoform.codingSequence,
  )
}

export function isoformsFastaFilename(geneSymbol: string) {
  return `${geneSymbol}_isoforms_CDS.fasta`
}

/** Named for the gene as well as the transcript, to match the record inside. */
export function isoformFastaFilename(geneSymbol: string, isoformId: string) {
  return `${geneSymbol}_${isoformId}_CDS.fasta`
}
