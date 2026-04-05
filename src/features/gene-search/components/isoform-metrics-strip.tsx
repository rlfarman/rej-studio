'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  computeGcPercent,
  countCpG,
  rankWggwByBalance,
} from '@/lib/bio/sequence-utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'

interface IsoformMetricsStripProps {
  codingSequence: string
}

function MetricCell({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="bg-muted/30 min-w-0 px-3 py-2">
      <div className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className={cn('text-sm tabular-nums', valueClassName)}>{value}</div>
    </div>
  )
}

export function IsoformMetricsStrip({
  codingSequence,
}: IsoformMetricsStripProps) {
  const metrics = useMemo(() => {
    const seq = codingSequence.toUpperCase()
    const bp = seq.length
    const gc = computeGcPercent(seq)
    const cpg = countCpG(seq)
    const wggwCount = rankWggwByBalance(seq).length
    const suitability = assessDesignSuitability(seq)
    const suitabilityLabel = getSuitabilityConfig(suitability).label

    // Mirrors the thresholds in gcCheck (diag-badge.tsx:80-94)
    const gcClass =
      gc >= 35 && gc <= 60
        ? 'text-emerald-600 dark:text-emerald-400'
        : gc >= 25 && gc <= 70
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400'

    return {
      bp,
      gc,
      gcClass,
      cpg,
      wggwCount,
      suitabilityLabel,
    }
  }, [codingSequence])

  return (
    <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-5">
      <MetricCell label="Length" value={`${metrics.bp.toLocaleString()} bp`} />
      <MetricCell
        label="GC %"
        value={`${metrics.gc.toFixed(1)}%`}
        valueClassName={metrics.gcClass}
      />
      <MetricCell label="CpG" value={metrics.cpg.toLocaleString()} />
      <MetricCell
        label="WGGW motifs"
        value={metrics.wggwCount.toLocaleString()}
      />
      <MetricCell label="AAV strategy" value={metrics.suitabilityLabel} />
    </div>
  )
}
