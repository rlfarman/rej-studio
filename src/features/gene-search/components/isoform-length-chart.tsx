'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { m } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'
import { useSpeciesContext } from '@/stores/species-store'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { lengthChartModel } from '@/features/gene-search/utils/length-chart'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.lengthChart

interface Props {
  isoforms: IsoformListItem[]
}

/**
 * CDS length per isoform against AAV packaging limits. Only rendered when
 * the isoforms span capacity tiers (see lengthChartModel); for single-AAV
 * genes it would just restate the table's CDS column.
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

  const { rows, model } = useMemo(() => {
    const filtered = isoforms
      .filter((i) => {
        if (!species || species === 'both') return true
        return i.species.toLowerCase() === species
      })
      // Shortest first so the bars read as a ramp toward the limits.
      .sort((a, b) => a.codingSequenceLength - b.codingSequenceLength)
    const rows = filtered.map((i) => ({
      id: i.id,
      length: i.codingSequenceLength,
      suitability: assessDesignSuitability(i.codingSequence),
    }))
    return { rows, model: lengthChartModel(rows) }
  }, [isoforms, species])

  if (!model.show) return null

  const pct = (bp: number) => (bp / model.scaleMax) * 100

  return (
    <section className="space-y-3" aria-labelledby="length-chart-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="length-chart-title" className="text-sm font-medium">
          {copy.title}
        </h2>
        <div className="type-micro flex flex-wrap items-center gap-3">
          {(['single-aav', 'dual-aav', 'triple-aav'] as const).map((s) => {
            const cfg = getSuitabilityConfig(s)
            return (
              <span
                key={s}
                className="text-muted-foreground flex items-center gap-1"
              >
                <span
                  className={cn('size-2 rounded-sm', cfg.fillClass)}
                  aria-hidden="true"
                />
                {cfg.label}
              </span>
            )
          })}
        </div>
      </div>

      <ul className="space-y-1">
        {rows.map((row, i) => {
          const cfg = getSuitabilityConfig(row.suitability)
          return (
            <li key={row.id}>
              <Link
                href={buildHref(row.id)}
                scroll={false}
                className="group hover:bg-muted/40 focus-visible:ring-ring type-micro -mx-1 grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 rounded-sm px-1 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:grid-cols-[8rem_1fr_2rem_4rem]"
                aria-label={`${row.id}, ${row.length.toLocaleString()} base pairs, ${cfg.label}`}
              >
                {/* On phones only the transcript suffix fits; the full ID is
                    in the accessible name and the table row it links to. */}
                <span className="text-muted-foreground group-hover:text-foreground truncate font-mono">
                  <span className="hidden sm:inline">{row.id}</span>
                  <span className="sm:hidden">…{row.id.slice(-6)}</span>
                </span>
                <div className="bg-muted/30 relative h-3 overflow-hidden rounded-sm">
                  <m.div
                    className={cn('h-full origin-left', cfg.fillClass)}
                    style={{ width: `${pct(row.length)}%` }}
                    initial={{ scaleX: 0, opacity: 0.6 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{
                      duration: 0.6,
                      delay: Math.min(i * 0.04, 0.4),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                  {model.thresholds.map((limit) => (
                    <div
                      key={limit}
                      className="bg-foreground/30 pointer-events-none absolute inset-y-0 w-px"
                      style={{ left: `${pct(limit)}%` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span
                  className="text-muted-foreground hidden text-center font-mono tabular-nums sm:inline"
                  aria-hidden="true"
                >
                  {cfg.short}
                </span>
                <span className="text-muted-foreground text-right font-mono tabular-nums">
                  {row.length.toLocaleString()}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div
        className="text-muted-foreground type-micro grid grid-cols-[5.5rem_1fr_3.5rem] gap-2 tabular-nums sm:grid-cols-[8rem_1fr_2rem_4rem]"
        aria-hidden="true"
      >
        <span />
        <div className="relative h-3">
          <span className="absolute left-0">0</span>
          {model.thresholds.map((limit) => (
            <span
              key={limit}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct(limit)}%` }}
            >
              {copy.capacityLabel(limit.toLocaleString())}
            </span>
          ))}
        </div>
        <span className="hidden sm:inline" />
        <span className="text-right">{copy.unit}</span>
      </div>
    </section>
  )
}
