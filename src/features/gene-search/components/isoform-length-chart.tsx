'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { m } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'
import { useSpeciesContext } from '@/stores/species-store'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'

interface Props {
  isoforms: IsoformListItem[]
}

// AAV packaging thresholds from design-suitability.ts
const SINGLE_AAV_MAX = 4000
const DUAL_AAV_MAX = 8000

/**
 * Horizontal bar chart of isoform CDS lengths, color-coded by AAV suitability.
 * Sits under the isoform summary and gives an immediate read on which isoforms
 * fit which packaging strategy.
 */
export function IsoformLengthChart({ isoforms }: Props) {
  const { species } = useSpeciesContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buildHref = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('isoform', id)
    return `${pathname}?${params.toString()}#isoform-row-${id}`
  }

  const { rows, scaleMax } = useMemo(() => {
    const filtered = isoforms.filter((i) => {
      if (!species || species === 'both') return true
      return i.species.toLowerCase() === species
    })
    // Sort by CDS length ascending so the chart reads as a gradient.
    filtered.sort((a, b) => a.codingSequenceLength - b.codingSequenceLength)
    const maxLen = filtered.reduce(
      (m, i) => Math.max(m, i.codingSequenceLength),
      0,
    )
    // Scale axis to just past the longest isoform, with a floor so short
    // isoforms don't get lost.
    const scaleMax = Math.max(maxLen * 1.05, DUAL_AAV_MAX + 500)
    const rows = filtered.map((i) => ({
      id: i.id,
      length: i.codingSequenceLength,
      suitability: assessDesignSuitability(i.codingSequence),
    }))
    return { rows, scaleMax }
  }, [isoforms, species])

  if (rows.length < 2) return null

  const singlePct = (SINGLE_AAV_MAX / scaleMax) * 100
  const dualPct = (DUAL_AAV_MAX / scaleMax) * 100

  return (
    <div className="mb-4 space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="text-muted-foreground size-4" />
          CDS length by isoform
        </div>
        <div className="type-micro flex items-center gap-3">
          {(['single-aav', 'dual-aav', 'triple-aav'] as const).map((s) => {
            const cfg = getSuitabilityConfig(s)
            return (
              <span
                key={s}
                className="text-muted-foreground flex items-center gap-1"
              >
                <span className={cn('size-2 rounded-sm', cfg.fillClass)} />
                {cfg.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((row, i) => {
          const pct = (row.length / scaleMax) * 100
          const cfg = getSuitabilityConfig(row.suitability)
          return (
            <Link
              key={row.id}
              href={buildHref(row.id)}
              scroll={false}
              className="group hover:bg-muted/40 focus-visible:ring-ring type-micro -mx-1 flex items-center gap-2 rounded-sm px-1 py-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              title={`${row.id} · ${row.length.toLocaleString()} bp · ${cfg.label}`}
              aria-label={`${row.id}, ${row.length.toLocaleString()} base pairs, ${cfg.label}`}
            >
              <span className="text-muted-foreground group-hover:text-foreground w-28 shrink-0 truncate font-mono">
                {row.id}
              </span>
              <div className="bg-muted/30 relative h-3 flex-1 overflow-hidden rounded-sm">
                <m.div
                  className={cn(
                    'h-full origin-left transition-opacity group-hover:opacity-100',
                    cfg.fillClass,
                  )}
                  style={{ width: `${pct}%` }}
                  initial={{ scaleX: 0, opacity: 0.6 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{
                    duration: 0.6,
                    delay: Math.min(i * 0.04, 0.4),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
                <div
                  className="bg-border/80 pointer-events-none absolute inset-y-0 w-px"
                  style={{ left: `${singlePct}%` }}
                  aria-hidden="true"
                />
                <div
                  className="bg-border/80 pointer-events-none absolute inset-y-0 w-px"
                  style={{ left: `${dualPct}%` }}
                  aria-hidden="true"
                />
              </div>
              <span
                className="text-muted-foreground w-6 shrink-0 text-center font-mono tabular-nums"
                aria-hidden="true"
              >
                {cfg.short}
              </span>
              <span className="text-muted-foreground w-16 shrink-0 text-right font-mono tabular-nums">
                {row.length.toLocaleString()}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="text-muted-foreground type-micro flex items-center gap-2 tabular-nums">
        <span className="w-28 shrink-0" />
        <div className="relative h-3 flex-1">
          <span className="absolute left-0">0</span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${singlePct}%` }}
          >
            {SINGLE_AAV_MAX.toLocaleString()}
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${dualPct}%` }}
          >
            {DUAL_AAV_MAX.toLocaleString()}
          </span>
        </div>
        <span className="w-16 shrink-0 text-right">bp</span>
      </div>
    </div>
  )
}
