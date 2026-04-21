'use client'

import { useMemo } from 'react'
import { toCodons } from '@/lib/bio/genetic-code'
import { getRelativePreference } from '@/lib/bio/codon-usage'
import { type Species } from '@/lib/bio/species'

interface Props {
  original: string
  optimized: string
  species: Species
}

const MAX_CELLS = 2000

interface CellDelta {
  idx: number
  before: number | null
  after: number | null
  delta: number | null
}

/**
 * Per-codon preference delta (after − before) for a species. Green =
 * became more preferred, red = became less preferred, muted = unchanged.
 * Makes the optimizer's work visible codon-by-codon.
 */
export function CodonDeltaStrip({ original, optimized, species }: Props) {
  const { cells, improved, regressed, meanBefore, meanAfter } = useMemo(() => {
    const beforeCodons = toCodons(original)
    const afterCodons = toCodons(optimized)
    const n = Math.min(beforeCodons.length, afterCodons.length)
    const limit = Math.min(n, MAX_CELLS)
    const cells: CellDelta[] = []
    let improvedCount = 0
    let regressedCount = 0
    let sumBefore = 0
    let sumAfter = 0
    let scored = 0

    for (let i = 0; i < limit; i++) {
      const b = beforeCodons[i].toUpperCase().replace(/U/g, 'T')
      const a = afterCodons[i].toUpperCase().replace(/U/g, 'T')
      const pb = getRelativePreference(b, species)
      const pa = getRelativePreference(a, species)
      let delta: number | null = null
      if (pb !== null && pa !== null) {
        delta = pa - pb
        sumBefore += pb
        sumAfter += pa
        scored++
        if (delta > 0.05) improvedCount++
        else if (delta < -0.05) regressedCount++
      }
      cells.push({ idx: i, before: pb, after: pa, delta })
    }

    return {
      cells,
      improved: improvedCount,
      regressed: regressedCount,
      meanBefore: scored > 0 ? sumBefore / scored : 0,
      meanAfter: scored > 0 ? sumAfter / scored : 0,
    }
  }, [original, optimized, species])

  if (cells.length === 0) return null

  const meanShift = (meanAfter - meanBefore) * 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-end">
        <span className="text-muted-foreground text-[10px] tabular-nums">
          mean {(meanBefore * 100).toFixed(0)}% → {(meanAfter * 100).toFixed(0)}
          %
          <span
            className={
              meanShift > 0
                ? 'ml-1 text-emerald-600 dark:text-emerald-400'
                : meanShift < 0
                  ? 'ml-1 text-red-600 dark:text-red-400'
                  : 'ml-1'
            }
          >
            ({meanShift >= 0 ? '+' : ''}
            {meanShift.toFixed(0)}%)
          </span>
          <span className="ml-2">
            {improved} improved · {regressed} regressed
          </span>
        </span>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-sm border"
        role="img"
        aria-label="Codon preference delta strip"
      >
        {cells.map((cell) => {
          const d = cell.delta
          let color: string
          if (d === null) {
            color = 'transparent'
          } else if (d > 0.05) {
            // Improvement: emerald, intensity scaled by magnitude.
            color = `rgba(16, 185, 129, ${0.3 + Math.min(Math.abs(d), 1) * 0.7})`
          } else if (d < -0.05) {
            color = `rgba(239, 68, 68, ${0.3 + Math.min(Math.abs(d), 1) * 0.7})`
          } else {
            color = 'rgba(148, 163, 184, 0.25)' // slate-400/25 = unchanged
          }
          return (
            <div
              key={cell.idx}
              className="h-full min-w-px flex-1"
              style={{ backgroundColor: color }}
              title={
                cell.before !== null && cell.after !== null
                  ? `Codon ${cell.idx + 1}: ${(cell.before * 100).toFixed(0)}% → ${(cell.after * 100).toFixed(0)}% (${d !== null && d >= 0 ? '+' : ''}${d !== null ? (d * 100).toFixed(0) : '?'}%)`
                  : `Codon ${cell.idx + 1}`
              }
            />
          )
        })}
      </div>
      <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
        <span>regressed</span>
        <span className="h-2 flex-1 rounded-sm bg-gradient-to-r from-red-500/70 via-slate-400/25 to-emerald-500/70" />
        <span>improved</span>
      </div>
    </div>
  )
}
