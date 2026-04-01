'use client'

import { useMemo } from 'react'
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

    const recommended = filtered.find(
      (i) =>
        hasStartCodon(i.codingSequence) &&
        getStopCodonStatus(i.codingSequence) === 'present' &&
        i.codingSequence.length % 3 === 0 &&
        i.codingSequenceLength <= 4700,
    )

    return { shortest, longest, recommended }
  }, [filtered])

  if (!stats) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-4 py-3 text-sm">
      <Stat label="Isoforms" value={String(filtered.length)} />
      <Stat
        label="CDS range"
        value={`${stats.shortest.toLocaleString()} – ${stats.longest.toLocaleString()} bp`}
      />
      {stats.recommended && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Recommended</span>
          <span className="font-mono text-xs">{stats.recommended.id}</span>
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
