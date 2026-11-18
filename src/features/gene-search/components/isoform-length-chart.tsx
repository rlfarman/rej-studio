import { Link, useParams } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  assessDesignSuitability,
  getSuitabilityConfig,
} from '@/lib/bio/design-suitability'
import type { IsoformListItem } from '@/features/gene-search/types/domain-types'
import { lengthChartModel } from '@/features/gene-search/utils/length-chart'
import { ChartDataTable } from '@/components/chart-data-table'
import { geneSearchCopy } from '../copy'

const copy = geneSearchCopy.lengthChart

interface Props {
  isoforms: IsoformListItem[]
}

/**
 * CDS length per isoform against AAV packaging limits. Only rendered when
 * the isoforms span capacity tiers (see lengthChartModel); for single-AAV
 * genes it would just restate the table's CDS column.
 */
export function IsoformLengthChart({ isoforms }: Props) {
  const { symbol: geneSymbol } = useParams({ from: '/genes/$symbol' })
  const rows = [...isoforms]
    // Shortest first so the bars read as a ramp toward the limits. The
    // identity matrix below uses the same order, so its row numbers line up
    // with these bars (see sortForDisplay there).
    .sort((a, b) => a.codingSequenceLength - b.codingSequenceLength)
    .map((i) => ({
      id: i.id,
      length: i.codingSequenceLength,
      suitability: assessDesignSuitability(i.codingSequence),
    }))
  const model = lengthChartModel(rows)

  if (!model.show) return null

  const pct = (bp: number) => (bp / model.scaleMax) * 100

  return (
    // A panel, like the identity matrix below it: the two are readings of one
    // isoform set, and one bordered box beside one bare list read as
    // different kinds of object. Radius by role (AGENTS.md): a panel in a
    // page is `rounded-2xl`.
    <section
      className="min-w-0 space-y-4 rounded-2xl border p-4"
      aria-labelledby="length-chart-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="length-chart-title"
          className="flex items-center gap-2 font-sans text-sm font-medium"
        >
          <BarChart3 className="size-4 text-muted-foreground" />
          {copy.title}
        </h2>
        {/* The matrix's legend type scale, so the pair reads as one section. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-nano">
          {(['single-aav', 'dual-aav', 'triple-aav'] as const).map((s) => {
            const cfg = getSuitabilityConfig(s)
            return (
              <span
                key={s}
                className="flex items-center gap-1 text-muted-foreground"
              >
                <span
                  className={cn('size-2 rounded-sm', cfg.fillClass)}
                  aria-hidden="true"
                />
                {cfg.label}
              </span>
            )
          })}
        </div>
      </div>

      <ul className="space-y-1">
        {rows.map((row) => {
          const cfg = getSuitabilityConfig(row.suitability)
          return (
            <li key={row.id}>
              <Link
                from="/genes/$symbol"
                to="."
                // Opens and highlights the isoform's row and scrolls to it,
                // keeping the rest of the URL and the page's scroll.
                search={(prev) => ({ ...prev, isoform: row.id })}
                hash={`isoform-row-${row.id}`}
                resetScroll={false}
                className="group -mx-1 grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 rounded-lg px-1 py-1 type-micro transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:grid-cols-[8rem_1fr_2rem_4rem]"
                aria-label={`${row.id}, ${row.length.toLocaleString()} base pairs, ${cfg.label}`}
              >
                {/* On phones only the transcript suffix fits; the full ID is
                    in the accessible name and the table row it links to. */}
                <span className="truncate font-mono text-muted-foreground group-hover:text-foreground">
                  <span className="hidden sm:inline">{row.id}</span>
                  <span className="sm:hidden">…{row.id.slice(-6)}</span>
                </span>
                <div className="relative h-3 overflow-hidden rounded-sm bg-muted/30">
                  <div
                    className={cn('h-full', cfg.fillClass)}
                    style={{ width: `${pct(row.length)}%` }}
                  />
                  {/* A notch, not a hairline: a `bg-foreground/30` line
                      disappeared against a saturated fill, which is the only
                      place it carries information ("does this one clear the
                      limit?"). A background-colored core with a darker edge
                      reads on the empty track and on the bar, in both
                      themes. */}
                  {model.thresholds.map((limit) => (
                    <div
                      key={limit}
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-background outline-1 outline-foreground/40"
                      style={{ left: `${pct(limit)}%` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span
                  className="hidden text-center font-mono text-muted-foreground tabular-nums sm:inline"
                  aria-hidden="true"
                >
                  {cfg.short}
                </span>
                <span className="text-right font-mono text-muted-foreground tabular-nums">
                  {row.length.toLocaleString()}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div
        className="grid grid-cols-[5.5rem_1fr_3.5rem] gap-2 type-micro text-muted-foreground tabular-nums sm:grid-cols-[8rem_1fr_2rem_4rem]"
        aria-hidden="true"
      >
        <span />
        <div className="relative h-3">
          <span className="absolute left-0">0</span>
          {model.thresholds.map((limit) => (
            <span
              key={limit}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct(limit)}%` }}
            >
              {copy.capacityLabel(limit.toLocaleString())}
            </span>
          ))}
        </div>
        <span className="hidden sm:inline" />
        <span className="text-right">{copy.unit}</span>
      </div>
      <ChartDataTable
        // Its own key: the identity matrix below is a different chart with
        // different columns, and a shared key meant one click opened a second
        // table 600px down the page that nobody had asked for.
        storageKey="isoform-lengths"
        caption={geneSearchCopy.charts.isoformLengths.caption}
        columns={geneSearchCopy.charts.isoformLengths.columns}
        // The tier's own label, not its slug: the legend above says
        // "Single AAV", so the numbers behind the chart must too.
        rows={rows.map((row) => [
          geneSymbol,
          row.id,
          row.length,
          getSuitabilityConfig(row.suitability).label,
        ])}
        csvFilename={geneSearchCopy.charts.isoformLengths.csvFilename(
          geneSymbol,
        )}
      />
    </section>
  )
}
