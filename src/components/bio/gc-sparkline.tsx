'use client'

import { slidingGcContent, computeGcPercent } from '@/lib/bio/sequence-utils'
import { bioWidgetsCopy } from './copy'

interface Props {
  sequence: string
}

const H = 24
const PAD_Y = 2

/**
 * Tiny inline GC sparkline. Shows a sliding-window GC trace with a 35–60%
 * target band that matches the enforced GC constraint, plus the overall
 * GC% numerically. Hidden for sequences shorter than 60 bp.
 */
function sparklinePath(sequence: string) {
  const windowSize = Math.max(
    30,
    Math.min(120, Math.round(sequence.length / 25)),
  )
  const step = Math.max(1, Math.round(sequence.length / 150))
  const pts = slidingGcContent(sequence, windowSize, step)
  const width = 1000
  const height = H - PAD_Y * 2
  const maxPos = sequence.length - 1
  return pts
    .map((p, i) => {
      const x = (p.position / Math.max(1, maxPos)) * width
      const y = PAD_Y + (1 - p.gc / 100) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function GcSparkline({ sequence }: Props) {
  if (sequence.length < 60) return null

  const path = sparklinePath(sequence)
  const overallGc = computeGcPercent(sequence)

  const bandTop = PAD_Y + (1 - 0.6) * (H - PAD_Y * 2)
  const bandBottom = PAD_Y + (1 - 0.35) * (H - PAD_Y * 2)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <svg
        viewBox={`0 0 1000 ${H}`}
        preserveAspectRatio="none"
        className="block h-5 w-full min-w-0 flex-1 overflow-visible"
        role="img"
        aria-label={bioWidgetsCopy.gcSparkline.aria(overallGc.toFixed(1))}
      >
        <rect
          x={0}
          y={bandTop}
          width={1000}
          height={bandBottom - bandTop}
          className="fill-success/10"
        />
        <path
          d={path}
          className="fill-none stroke-primary"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="shrink-0 type-micro text-muted-foreground tabular-nums">
        GC {overallGc.toFixed(1)}%
      </span>
    </div>
  )
}
