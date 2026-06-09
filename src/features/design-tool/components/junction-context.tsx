'use client'

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
        className={cn(inMotif && 'bg-primary/20 text-primary font-semibold')}
      >
        {char}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <div className="bg-muted/30 overflow-x-auto rounded-md border p-3">
        <div className="flex items-center justify-center gap-0 font-mono text-sm">
          <span className="text-muted-foreground type-micro mr-2 tabular-nums">
            {leftStart.toLocaleString()}
          </span>
          <div className="flex">
            {left.split('').map((c, i) => renderChar(c, i))}
          </div>
          <div
            className="relative mx-0.5 self-stretch"
            title={`Split after base ${splitPoint.toLocaleString()}`}
          >
            <div className="bg-primary h-full w-0.5" />
            <div className="bg-primary absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45" />
          </div>
          <div className="flex">
            {right.split('').map((c, i) => renderChar(c, left.length + i))}
          </div>
          <span className="text-muted-foreground type-micro ml-2 tabular-nums">
            {rightEnd.toLocaleString()}
          </span>
        </div>
        <div className="text-muted-foreground type-micro mt-2 flex justify-center gap-8">
          <span>← 5′ sequence ends</span>
          <span>3′ sequence starts →</span>
        </div>
      </div>
      {wggwMotif && motifStartRel !== null && (
        <div className="text-muted-foreground type-micro">
          WGGW motif{' '}
          <span className="bg-primary/20 text-primary rounded px-1 font-mono font-semibold">
            {wggwMotif}
          </span>{' '}
          spans the junction.
        </div>
      )}
    </div>
  )
}
