'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSpeciesContext } from '@/stores/species-store'
import {
  assessDesignSuitability,
  type Suitability,
} from '@/lib/bio/design-suitability'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { geneSearchCopy } from '@/features/gene-search/copy'

interface IsoformSummaryProps {
  isoforms: IsoformListItem[]
}

const SUITABILITY_ORDER: Suitability[] = [
  'single-aav',
  'dual-aav',
  'triple-aav',
]

const SUITABILITY_COLOR: Record<Suitability, string> = {
  'single-aav': 'bg-emerald-500/70',
  'dual-aav': 'bg-amber-500/70',
  'triple-aav': 'bg-red-500/70',
}

const SUITABILITY_LABEL: Record<Suitability, string> = {
  'single-aav': geneSearchCopy.isoformSummary.suitabilityShortLabels.single,
  'dual-aav': geneSearchCopy.isoformSummary.suitabilityShortLabels.dual,
  'triple-aav': geneSearchCopy.isoformSummary.suitabilityShortLabels.triple,
}

export function IsoformSummary({ isoforms }: IsoformSummaryProps) {
  const { species } = useSpeciesContext()

  const filtered = useMemo(
    () =>
      isoforms.filter((i) => {
        if (!species || species === 'both') return true
        return i.species.toLowerCase() === species
      }),
    [species, isoforms],
  )

  const { stats, counts } = useMemo(() => {
    if (filtered.length === 0) return { stats: null, counts: null }

    const lengths = filtered.map((i) => i.codingSequenceLength)
    const shortest = Math.min(...lengths)
    const longest = Math.max(...lengths)

    const counts: Record<Suitability, number> = {
      'single-aav': 0,
      'dual-aav': 0,
      'triple-aav': 0,
    }
    for (const i of filtered) {
      counts[assessDesignSuitability(i.codingSequence)]++
    }

    return { stats: { shortest, longest }, counts }
  }, [filtered])

  if (!stats || !counts) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border px-4 py-3 text-sm">
      <Stat
        label={geneSearchCopy.isoformSummary.isoforms}
        value={String(filtered.length)}
      />
      <Stat
        label={geneSearchCopy.isoformSummary.cdsRange}
        value={`${stats.shortest.toLocaleString()} – ${stats.longest.toLocaleString()} bp`}
      />
      <div className="flex min-w-[12rem] flex-1 items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {geneSearchCopy.isoformSummary.aavFit}
        </span>
        <div
          className="flex h-4 flex-1 overflow-hidden rounded-sm border"
          role="img"
          aria-label={geneSearchCopy.isoformSummary.aavFitAriaLabel}
        >
          {SUITABILITY_ORDER.map((s) => {
            if (counts[s] === 0) return null
            const pct = (counts[s] / filtered.length) * 100
            return (
              <div
                key={s}
                className={cn(
                  'flex items-center justify-center text-[9px] font-medium text-white',
                  SUITABILITY_COLOR[s],
                )}
                style={{ width: `${pct}%` }}
                title={geneSearchCopy.isoformSummary.aavSegmentTooltip(
                  SUITABILITY_LABEL[s],
                  counts[s],
                )}
              >
                {pct > 12 ? counts[s] : ''}
              </div>
            )
          })}
        </div>
        <span className="text-muted-foreground flex items-center gap-2 text-[10px] tabular-nums">
          {SUITABILITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('size-2 rounded-sm', SUITABILITY_COLOR[s])} />
              {counts[s]}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
