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
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          <Sparkles className="text-muted-foreground size-3" />
          Codon preference · {SPECIES_DISPLAY_NAME[species]}
        </div>
        <span className="text-muted-foreground text-[10px] tabular-nums">
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
          // Map pref [0,1] to a color: red (0) → amber (0.5) → emerald (1).
          const p = cell.pref
          const color =
            p === null
              ? 'rgb(var(--muted))'
              : p >= 0.7
                ? `rgba(16, 185, 129, ${0.4 + p * 0.6})` // emerald
                : p >= 0.4
                  ? `rgba(234, 179, 8, ${0.5 + p * 0.4})` // amber
                  : `rgba(239, 68, 68, ${0.5 + (1 - p) * 0.4})` // red
          return (
            <div
              key={cell.idx}
              className="h-full min-w-px flex-1"
              style={{ backgroundColor: color }}
              title={
                p !== null
                  ? `Codon ${cell.idx + 1}: ${cell.codon} — ${(p * 100).toFixed(0)}% of best synonymous`
                  : `Codon ${cell.idx + 1}: ${cell.codon}`
              }
            />
          )
        })}
      </div>
      <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
        <span>rare</span>
        <span className="h-2 flex-1 rounded-sm bg-gradient-to-r from-red-500/80 via-amber-500/80 to-emerald-500/80" />
        <span>preferred</span>
      </div>
    </div>
  )
}
