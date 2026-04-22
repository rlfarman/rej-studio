import { DnaLoader } from '@/components/bio/dna-loader'

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading gene"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4"
    >
      <DnaLoader className="h-10 w-[120px]" />
      <p className="text-muted-foreground text-sm">Loading gene…</p>
    </div>
  )
}
