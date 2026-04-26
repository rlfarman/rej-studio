'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  findRestrictionSites,
  type RestrictionHit,
} from '@/lib/bio/restriction-sites'

interface Props {
  original: string
  optimized: string
}

type Change = 'added' | 'removed' | 'kept'

interface EnzymeRow {
  enzyme: string
  before: RestrictionHit[]
  after: RestrictionHit[]
  added: number
  removed: number
}

function diffHits(
  before: RestrictionHit[],
  after: RestrictionHit[],
  windowSize: number,
): { added: number; removed: number } {
  // Positions can shift slightly after optimization. Match sites within a
  // small window to avoid double-counting stable sites as removed+added.
  const used = new Set<number>()
  let matched = 0
  for (const b of before) {
    const idx = after.findIndex(
      (a, i) => !used.has(i) && Math.abs(a.position - b.position) <= windowSize,
    )
    if (idx !== -1) {
      used.add(idx)
      matched++
    }
  }
  return { added: after.length - matched, removed: before.length - matched }
}

/**
 * Restriction enzyme site map. Shows where common Type II cutters sit
 * in the original vs optimized sequence, with added/removed counts per
 * enzyme. Users check this before ordering synthesis to make sure their
 * cloning strategy still works.
 */
export function RestrictionSiteMap({ original, optimized }: Props) {
  const { rows, maxLen, totalBefore, totalAfter } = useMemo(() => {
    const beforeHits = findRestrictionSites(original)
    const afterHits = findRestrictionSites(optimized)
    const maxLen = Math.max(original.length, optimized.length)
    // Match window: 6 bp or 0.5% of the sequence, whichever is larger. Codon
    // harmonization can shift sites by a few bp without really changing them.
    const windowSize = Math.max(6, Math.round(maxLen * 0.005))

    const enzymes = Array.from(
      new Set([...beforeHits, ...afterHits].map((h) => h.enzyme)),
    ).sort()

    const rows: EnzymeRow[] = enzymes.map((enzyme) => {
      const before = beforeHits.filter((h) => h.enzyme === enzyme)
      const after = afterHits.filter((h) => h.enzyme === enzyme)
      const { added, removed } = diffHits(before, after, windowSize)
      return { enzyme, before, after, added, removed }
    })

    return {
      rows,
      maxLen,
      totalBefore: beforeHits.length,
      totalAfter: afterHits.length,
    }
  }, [original, optimized])

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No common Type II enzyme sites found in either sequence.
      </p>
    )
  }

  const net = totalAfter - totalBefore

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="text-muted-foreground type-micro flex items-center gap-3 tabular-nums">
          <span>
            {totalBefore} → {totalAfter} total
          </span>
          <span
            className={cn(
              net > 0
                ? 'text-warning-soft'
                : net < 0
                  ? 'text-success-soft'
                  : '',
            )}
          >
            {net > 0 ? `+${net}` : net}
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-success/70 size-2 rounded-sm" /> added
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-danger/70 size-2 rounded-sm" /> removed
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-muted-foreground/50 size-2 rounded-sm" /> kept
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((row) => (
          <EnzymeTrack
            key={row.enzyme}
            row={row}
            maxLen={maxLen}
            originalLen={original.length}
            optimizedLen={optimized.length}
          />
        ))}
      </div>
    </div>
  )
}

function EnzymeTrack({
  row,
  maxLen,
  originalLen,
  optimizedLen,
}: {
  row: EnzymeRow
  maxLen: number
  originalLen: number
  optimizedLen: number
}) {
  const { beforeChanges, afterChanges } = useMemo(() => {
    const windowSize = Math.max(6, Math.round(maxLen * 0.005))
    const beforeChanges: { hit: RestrictionHit; change: Change }[] =
      row.before.map((b) => {
        const kept = row.after.some(
          (a) => Math.abs(a.position - b.position) <= windowSize,
        )
        return { hit: b, change: kept ? 'kept' : 'removed' }
      })
    const afterChanges: { hit: RestrictionHit; change: Change }[] =
      row.after.map((a) => {
        const kept = row.before.some(
          (b) => Math.abs(b.position - a.position) <= windowSize,
        )
        return { hit: a, change: kept ? 'kept' : 'added' }
      })
    return { beforeChanges, afterChanges }
  }, [row, maxLen])

  return (
    <div className="group type-micro flex items-center gap-2">
      <span className="text-muted-foreground w-16 shrink-0 truncate font-mono">
        {row.enzyme}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <Lane
          label="before"
          hits={beforeChanges}
          seqLen={originalLen}
          axisLen={maxLen}
        />
        <Lane
          label="after"
          hits={afterChanges}
          seqLen={optimizedLen}
          axisLen={maxLen}
        />
      </div>
      <span className="text-muted-foreground w-16 shrink-0 text-right font-mono tabular-nums">
        {row.added > 0 && (
          <span className="text-success-soft">+{row.added}</span>
        )}
        {row.added > 0 && row.removed > 0 && ' '}
        {row.removed > 0 && (
          <span className="text-danger-soft">−{row.removed}</span>
        )}
        {row.added === 0 && row.removed === 0 && (
          <span className="text-muted-foreground">={row.before.length}</span>
        )}
      </span>
    </div>
  )
}

function Lane({
  label,
  hits,
  seqLen,
  axisLen,
}: {
  label: string
  hits: { hit: RestrictionHit; change: Change }[]
  seqLen: number
  axisLen: number
}) {
  const lanePct = (seqLen / axisLen) * 100
  const laneLabel = `${label} strand: ${hits.length} site${hits.length === 1 ? '' : 's'}`
  return (
    <div
      className="bg-muted/30 relative h-2.5 w-full rounded-sm"
      role="img"
      aria-label={laneLabel}
    >
      <div
        className="bg-muted/50 absolute inset-y-0 left-0 rounded-sm"
        style={{ width: `${lanePct}%` }}
      />
      {hits.map((h, i) => {
        const left = ((h.hit.position - 1) / axisLen) * 100
        return (
          <span
            key={`${h.hit.position}-${i}`}
            className={cn(
              'absolute top-0 bottom-0 w-[2px] -translate-x-1/2 rounded-[1px]',
              h.change === 'added' && 'bg-success',
              h.change === 'removed' && 'bg-danger',
              h.change === 'kept' && 'bg-muted-foreground/70',
            )}
            style={{ left: `${left}%` }}
            title={`${h.hit.enzyme} ${h.hit.site} at bp ${h.hit.position} (${h.change})`}
          />
        )
      })}
    </div>
  )
}
