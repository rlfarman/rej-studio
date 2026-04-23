'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { toCodons } from '@/lib/bio/genetic-code'
import { getRelativePreference } from '@/lib/bio/codon-usage'
import { SPECIES_DISPLAY_NAME, type Species } from '@/lib/bio/species'

interface Props {
  sequence: string
  species: Species
}

const MAX_CELLS_RENDERED = 2000

/**
 * Per-codon heatmap showing how preferred each codon is among its synonymous
 * group for the selected species. Green = highly preferred, red = rare.
 * Renders a compact strip of thin cells — one per codon.
 */
export function CodonUsageStrip({ sequence, species }: Props) {
  const { cells, rareCount, meanPref, totalCodons } = useMemo(() => {
    const codons = toCodons(sequence)
    const total = codons.length
    const limit = Math.min(total, MAX_CELLS_RENDERED)
    const cells: { idx: number; codon: string; pref: number | null }[] = []
    let rare = 0
    let sum = 0
    let scored = 0

    for (let i = 0; i < limit; i++) {
      const codon = codons[i].toUpperCase().replace(/U/g, 'T')
      const pref = getRelativePreference(codon, species)
      cells.push({ idx: i, codon, pref })
      if (pref !== null) {
        sum += pref
        scored++
        if (pref < 0.4) rare++
      }
    }
    return {
      cells,
      rareCount: rare,
      meanPref: scored > 0 ? sum / scored : 0,
      totalCodons: total,
    }
  }, [sequence, species])

  if (cells.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="type-nano flex items-center gap-1.5 font-medium">
          <Sparkles className="text-muted-foreground size-3" />
          Codon preference · {SPECIES_DISPLAY_NAME[species]}
        </div>
        <span className="text-muted-foreground type-micro tabular-nums">
          mean {(meanPref * 100).toFixed(0)}% · {rareCount.toLocaleString()}{' '}
          rare
          {totalCodons > cells.length && (
            <>
              {' '}
              · showing first {cells.length.toLocaleString()} of{' '}
              {totalCodons.toLocaleString()}
            </>
          )}
        </span>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-sm border"
        role="img"
        aria-label={`Codon usage preference strip for ${SPECIES_DISPLAY_NAME[species]}`}
      >
        {cells.map((cell) => {
          const p = cell.pref
          const bucket =
            p === null
              ? 'var(--codon-null)'
              : p >= 0.7
                ? 'var(--codon-preferred)'
                : p >= 0.4
                  ? 'var(--codon-mid)'
                  : 'var(--codon-rare)'
          const alpha =
            p === null
              ? 1
              : p >= 0.7
                ? 0.4 + p * 0.6
                : p >= 0.4
                  ? 0.5 + p * 0.4
                  : 0.5 + (1 - p) * 0.4
          return (
            <div
              key={cell.idx}
              className="h-full min-w-0 flex-1"
              style={{
                backgroundColor: `color-mix(in oklch, ${bucket} ${Math.round(alpha * 100)}%, transparent)`,
              }}
              title={
                p !== null
                  ? `Codon ${cell.idx + 1}: ${cell.codon} — ${(p * 100).toFixed(0)}% of best synonymous`
                  : `Codon ${cell.idx + 1}: ${cell.codon}`
              }
            />
          )
        })}
      </div>
      <div className="text-muted-foreground type-micro flex items-center gap-1">
        <span>rare</span>
        <span
          className="h-2 flex-1 rounded-sm"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--codon-rare), var(--codon-mid), var(--codon-preferred))',
          }}
        />
        <span>preferred</span>
      </div>
    </div>
  )
}
