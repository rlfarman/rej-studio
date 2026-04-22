'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSpeciesContext } from '@/stores/species-store'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
  type Suitability,
} from '@/lib/bio/design-suitability'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'

interface IsoformSummaryProps {
  isoforms: IsoformListItem[]
}

const SUITABILITY_ORDER: Suitability[] = [
  'single-aav',
  'dual-aav',
  'triple-aav',
]

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
      <Stat label="Isoforms" value={String(filtered.length)} />
      <Stat
        label="CDS range"
        value={`${stats.shortest.toLocaleString()} – ${stats.longest.toLocaleString()} bp`}
      />
      <div
        className="flex items-center gap-1.5"
        role="img"
        aria-label="AAV suitability distribution"
      >
        <span className="text-muted-foreground">AAV fit</span>
        <span className="flex items-center gap-2 tabular-nums">
          {SUITABILITY_ORDER.filter((s) => counts[s] > 0).map((s) => {
            const cfg = getSuitabilityConfig(s)
            return (
              <span
                key={s}
                className="flex items-center gap-1"
                title={`${cfg.label} · ${counts[s]} isoform${counts[s] > 1 ? 's' : ''}`}
              >
                <span className={cn('size-1.5 rounded-full', cfg.dotClass)} />
                <span className={cn('font-medium', cfg.textClass)}>
                  {counts[s]}
                </span>
              </span>
            )
          })}
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
