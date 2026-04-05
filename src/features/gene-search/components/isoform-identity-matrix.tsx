'use client'

import { useMemo } from 'react'
import { Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeciesContext } from '@/stores/species-store'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'

interface Props {
  isoforms: IsoformListItem[]
}

const MAX_ISOFORMS = 16
const MIN_ISOFORMS = 2

/**
 * Compute % protein-sequence identity between two isoforms using end-anchored
 * prefix/suffix overlap. Most isoforms differ by exon inclusion, so they share
 * large contiguous blocks at the start and end — this catches those cases
 * cheaply without a full alignment.
 */
function proteinIdentity(a: string, b: string): number {
  if (a === b) return 100
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length === 0) return 0

  // Shared prefix.
  let prefix = 0
  while (prefix < shorter.length && shorter[prefix] === longer[prefix]) prefix++

  // Shared suffix.
  let suffix = 0
  while (
    suffix < shorter.length - prefix &&
    shorter[shorter.length - 1 - suffix] === longer[longer.length - 1 - suffix]
  ) {
    suffix++
  }

  const matches = prefix + suffix
  return (matches / longer.length) * 100
}

/**
 * Triangular heatmap of pairwise % identity between isoform protein
 * sequences. Surfaces near-duplicate isoforms so users don't waste time
 * optimizing functionally redundant transcripts separately.
 *
 * Identity is computed as prefix+suffix match / longer protein length.
 * This is a fast proxy, not a full alignment — good enough to cluster
 * isoforms by similarity but not for exact percent identity claims.
 */
export function IsoformIdentityMatrix({ isoforms }: Props) {
  const { species } = useSpeciesContext()

  const { rows, ids } = useMemo(() => {
    const filtered = isoforms.filter((i) => {
      if (!species || species === 'both') return true
      return i.species.toLowerCase() === species
    })
    // Sort by protein length descending so the longest (usually canonical)
    // isoform is in the top-left corner.
    const sorted = [...filtered].sort(
      (a, b) => b.proteinSequenceLength - a.proteinSequenceLength,
    )
    const trimmed = sorted.slice(0, MAX_ISOFORMS)
    const ids = trimmed.map((i) => i.id)
    const rows = trimmed.map((a) =>
      trimmed.map((b) => proteinIdentity(a.proteinSequence, b.proteinSequence)),
    )
    return { rows, ids }
  }, [isoforms, species])

  if (ids.length < MIN_ISOFORMS) return null

  return (
    <div className="mb-4 space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Grid3x3 className="text-muted-foreground size-4" />
          Pairwise identity
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
          <span>0%</span>
          <span className="h-2 w-20 rounded-sm bg-gradient-to-r from-slate-200 via-amber-400 to-emerald-600 dark:from-slate-800" />
          <span>100%</span>
        </div>
      </div>

      <div className="overflow-x-auto pt-8">
        <div
          className="inline-grid gap-[1px] text-[9px]"
          style={{
            gridTemplateColumns: `minmax(7rem, max-content) repeat(${ids.length}, minmax(1.25rem, 1fr))`,
          }}
        >
          {/* header row: blank corner + column labels (last 4 chars; full ID on hover) */}
          <div />
          {ids.map((id) => (
            <div
              key={`col-${id}`}
              className="text-muted-foreground relative font-mono"
              title={id}
            >
              <span className="absolute bottom-0 left-1/2 origin-bottom-left -translate-x-1/2 rotate-[-60deg] whitespace-nowrap">
                …{id.slice(-4)}
              </span>
            </div>
          ))}

          {rows.map((row, i) => (
            <Row key={ids[i]} id={ids[i]} values={row} i={i} />
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        Identity estimated from shared prefix + suffix of protein sequences.
        Pairs ≥95% share most coding content — consider optimizing one per
        cluster.
      </p>
    </div>
  )
}

function Row({ id, values, i }: { id: string; values: number[]; i: number }) {
  return (
    <>
      <div
        className="text-muted-foreground pr-2 text-right font-mono whitespace-nowrap"
        title={id}
      >
        {id}
      </div>
      {values.map((v, j) => {
        // Upper triangle only — mirror suppressed to reduce visual noise.
        const hidden = j > i
        return (
          <div
            key={j}
            className={cn(
              'aspect-square min-h-4 min-w-4',
              hidden && 'opacity-0',
            )}
            style={{
              backgroundColor: hidden ? 'transparent' : identityColor(v),
            }}
            title={hidden ? undefined : `${v.toFixed(1)}% identity`}
          />
        )
      })}
    </>
  )
}

function identityColor(pct: number): string {
  // 0–50% → slate, 50–85% → amber, 85–100% → emerald. Alpha ramps with
  // magnitude so the diagonal (100%) is most saturated.
  if (pct >= 85) {
    const a = 0.4 + ((pct - 85) / 15) * 0.55
    return `rgba(16, 185, 129, ${a})` // emerald
  }
  if (pct >= 50) {
    const a = 0.25 + ((pct - 50) / 35) * 0.5
    return `rgba(234, 179, 8, ${a})` // amber
  }
  const a = 0.15 + (pct / 50) * 0.3
  return `rgba(148, 163, 184, ${a})` // slate
}
