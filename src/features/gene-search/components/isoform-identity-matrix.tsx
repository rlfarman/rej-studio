'use client'

import { Link } from '@tanstack/react-router'
import { Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { ChartDataTable } from '@/components/chart-data-table'
import { geneSearchCopy } from '@/features/gene-search/copy'
import {
  selectIdentityIsoforms,
  type IsoformIdentityMatrix as Identities,
} from '@/features/gene-search/corpus/identity'

interface Props {
  isoforms: IsoformListItem[]
  /**
   * Stored alignment identities for `selectIdentityIsoforms(isoforms)`, or
   * null when the gene data has none (`parseIsoformIdentity`).
   */
  identity: Identities | null
}

const MIN_ISOFORMS = 2

/**
 * Identity bins, lowest to highest. Ordinal, so they map onto the single-hue
 * `seq-*` ramp (colorblind-safe: they differ in lightness, not hue). The top
 * bin is the actionable one: pairs that similar share most coding content.
 */
const BINS = [
  { min: 0, label: '<50%', className: 'bg-seq-1' },
  { min: 50, label: '50–75%', className: 'bg-seq-2' },
  { min: 75, label: '75–90%', className: 'bg-seq-3' },
  { min: 90, label: '90–95%', className: 'bg-seq-4' },
  { min: 95, label: '≥95%', className: 'bg-seq-5' },
] as const

function binFor(pct: number) {
  for (let i = BINS.length - 1; i >= 0; i--) {
    if (pct >= BINS[i].min) return BINS[i]
  }
  return BINS[0]
}

/**
 * Triangular heatmap of pairwise % identity between isoform protein
 * sequences. Surfaces near-duplicate isoforms so users don't waste time
 * optimizing functionally redundant transcripts separately.
 *
 * Identities are read, not computed: the corpus build aligns each pair
 * globally in Rust and stores the result in the gene file (see
 * `StoredIsoformIdentity`). Alignment is too slow to run here, and the
 * prefix/suffix shortcut this used to compute was off by more than 20
 * points for about a fifth of the cells. Without stored values the section
 * says so instead of guessing.
 *
 * Rendered as a real table: numbered columns match the numbered row
 * headers (no rotated or truncated labels), row headers stay pinned while
 * the grid scrolls horizontally on narrow screens, and every visible cell
 * carries its value for screen readers and as a hover title.
 */
export function IsoformIdentityMatrix({ isoforms, identity }: Props) {
  const shown = selectIdentityIsoforms(isoforms)
  if (shown.length < MIN_ISOFORMS) return null

  return (
    <section
      aria-labelledby="identity-matrix-title"
      className="mb-4 space-y-4 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="identity-matrix-title"
          className="flex items-center gap-2 font-sans text-sm font-medium"
        >
          <Grid3x3 className="size-4 text-muted-foreground" />
          {geneSearchCopy.identityMatrix.title}
        </h2>
        {identity && <Legend />}
      </div>
      {identity ? (
        <Matrix
          identity={identity}
          total={isoforms.length}
          shown={shown.length}
        />
      ) : (
        <p className="max-w-prose text-sm text-muted-foreground">
          {geneSearchCopy.identityMatrix.unavailable}
        </p>
      )}
    </section>
  )
}

function Matrix({
  identity: { ids, percent: rows },
  shown,
  total,
}: {
  identity: Identities
  shown: number
  total: number
}) {
  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="border-separate border-spacing-[2px] text-left">
          <caption className="sr-only">
            {geneSearchCopy.identityMatrix.caption}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card">
                <span className="sr-only">
                  {geneSearchCopy.identityMatrix.rowHeader}
                </span>
              </th>
              {ids.map((id, j) => (
                <th
                  key={`col-${id}`}
                  scope="col"
                  title={id}
                  className="w-5 min-w-5 pb-1 text-center type-micro font-medium text-muted-foreground tabular-nums"
                >
                  <span aria-hidden>{j + 1}</span>
                  <span className="sr-only">{id}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <Row key={ids[i]} index={i} id={ids[i]} ids={ids} values={row} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-prose type-nano text-muted-foreground">
        {geneSearchCopy.identityMatrix.footnote}
        {shown < total && (
          <> {geneSearchCopy.identityMatrix.truncated(shown, total)}</>
        )}
      </p>
      <ChartDataTable
        storageKey="isoforms"
        caption={geneSearchCopy.charts.identityMatrix.caption}
        columns={geneSearchCopy.charts.identityMatrix.columns}
        rows={ids.flatMap((id, i) =>
          // Each pair once: the matrix is symmetric, and a diagonal of 100%
          // tells the reader nothing.
          ids
            .slice(i + 1)
            .map((other, j) => [
              id,
              other,
              Number((rows[i]?.[i + 1 + j] ?? 0).toFixed(1)),
            ]),
        )}
        csvFilename="isoform-identity.csv"
      />
    </>
  )
}

function Legend() {
  return (
    <ul
      aria-label={geneSearchCopy.identityMatrix.legendAria}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 type-nano text-muted-foreground"
    >
      {BINS.map((bin) => (
        <li key={bin.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn('size-3 rounded-[3px]', bin.className)}
          />
          {bin.label}
        </li>
      ))}
    </ul>
  )
}

function Row({
  index,
  id,
  ids,
  values,
}: {
  index: number
  id: string
  ids: string[]
  values: number[]
}) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card pr-3 text-right font-normal whitespace-nowrap"
      >
        <Link
          from="/genes/$symbol"
          to="."
          // Opens and highlights the isoform's row and scrolls to it,
          // keeping the rest of the URL and the page's scroll.
          search={(prev) => ({ ...prev, isoform: id })}
          hash={`isoform-row-${id}`}
          resetScroll={false}
          className="inline-flex min-h-6 items-center gap-2 rounded-sm font-mono type-nano text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-0 sm:items-baseline"
          title={geneSearchCopy.identityMatrix.jumpTo(id)}
        >
          <span className="font-sans font-medium text-foreground tabular-nums">
            {index + 1}
          </span>
          {/* Phones get the distinguishing tail so the grid keeps its width;
              the full ID stays in the title and for screen readers. */}
          <span className="hidden sm:inline">{id}</span>
          <span className="sm:hidden" aria-hidden>
            …{id.slice(-6)}
          </span>
          <span className="sr-only sm:hidden">{id}</span>
        </Link>
      </th>
      {values.map((v, j) => {
        // Lower triangle + diagonal only; the mirror would repeat every value.
        if (j > index) return <td key={j} aria-hidden className="size-5" />
        const bin = binFor(v)
        const label = geneSearchCopy.identityMatrix.cellLabel(
          v.toFixed(1),
          id,
          ids[j],
        )
        return (
          <td
            key={j}
            title={label}
            className={cn('size-5 min-w-5 rounded-[3px]', bin.className)}
          >
            <span className="sr-only">{`${v.toFixed(0)}%`}</span>
          </td>
        )
      })}
    </tr>
  )
}
