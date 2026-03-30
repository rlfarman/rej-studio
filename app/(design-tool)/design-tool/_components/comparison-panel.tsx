'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessResult } from '@/design-tool/types/process-result'
import { computeGcPercent, countCpG } from '@/design-tool/lib/sequence-utils'

interface ComparisonPanelProps {
  result: ProcessResult
}

function StatDelta({
  label,
  before,
  after,
  unit,
  lowerIsBetter,
}: {
  label: string
  before: number
  after: number
  unit?: string
  lowerIsBetter?: boolean
}) {
  const delta = after - before
  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const worsened = lowerIsBetter ? delta > 0 : delta < 0
  const unchanged = delta === 0
  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)

  return (
    <div className="bg-muted/50 flex flex-col rounded-lg border p-3">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-1.5 text-sm tabular-nums">
        <span>
          {fmt(before)}
          {unit}
        </span>
        <ArrowRight className="text-muted-foreground size-3" />
        <span className="font-medium">
          {fmt(after)}
          {unit}
        </span>
      </div>
      {!unchanged && (
        <span
          className={cn(
            'mt-1.5 text-[10px] font-medium tabular-nums',
            improved && 'text-emerald-600 dark:text-emerald-400',
            worsened && 'text-red-600 dark:text-red-400',
            !improved && !worsened && 'text-muted-foreground',
          )}
        >
          {delta > 0 ? '+' : ''}
          {fmt(delta)}
          {unit}
        </span>
      )}
    </div>
  )
}

export function ComparisonPanel({ result }: ComparisonPanelProps) {
  const stats = useMemo(() => {
    const orig = result.original_sequence
    const opt = result.optimized_sequence

    if (!orig || !opt) return null

    const gcBefore = computeGcPercent(orig)
    const gcAfter = computeGcPercent(opt)
    const cpgBefore = countCpG(orig)
    const cpgAfter = countCpG(opt)

    let changedPositions = 0
    const len = Math.min(orig.length, opt.length)
    for (let i = 0; i < len; i++) {
      if (orig[i] !== opt[i]) changedPositions++
    }
    const changePercent = len > 0 ? (changedPositions / len) * 100 : 0

    return {
      gcBefore,
      gcAfter,
      cpgBefore,
      cpgAfter,
      changedPositions,
      changePercent,
      len,
    }
  }, [result.original_sequence, result.optimized_sequence])

  if (!stats) return null

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">Original vs Optimized</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatDelta
          label="GC Content"
          before={stats.gcBefore}
          after={stats.gcAfter}
          unit="%"
        />
        <StatDelta
          label="CpG Sites"
          before={stats.cpgBefore}
          after={stats.cpgAfter}
          lowerIsBetter
        />
        <div className="bg-muted/50 flex flex-col rounded-lg border p-3">
          <span className="text-muted-foreground text-xs font-medium">
            Positions Changed
          </span>
          <span className="mt-1 text-sm font-medium tabular-nums">
            {stats.changedPositions.toLocaleString()}
          </span>
          <span className="text-muted-foreground mt-1.5 text-[10px]">
            {stats.changePercent.toFixed(1)}% of sequence
          </span>
        </div>
        <div className="bg-muted/50 flex flex-col rounded-lg border p-3">
          <span className="text-muted-foreground text-xs font-medium">
            Sequence Identity
          </span>
          <span className="mt-1 text-sm font-medium tabular-nums">
            {(100 - stats.changePercent).toFixed(1)}%
          </span>
          <span className="text-muted-foreground mt-1.5 text-[10px]">
            {(stats.len - stats.changedPositions).toLocaleString()} of{' '}
            {stats.len.toLocaleString()} bp preserved
          </span>
        </div>
      </div>
    </div>
  )
}
