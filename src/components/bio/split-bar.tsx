/**
 * Stacked 5'/3' fragment bar for visualizing a sequence split. Widths are
 * proportional to the two fragment lengths. Callers render their own header
 * (split position, motif, balance status, etc.) — this component is just the
 * bar so it can be composed into different surrounding contexts.
 */
interface SplitBarProps {
  fivePrimeLength: number
  threePrimeLength: number
}

export function SplitBar({ fivePrimeLength, threePrimeLength }: SplitBarProps) {
  const total = fivePrimeLength + threePrimeLength
  const percentage = total > 0 ? (fivePrimeLength / total) * 100 : 50

  return (
    <div className="flex h-6 w-full overflow-hidden rounded-md border">
      <div
        className="flex min-w-0 items-center justify-center border-r-2 border-primary bg-primary/15 transition-all"
        style={{ width: `${percentage}%` }}
      >
        <span className="truncate px-1.5 type-micro font-medium text-primary">
          5&apos; &middot; {fivePrimeLength.toLocaleString()} bp
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center bg-muted/50">
        <span className="truncate px-1.5 type-micro font-medium text-muted-foreground">
          3&apos; &middot; {threePrimeLength.toLocaleString()} bp
        </span>
      </div>
    </div>
  )
}
