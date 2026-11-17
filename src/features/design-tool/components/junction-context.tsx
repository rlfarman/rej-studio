import { cn } from '@/lib/utils'

interface Props {
  sequence: string
  splitPoint: number
  flank?: number
  wggwMotif?: string
}

/**
 * Show ±flank bp around the split point in monospace, with the 5′ side, 3′
 * side, and (optional) WGGW motif called out visually. Makes the junction
 * inspectable without scrolling the full sequence block.
 */
export function JunctionContext({
  sequence,
  splitPoint,
  flank = 18,
  wggwMotif,
}: Props) {
  const len = sequence.length
  if (len === 0 || splitPoint <= 0 || splitPoint >= len) return null

  const left = sequence.slice(Math.max(0, splitPoint - flank), splitPoint)
  const right = sequence.slice(splitPoint, Math.min(len, splitPoint + flank))
  const leftStart = Math.max(0, splitPoint - flank) + 1
  const rightEnd = Math.min(len, splitPoint + flank)

  // Find WGGW motif position near the split (if provided), for highlighting.
  // The motif can sit on either side of the cut — look within the shown window.
  let motifStartRel: number | null = null
  if (wggwMotif) {
    const window = left + right
    const hit = window.toUpperCase().indexOf(wggwMotif.toUpperCase())
    if (hit >= 0) motifStartRel = hit
  }

  const renderChar = (char: string, relPos: number) => {
    const inMotif =
      motifStartRel !== null &&
      relPos >= motifStartRel &&
      relPos < motifStartRel + (wggwMotif?.length ?? 0)
    return (
      <span
        key={relPos}
        className={cn(inMotif && 'bg-primary/20 font-semibold text-primary')}
      >
        {char}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border bg-muted/30 p-3">
        <div className="flex items-center justify-center gap-0 font-mono text-sm">
          <span className="mr-2 type-micro text-muted-foreground tabular-nums">
            {leftStart.toLocaleString()}
          </span>
          <div className="flex">
            {left.split('').map((c, i) => renderChar(c, i))}
          </div>
          <div
            className="relative mx-0.5 self-stretch"
            title={`Split after base ${splitPoint.toLocaleString()}`}
          >
            <div className="h-full w-0.5 bg-primary" />
            <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-primary" />
          </div>
          <div className="flex">
            {right.split('').map((c, i) => renderChar(c, left.length + i))}
          </div>
          <span className="ml-2 type-micro text-muted-foreground tabular-nums">
            {rightEnd.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex justify-center gap-8 type-micro text-muted-foreground">
          <span>← 5′ sequence ends</span>
          <span>3′ sequence starts →</span>
        </div>
      </div>
      {wggwMotif && motifStartRel !== null && (
        <div className="type-micro text-muted-foreground">
          WGGW motif{' '}
          <span className="rounded-sm bg-primary/20 px-1 font-mono font-semibold text-primary">
            {wggwMotif}
          </span>{' '}
          spans the junction.
        </div>
      )}
    </div>
  )
}
