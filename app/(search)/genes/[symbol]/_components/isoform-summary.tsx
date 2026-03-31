'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { SPECIES_DISPLAY_NAME } from '@/lib/species'
import { hasStartCodon, getStopCodonStatus } from '@/lib/sequence-utils'
import { useSpeciesContext } from '@/context/species-context'
import type { IsoformListItem } from '@/lib/domain-types'

interface IsoformSummaryProps {
  isoforms: IsoformListItem[]
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

  const stats = useMemo(() => {
    if (filtered.length === 0) return null

    const lengths = filtered.map((i) => i.codingSequenceLength)
    const shortest = Math.min(...lengths)
    const longest = Math.max(...lengths)

    const speciesCounts = filtered.reduce(
      (acc, i) => {
        const s = i.species as keyof typeof SPECIES_DISPLAY_NAME
        acc[s] = (acc[s] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const recommended = filtered.find(
      (i) =>
        hasStartCodon(i.codingSequence) &&
        getStopCodonStatus(i.codingSequence) === 'present' &&
        i.codingSequence.length % 3 === 0 &&
        i.codingSequenceLength <= 4700,
    )

    return { shortest, longest, speciesCounts, recommended }
  }, [filtered])

  if (!stats) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-4 py-3 text-sm">
      <Stat label="Isoforms" value={String(filtered.length)} />
      <Stat
        label="CDS range"
        value={`${stats.shortest.toLocaleString()} – ${stats.longest.toLocaleString()} bp`}
      />
      {Object.entries(stats.speciesCounts).map(([s, count]) => (
        <div key={s} className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {SPECIES_DISPLAY_NAME[s as keyof typeof SPECIES_DISPLAY_NAME]}
          </Badge>
          <span className="text-muted-foreground">{count}</span>
        </div>
      ))}
      {stats.recommended && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Recommended</span>
          <span className="font-mono text-xs">{stats.recommended.enst}</span>
        </div>
      )}
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
