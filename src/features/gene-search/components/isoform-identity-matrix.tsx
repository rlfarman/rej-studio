'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeciesContext } from '@/stores/species-store'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'

interface Props {
  isoforms: IsoformListItem[]
  // Precomputed at build time by scripts/emit-content.ts. `ids` lists the
  // top-N isoforms by protein length descending (matches the heatmap order);
  // `rows[i][j]` is the % protein-sequence identity between ids[i] and ids[j].
  matrix: { ids: string[]; rows: number[][] }
}

const MIN_ISOFORMS = 2

/**
 * Triangular heatmap of pairwise % identity between isoform protein
 * sequences. Surfaces near-duplicate isoforms so users don't waste time
 * optimizing functionally redundant transcripts separately.
 *
 * Identity is computed at build time as prefix+suffix match / longer protein
 * length — fast proxy, not a full alignment, good enough to cluster isoforms
 * by similarity but not for exact percent identity claims.
 */
export function IsoformIdentityMatrix({ isoforms, matrix }: Props) {
  const { species } = useSpeciesContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buildHref = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('isoform', id)
    return `${pathname}?${params.toString()}#isoform-row-${id}`
  }

  // The precomputed matrix covers all isoforms across both species. Trim
  // rows/columns to those that match the active species filter.
  const { rows, ids } = useMemo(() => {
    const speciesById = new Map(isoforms.map((i) => [i.id, i.species]))
    const allowed = matrix.ids.map((id) => {
      if (!species || species === 'both') return true
      return (speciesById.get(id) ?? '').toLowerCase() === species
    })
    const keptIds = matrix.ids.filter((_, i) => allowed[i])
    const keptRows = matrix.rows
      .filter((_, i) => allowed[i])
      .map((row) => row.filter((_, j) => allowed[j]))
    return { rows: keptRows, ids: keptIds }
  }, [matrix, isoforms, species])

  if (ids.length < MIN_ISOFORMS) return null

  return (
    <div className="mb-4 space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Grid3x3 className="text-muted-foreground size-4" />
          Pairwise identity
        </div>
        <div className="text-muted-foreground type-micro flex items-center gap-2">
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
            <Row
              key={ids[i]}
              id={ids[i]}
              values={row}
              i={i}
              href={buildHref(ids[i])}
            />
          ))}
        </div>
      </div>

      <p className="text-muted-foreground type-micro leading-relaxed">
        Identity estimated from shared prefix + suffix of protein sequences.
        Pairs ≥95% share most coding content — consider optimizing one per
        cluster.
      </p>
    </div>
  )
}

function Row({
  id,
  values,
  i,
  href,
}: {
  id: string
  values: number[]
  i: number
  href: string
}) {
  return (
    <>
      <Link
        href={href}
        scroll={false}
        className="text-muted-foreground hover:text-foreground focus-visible:text-foreground pr-2 text-right font-mono whitespace-nowrap hover:underline focus-visible:outline-none"
        title={`Jump to ${id}`}
      >
        {id}
      </Link>
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
