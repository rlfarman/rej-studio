import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from '@tanstack/react-router'
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
 * Where each stored row goes on screen: shortest CDS first, the order the
 * length chart above draws its bars in, so row 3 here is the third bar
 * there. Stored order is by protein length, descending — the corpus pins it
 * and `parseIsoformIdentity` refuses anything else — so the permutation
 * happens at render time rather than in the data.
 */
function displayOrder(shown: readonly IsoformListItem[]): number[] {
  return shown
    .map((isoform, index) => ({ isoform, index }))
    .sort(
      (a, b) =>
        a.isoform.codingSequenceLength - b.isoform.codingSequenceLength ||
        (a.isoform.id < b.isoform.id ? -1 : 1),
    )
    .map(({ index }) => index)
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
 * carries its value for screen readers and as a hover title. A gene with
 * exactly two isoforms gets the sentence instead: one number is not a
 * heatmap.
 */
export function IsoformIdentityMatrix({ isoforms, identity }: Props) {
  const shown = selectIdentityIsoforms(isoforms)
  if (shown.length < MIN_ISOFORMS) return null

  return (
    <section
      aria-labelledby="identity-matrix-title"
      // min-w-0: the card must never be sized by the grid inside it, however
      // it is laid out, or the grid widens the page instead of scrolling.
      // No margin of its own: the page column spaces the two chart panels.
      className="min-w-0 space-y-4 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="identity-matrix-title"
          className="flex items-center gap-2 font-sans text-sm font-medium"
        >
          <Grid3x3 className="size-4 text-muted-foreground" />
          {geneSearchCopy.identityMatrix.title}
        </h2>
        {/* No scale beside a single pair: two isoforms are one number, and
            that case reads as a sentence rather than a grid (see Matrix). */}
        {identity && shown.length > MIN_ISOFORMS && <Legend />}
      </div>
      {identity ? (
        <Matrix
          identity={identity}
          order={displayOrder(shown)}
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
  identity: { ids: storedIds, percent: stored },
  order,
  shown,
  total,
}: {
  identity: Identities
  /** Stored row indices in display order; see `displayOrder`. */
  order: number[]
  shown: number
  total: number
}) {
  const { symbol: geneSymbol } = useParams({ from: '/genes/$symbol' })
  const cellId = useId()
  // The selected cell, as display indices. The grid is one tab stop and the
  // arrow keys walk it, so a reader with no pointer (or no hover, on a
  // phone) can still read a value: hover and a native `title` were the only
  // way in, which left every phone and every keyboard with color alone.
  // Null until something is chosen: the first cell is still the grid's tab
  // stop, but the readout invites rather than asserting a value nobody picked.
  // The first drawn cell is [1, 0]: only the strict lower triangle is drawn,
  // so the grid's rows are isoforms 2..n and its columns isoforms 1..n-1.
  // Indices stay display indices throughout, so row i is isoform i + 1.
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const active = selected ?? [1, 0]

  const ids = order.map((k) => storedIds[k])
  const valueAt = (i: number, j: number) => stored[order[i]][order[j]]
  const buttonId = (i: number, j: number) => `${cellId}-${i}-${j}`

  const move = (i: number, j: number) => {
    const row = Math.min(Math.max(i, 1), ids.length - 1)
    // Only the strict lower triangle is drawn, so a column stops one short
    // of its row.
    const col = Math.min(Math.max(j, 0), row - 1)
    setSelected([row, col])
    document.getElementById(buttonId(row, col))?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const [i, j] = active
    const steps: Record<string, () => void> = {
      ArrowRight: () => move(i, j + 1),
      ArrowLeft: () => move(i, j - 1),
      ArrowDown: () => move(i + 1, j),
      ArrowUp: () => move(i - 1, j),
      Home: () => move(i, 0),
      End: () => move(i, i - 1),
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    step()
  }

  const [ai, aj] = active
  const activeValue = selected ? valueAt(ai, aj) : null

  return (
    <>
      {ids.length === MIN_ISOFORMS ? (
        // One pair is one number. A grid of three cells — two of them the
        // isoform against itself — under a five-bin scale asked the reader to
        // hover a single square for the only thing the section knows.
        <p className="max-w-prose text-sm tabular-nums">
          {geneSearchCopy.identityMatrix.pairSummary(
            ids[0],
            ids[1],
            valueAt(1, 0).toFixed(1),
          )}
        </p>
      ) : (
        <>
          <GridScroller>
            <table className="border-separate border-spacing-[2px] text-left">
              <caption className="sr-only">
                {geneSearchCopy.identityMatrix.caption}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-background">
                    <span className="sr-only">
                      {geneSearchCopy.identityMatrix.rowHeader}
                    </span>
                  </th>
                  {/* Columns 1..n-1: the last isoform has no pair to its
                      right in a lower triangle, so its column would be
                      empty. They link like the row labels do: isoform 1
                      has no row, so its column is the only way to it. */}
                  {ids.slice(0, -1).map((id, j) => (
                    <th
                      key={`col-${id}`}
                      scope="col"
                      className="w-6 min-w-6 pb-1 text-center type-micro font-medium text-muted-foreground tabular-nums"
                    >
                      <IsoformJumpLink
                        id={id}
                        className="min-h-6 min-w-6 justify-center"
                      >
                        {j + 1}
                        <span className="sr-only"> {id}</span>
                      </IsoformJumpLink>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Rows 2..n: the first isoform's row would hold no cells. */}
                {ids.slice(1).map((id, k) => (
                  <Row
                    key={id}
                    index={k + 1}
                    id={id}
                    ids={ids}
                    values={ids.slice(0, -1).map((_, j) => valueAt(k + 1, j))}
                    active={active}
                    buttonId={buttonId}
                    onSelect={setSelected}
                    onCellKeyDown={onKeyDown}
                  />
                ))}
              </tbody>
            </table>
          </GridScroller>

          {/* The selected cell in words. Hidden from screen readers, which
              hear the cell's own label as focus lands on it. */}
          <p
            aria-hidden
            className="type-nano text-muted-foreground tabular-nums"
          >
            {activeValue === null
              ? geneSearchCopy.identityMatrix.cellHint
              : geneSearchCopy.identityMatrix.cellReadout(
                  activeValue.toFixed(1),
                  ids[ai],
                  ids[aj],
                )}
          </p>
        </>
      )}

      <p className="max-w-prose type-nano text-muted-foreground">
        {geneSearchCopy.identityMatrix.footnote}
        {shown < total && (
          <> {geneSearchCopy.identityMatrix.truncated(shown, total)}</>
        )}
      </p>
      <ChartDataTable
        // Its own key: the length chart above is a different chart with
        // different columns, and a shared key meant one click opened both.
        storageKey="isoform-identity"
        caption={geneSearchCopy.charts.identityMatrix.caption}
        columns={geneSearchCopy.charts.identityMatrix.columns}
        rows={ids
          // Each pair once: the matrix is symmetric, and a diagonal of 100%
          // tells the reader nothing.
          .flatMap((id, i) =>
            ids.slice(i + 1).map((other, j) => ({
              id,
              other,
              value: Number(valueAt(i, i + 1 + j).toFixed(1)),
            })),
          )
          // Most identical first. The footnote asks the reader to optimize one
          // isoform per ≥95% cluster, and in gene order those pairs were
          // scattered through 120 rows with no way to sort or filter them.
          .sort((a, b) => b.value - a.value)
          .map(({ id, other, value }) => [geneSymbol, id, other, value])}
        csvFilename={geneSearchCopy.charts.identityMatrix.csvFilename(
          geneSymbol,
        )}
      />
    </>
  )
}

/**
 * The one scroller the grid gets, inside the card's padding. It must not
 * bleed past the card with a negative margin (the grid then overflows the
 * card, and the page scrolls sideways with it), and it must not sit inside
 * another horizontal scroller: `sticky` row headers pin to the nearest scroll
 * container, so a second one above this takes the scroll and the labels
 * scroll away with the grid.
 *
 * `contain-paint` is load-bearing, not decoration: without it the grid's
 * sticky row labels extend the *page's* scrollable area, so a swipe anywhere
 * panned the whole gene page 73px sideways even though this box already
 * clipped and scrolled correctly. Measured: page pan 73px -> 0.
 * `overscroll-x-contain` then stops a swipe that reaches the grid's end from
 * chaining to the page.
 *
 * The grid is clipped at the card's edge with nothing to say so — on a phone
 * a 16-column matrix is cut mid-column 12 and reads as a 12-column one. So
 * the columns dissolve at the right edge while there is more grid behind it,
 * which is bg-agnostic (it fades the cells themselves) and goes away once the
 * end is reached. The left edge is left alone: the row labels are pinned
 * there, and fading them would hide the one thing that stays put.
 */
function GridScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  const fade =
    'linear-gradient(to right, black calc(100% - 2rem), transparent 100%)'
  return (
    <div
      ref={ref}
      className="min-w-0 overflow-x-auto overscroll-x-contain contain-paint"
      style={more ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
    >
      {children}
    </div>
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

/**
 * A row or column label: opens and highlights the isoform's row in the
 * table and scrolls to it, keeping the rest of the URL and the page's scroll.
 */
function IsoformJumpLink({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      from="/genes/$symbol"
      to="."
      search={(prev) => ({ ...prev, isoform: id })}
      hash={`isoform-row-${id}`}
      resetScroll={false}
      className={cn(
        'inline-flex items-center rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      title={geneSearchCopy.identityMatrix.jumpTo(id)}
    >
      {children}
    </Link>
  )
}

function Row({
  index,
  id,
  ids,
  values,
  active,
  buttonId,
  onSelect,
  onCellKeyDown,
}: {
  index: number
  id: string
  ids: string[]
  values: number[]
  /** The grid's one tab stop, as [row, column]. */
  active: [number, number]
  buttonId: (i: number, j: number) => string
  onSelect: (cell: [number, number]) => void
  /** Arrow keys move the grid's one tab stop; see `Matrix`. */
  onCellKeyDown: (event: React.KeyboardEvent) => void
}) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-background pr-3 text-right font-normal whitespace-nowrap"
      >
        <IsoformJumpLink
          id={id}
          className="min-h-6 gap-2 font-mono type-nano sm:min-h-0 sm:items-baseline"
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
        </IsoformJumpLink>
      </th>
      {values.map((v, j) => {
        // Strict lower triangle: the mirror would repeat every value, and the
        // diagonal is an isoform against itself. It drew a dark staircase in
        // the ramp's top color — the one that means "near-duplicate, worth
        // acting on" — and read out "100% identity between ENST… and the same
        // ENST…" to anyone who focused it. The data table leaves it out for
        // the same reason.
        if (j >= index) return <td key={j} aria-hidden className="size-6" />
        const bin = binFor(v)
        const label = geneSearchCopy.identityMatrix.cellLabel(
          v.toFixed(1),
          id,
          ids[j],
        )
        const isTabStop = active[0] === index && active[1] === j
        return (
          <td key={j} className="size-6 min-w-6 p-0">
            {/* A button, not a bare cell: tapping or focusing one puts its
                value in the readout under the grid. 24px square so it is
                still a tap target (WCAG 2.5.8). */}
            <button
              type="button"
              id={buttonId(index, j)}
              // Roving tabindex: the grid is one stop, the arrows do the rest.
              tabIndex={isTabStop ? 0 : -1}
              aria-label={label}
              title={label}
              onFocus={() => onSelect([index, j])}
              onClick={() => onSelect([index, j])}
              onKeyDown={onCellKeyDown}
              className={cn(
                'size-6 rounded-[3px] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                bin.className,
              )}
            />
          </td>
        )
      })}
    </tr>
  )
}
