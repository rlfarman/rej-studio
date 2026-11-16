import { DnaLoader } from '@/components/bio/dna-loader'
import { geneSearchCopy } from '@/features/gene-search/copy'

const copy = geneSearchCopy.genePage

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={copy.loadingAria}
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
    >
      <DnaLoader className="h-10 w-[120px]" />
      <p className="text-muted-foreground text-sm">{copy.loading}</p>
    </div>
  )
}
