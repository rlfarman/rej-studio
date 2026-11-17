import { DnaLoader } from '@/components/bio/dna-loader'
import { appCopy } from '@/copy/app'

/** Shown while a gene page's data loads. */
export function GeneLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={appCopy.loading.geneAria}
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
    >
      <DnaLoader className="h-10 w-[120px]" />
      <p className="text-sm text-muted-foreground">{appCopy.loading.gene}</p>
    </div>
  )
}
