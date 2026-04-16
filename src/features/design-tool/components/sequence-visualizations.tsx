'use client'

import { useMemo } from 'react'
import { Activity, GitCompareArrows } from 'lucide-react'
import { slidingGcContent, changeDensity } from '@/lib/bio/sequence-utils'

interface Props {
  original: string
  optimized: string
  splitPoint?: number
}

// Target GC band — reasonable default for mammalian synthetic genes.
const TARGET_GC_MIN = 40
const TARGET_GC_MAX = 60

const CHART_HEIGHT = 120
const CHART_PAD_X = 4
const CHART_PAD_Y = 8

function GcContentTrack({ original, optimized, splitPoint }: Props) {
  const { beforePath, afterPath, maxLen } = useMemo(() => {
    const maxLen = Math.max(original.length, optimized.length)
    if (maxLen === 0) {
      return { beforePath: '', afterPath: '', maxLen: 0 }
    }
    // Scale window with sequence length so short sequences still get detail.
    const windowSize = Math.max(30, Math.min(120, Math.round(maxLen / 25)))
    const step = Math.max(1, Math.round(maxLen / 200))
    const before = slidingGcContent(original, windowSize, step)
    const after = slidingGcContent(optimized, windowSize, step)

    const toPath = (pts: { position: number; gc: number }[]) => {
      if (pts.length === 0) return ''
      const width = 1000 - CHART_PAD_X * 2
      const height = CHART_HEIGHT - CHART_PAD_Y * 2
      return pts
        .map((p, i) => {
          const x = CHART_PAD_X + (p.position / Math.max(1, maxLen - 1)) * width
          const y = CHART_PAD_Y + (1 - p.gc / 100) * height
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
    }

    return {
      beforePath: toPath(before),
      afterPath: toPath(after),
      maxLen,
    }
  }, [original, optimized])

  if (maxLen === 0) return null

  const width = 1000 - CHART_PAD_X * 2
  const height = CHART_HEIGHT - CHART_PAD_Y * 2
  const bandTop = CHART_PAD_Y + (1 - TARGET_GC_MAX / 100) * height
  const bandBottom = CHART_PAD_Y + (1 - TARGET_GC_MIN / 100) * height
  const splitX =
    splitPoint !== undefined
      ? CHART_PAD_X + (splitPoint / Math.max(1, maxLen - 1)) * width
      : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="text-muted-foreground size-4" />
          GC Content (sliding window)
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="bg-muted-foreground/40 h-0.5 w-4 rounded-full" />
            Original
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="bg-primary h-0.5 w-4 rounded-full" />
            Optimized
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-500/15 ring-1 ring-emerald-500/30" />
            Target {TARGET_GC_MIN}–{TARGET_GC_MAX}%
          </span>
        </div>
      </div>
      <div className="bg-muted/30 overflow-hidden rounded-md border">
        <svg
          viewBox={`0 0 1000 ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-24 w-full"
          role="img"
          aria-label="GC content comparison along the sequence"
        >
          {/* Target band */}
          <rect
            x={CHART_PAD_X}
            y={bandTop}
            width={width}
            height={bandBottom - bandTop}
            className="fill-emerald-500/10"
          />
          {/* 50% baseline */}
          <line
            x1={CHART_PAD_X}
            x2={CHART_PAD_X + width}
            y1={CHART_PAD_Y + height / 2}
            y2={CHART_PAD_Y + height / 2}
            className="stroke-border"
            strokeDasharray="2 4"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {/* Split marker */}
          {splitX !== null && (
            <line
              x1={splitX}
              x2={splitX}
              y1={CHART_PAD_Y}
              y2={CHART_PAD_Y + height}
              className="stroke-foreground/30"
              strokeDasharray="3 3"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Before */}
          <path
            d={beforePath}
            className="stroke-muted-foreground/50 fill-none"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
          {/* After */}
          <path
            d={afterPath}
            className="stroke-primary fill-none"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
        <span>0</span>
        <span>{Math.round(maxLen / 2).toLocaleString()}</span>
        <span>{maxLen.toLocaleString()} bp</span>
      </div>
    </div>
  )
}

function ChangeDensityTrack({ original, optimized, splitPoint }: Props) {
  const { bins, maxChanges, len, total } = useMemo(() => {
    const bins = changeDensity(original, optimized, 60)
    const maxChanges = bins.reduce((m, b) => Math.max(m, b.changes), 0)
    const len = Math.min(original.length, optimized.length)
    const total = bins.reduce((m, b) => m + b.changes, 0)
    return { bins, maxChanges, len, total }
  }, [original, optimized])

  if (bins.length === 0 || len === 0) return null

  const splitBinIndex =
    splitPoint !== undefined
      ? bins.findIndex((b) => splitPoint >= b.start && splitPoint < b.end)
      : -1

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitCompareArrows className="text-muted-foreground size-4" />
          Change Density
        </div>
        <span className="text-muted-foreground text-[10px] tabular-nums">
          {total.toLocaleString()} bases changed across{' '}
          {bins.length.toLocaleString()} bins
        </span>
      </div>
      <div
        className="bg-muted/30 grid h-16 items-end gap-px rounded-md border p-1"
        style={{ gridTemplateColumns: `repeat(${bins.length}, 1fr)` }}
      >
        {bins.map((bin, i) => {
          const h = maxChanges > 0 ? (bin.changes / maxChanges) * 100 : 0
          const pct = bin.binSize > 0 ? (bin.changes / bin.binSize) * 100 : 0
          const isSplit = i === splitBinIndex
          return (
            <div
              key={bin.start}
              className="group relative flex h-full items-end"
              title={`${bin.start.toLocaleString()}–${bin.end.toLocaleString()} bp · ${bin.changes} changes (${pct.toFixed(0)}%)`}
            >
              <div
                className={
                  'w-full rounded-sm transition-colors ' +
                  (bin.changes === 0
                    ? 'bg-muted-foreground/15'
                    : 'bg-primary/70 group-hover:bg-primary')
                }
                style={{ height: `${Math.max(bin.changes > 0 ? 4 : 2, h)}%` }}
              />
              {isSplit && (
                <div className="bg-foreground/40 pointer-events-none absolute inset-y-0 left-1/2 w-px" />
              )}
            </div>
          )
        })}
      </div>
      <div className="text-muted-foreground flex justify-between text-[10px] tabular-nums">
        <span>5′ · 0</span>
        {splitPoint !== undefined && (
          <span>split · {splitPoint.toLocaleString()}</span>
        )}
        <span>3′ · {len.toLocaleString()} bp</span>
      </div>
    </div>
  )
}

export function SequenceVisualizations({
  original,
  optimized,
  splitPoint,
}: Props) {
  if (!original || !optimized) return null
  return (
    <div className="space-y-5">
      <GcContentTrack
        original={original}
        optimized={optimized}
        splitPoint={splitPoint}
      />
      <ChangeDensityTrack
        original={original}
        optimized={optimized}
        splitPoint={splitPoint}
      />
    </div>
  )
}
