import { useMemo } from 'react'
import { toCodons } from '@/lib/bio/genetic-code'
import { getRelativePreference } from '../utils/codon-preference'
import { type Species } from '@/lib/bio/species'
import { ChartDataTable } from '@/components/chart-data-table'
import { designToolCopy } from '../copy'

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
  /** The codons themselves, so the table can name what changed. */
  from: string
  to: string
}

/**
 * Per-codon preference delta (after − before) for a species. Green =
 * became more preferred (blue), less preferred (orange), muted = unchanged.
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
      cells.push({ idx: i, before: pb, after: pa, delta, from: b, to: a })
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
        <span className="type-micro text-muted-foreground tabular-nums">
          mean {(meanBefore * 100).toFixed(0)}% → {(meanAfter * 100).toFixed(0)}
          %
          <span
            className={
              meanShift > 0
                ? 'ml-1 text-success-soft'
                : meanShift < 0
                  ? 'ml-1 text-danger-soft'
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
            // Improvement: blue, intensity scaled by magnitude. Blue/orange
            // (not green/red) so the scale survives red-green color blindness.
            color = `color-mix(in oklch, var(--chart-1) ${Math.round((0.3 + Math.min(Math.abs(d), 1) * 0.7) * 100)}%, transparent)`
          } else if (d < -0.05) {
            color = `color-mix(in oklch, var(--chart-2) ${Math.round((0.3 + Math.min(Math.abs(d), 1) * 0.7) * 100)}%, transparent)`
          } else {
            color =
              'color-mix(in oklch, var(--muted-foreground) 25%, transparent)'
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
      <div className="flex items-center gap-1 type-micro text-muted-foreground">
        <span>regressed</span>
        <span className="h-2 flex-1 rounded-sm bg-gradient-to-r from-chart-2/70 via-muted-foreground/25 to-chart-1/70" />
        <span>improved</span>
      </div>
      {/* Only the codons that changed: an unchanged codon is not a data point
          the reader is looking for, and there can be hundreds of them. */}
      <ChartDataTable
        storageKey="codon-delta"
        caption={designToolCopy.results.charts.codonDelta.caption}
        columns={designToolCopy.results.charts.codonDelta.columns}
        rows={cells
          .filter((cell) => cell.from !== cell.to)
          .map((cell) => [
            cell.idx + 1,
            cell.from,
            cell.before === null
              ? '\u2014'
              : Number((cell.before * 100).toFixed(1)),
            cell.to,
            cell.after === null
              ? '\u2014'
              : Number((cell.after * 100).toFixed(1)),
          ])}
        csvFilename="codon-usage-delta.csv"
      />
    </div>
  )
}
