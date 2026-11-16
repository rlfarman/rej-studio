import { DnaLoader } from '@/components/bio/dna-loader'
import { appCopy } from '@/copy/app'

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={appCopy.loading.geneAria}
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
    >
      <DnaLoader className="h-10 w-[120px]" />
      <p className="text-muted-foreground text-sm">{appCopy.loading.gene}</p>
    </div>
  )
}
